from datetime import datetime, timezone
from typing import Dict, Any, List

from app.core.supabase import get_supabase
from app.core.security import hash_password
from app.core.exceptions import NotFoundError, ValidationError, BusinessLogicError, PermissionDeniedError
from app.schemas import UserUpdate


def fix_imported_passwords() -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("users").select("id, ic_number, password_hash").execute()
    users = res.data
    
    fixed_count = 0
    fixed_users = []
    
    for u in users:
        p_hash = u.get("password_hash", "")
        if p_hash and not p_hash.startswith("$2b$"):
            new_hash = hash_password(p_hash)
            supabase.table("users").update({"password_hash": new_hash}).eq("id", u["id"]).execute()
            fixed_count += 1
            fixed_users.append(u["ic_number"])
            
    return {"status": "success", "fixed_count": fixed_count, "fixed_ic_numbers": fixed_users}


def list_roles(current_user: dict) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("roles").select("id, name, description").order("id").execute()
    return res.data


def list_users(page: int, size: int, search: str, role: str, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("users").select("*, role:roles(*)", count="exact")

    if search:
        query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")
    if role:
        role_res = supabase.table("roles").select("id").eq("name", role).execute()
        if role_res.data:
            role_id = role_res.data[0]["id"]
            query = query.eq("role_id", role_id)
        else:
            return {"items": [], "total": 0, "page": page, "size": size}

    res = query.range((page - 1) * size, page * size - 1).execute()
    
    users = res.data
    total = res.count if res.count is not None else 0

    return {
        "items": users,
        "total": total,
        "page": page,
        "size": size,
    }


def get_user(user_id: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("users").select("*, role:roles(*)").eq("id", user_id).execute()
    
    if not res.data:
        raise NotFoundError("User not found")
    return res.data[0]


def update_user(user_id: int, data: UserUpdate, current_user: dict) -> Dict[str, Any]:
    if current_user["id"] != user_id and current_user.get("role", {}).get("name") not in ("super_admin", "admin"):
        raise PermissionDeniedError("Access denied")

    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("id", user_id).execute()
    if not existing.data:
        raise NotFoundError("User not found")

    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    supabase.table("users").update(update_data).eq("id", user_id).execute()
    
    final_res = supabase.table("users").select("*, role:roles(*)").eq("id", user_id).execute()
    return final_res.data[0]


def delete_user(user_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("id", user_id).execute()
    if not existing.data:
        raise NotFoundError("User not found")

    supabase.table("users").update({"is_active": False}).eq("id", user_id).execute()

    log = {
        "user_id": current_user["id"],
        "action": "user_deactivated",
        "entity_type": "user",
        "entity_id": user_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("activity_logs").insert(log).execute()


def create_admin_user(data: dict, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()

    required = ["ic_number", "full_name", "email", "mobile", "password", "role_name"]
    for field in required:
        if not data.get(field):
            raise ValidationError(f"'{field}' is required")

    role_res = supabase.table("roles").select("id").eq("name", data["role_name"]).execute()
    if not role_res.data:
        raise ValidationError(f"Role '{data['role_name']}' not found in the database")
    resolved_role_id = role_res.data[0]["id"]

    if supabase.table("users").select("id").eq("ic_number", data["ic_number"]).execute().data:
        raise ValidationError("IC Number already registered")
    if supabase.table("users").select("id").eq("email", data["email"]).execute().data:
        raise ValidationError("Email already registered")
    if supabase.table("users").select("id").eq("mobile", data["mobile"]).execute().data:
        raise ValidationError("Mobile number already registered")

    new_user = {
        "ic_number": data["ic_number"],
        "password_hash": hash_password(data["password"]),
        "full_name": data["full_name"],
        "email": data["email"],
        "mobile": data["mobile"],
        "role_id": resolved_role_id,
        "is_active": True,
        "is_profile_completed": True,
        "must_change_password": False,
    }

    res = supabase.table("users").insert(new_user).execute()
    if not res.data:
        raise BusinessLogicError("Failed to create user", status_code=500)

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


def restore_user(user_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("id", user_id).execute()
    if not existing.data:
        raise NotFoundError("User not found")

    supabase.table("users").update({"is_active": True}).eq("id", user_id).execute()
