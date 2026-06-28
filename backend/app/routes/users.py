from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.security import get_current_user, require_roles, hash_password
from app.core.supabase import get_supabase
from app.schemas import UserOut, UserUpdate, PaginatedResponse
import math
from datetime import datetime, timezone

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/fix-passwords")
def fix_imported_passwords():
    """Temporary diagnostic endpoint to fix unhashed imported passwords."""
    supabase = get_supabase()
    res = supabase.table("users").select("id, ic_number, password_hash").execute()
    users = res.data
    
    fixed_count = 0
    fixed_users = []
    
    for u in users:
        # Check if the password hash does not start with bcrypt standard prefix '$2b$'
        # Or if it looks like a plain text password (e.g. no '$' at all)
        p_hash = u.get("password_hash", "")
        if p_hash and not p_hash.startswith("$2b$"):
            new_hash = hash_password(p_hash)
            supabase.table("users").update({"password_hash": new_hash}).eq("id", u["id"]).execute()
            fixed_count += 1
            fixed_users.append(u["ic_number"])
            
    return {"status": "success", "fixed_count": fixed_count, "fixed_ic_numbers": fixed_users}


@router.get("/roles")
def list_roles(
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Return all available roles so the frontend can display dynamic role options."""
    supabase = get_supabase()
    res = supabase.table("roles").select("id, name, description").order("id").execute()
    return res.data


@router.get("", response_model=PaginatedResponse)
def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str = Query("", description="Search by name or email"),
    role: str = Query("", description="Filter by role name"),
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """List all users with pagination, search, and role filter."""
    supabase = get_supabase()
    query = supabase.table("users").select("*, role:roles(*)", count="exact")

    if search:
        query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")
    if role:
        # Since we can't easily filter by a joined table's column directly in the top-level query with the Python client simply,
        # we can fetch the role_id first or filter after.
        # A better way in Supabase: we can query roles to get the role_id, then filter users by role_id.
        role_res = supabase.table("roles").select("id").eq("name", role).execute()
        if role_res.data:
            role_id = role_res.data[0]["id"]
            query = query.eq("role_id", role_id)
        else:
            # Role doesn't exist, return empty
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)

    res = query.range((page - 1) * size, page * size - 1).execute()
    
    users = res.data
    total = res.count if res.count is not None else 0

    return PaginatedResponse(
        items=users,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific user by ID."""
    supabase = get_supabase()
    res = supabase.table("users").select("*, role:roles(*)").eq("id", user_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return res.data[0]


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update user profile. Users can update their own profile, admins can update anyone."""
    if current_user["id"] != user_id and current_user.get("role", {}).get("name") not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    supabase.table("users").update(update_data).eq("id", user_id).execute()
    
    final_res = supabase.table("users").select("*, role:roles(*)").eq("id", user_id).execute()
    return final_res.data[0]


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Deactivate a user (soft delete)."""
    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Soft delete
    supabase.table("users").update({"is_active": False}).eq("id", user_id).execute()

    # Log activity
    log = {
        "user_id": current_user["id"],
        "action": "user_deactivated",
        "entity_type": "user",
        "entity_id": user_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("activity_logs").insert(log).execute()

    return {"message": "User deactivated"}


@router.post("/admin/create", response_model=UserOut, status_code=201)
def create_admin_user(
    data: dict,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Create a new admin (or any role) user. Accepts role_name (string) and resolves the DB role_id."""
    supabase = get_supabase()

    required = ["ic_number", "full_name", "email", "mobile", "password", "role_name"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=422, detail=f"'{field}' is required")

    # Resolve role_id from role_name — never trust a client-supplied integer
    role_res = supabase.table("roles").select("id").eq("name", data["role_name"]).execute()
    if not role_res.data:
        raise HTTPException(
            status_code=400,
            detail=f"Role '{data['role_name']}' not found in the database"
        )
    resolved_role_id = role_res.data[0]["id"]

    # Check duplicates
    if supabase.table("users").select("id").eq("ic_number", data["ic_number"]).execute().data:
        raise HTTPException(status_code=400, detail="IC Number already registered")
    if supabase.table("users").select("id").eq("email", data["email"]).execute().data:
        raise HTTPException(status_code=400, detail="Email already registered")
    if supabase.table("users").select("id").eq("mobile", data["mobile"]).execute().data:
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    new_user = {
        "ic_number": data["ic_number"],
        "password_hash": hash_password(data["password"]),
        "full_name": data["full_name"],
        "email": data["email"],
        "mobile": data["mobile"],
        "role_id": resolved_role_id,   # ← actual DB id, never a hardcoded guess
        "is_active": True,
        "is_profile_completed": True,
        "must_change_password": False,
    }

    res = supabase.table("users").insert(new_user).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create user")

    user_id = res.data[0]["id"]

    supabase.table("activity_logs").insert({
        "user_id": current_user["id"],
        "action": "admin_user_created",
        "entity_type": "user",
        "entity_id": user_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }).execute()

    final = supabase.table("users").select("*, role:roles(*)").eq("id", user_id).execute()
    return final.data[0]


@router.put("/{user_id}/restore")
def restore_user(
    user_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Restore a deactivated user."""
    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="User not found")

    supabase.table("users").update({"is_active": True}).eq("id", user_id).execute()
    return {"message": "User restored"}
