from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import UserOut, UserUpdate, PaginatedResponse
from app.services import user_service
import math

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/fix-passwords")
def fix_imported_passwords():
    """Temporary diagnostic endpoint to fix unhashed imported passwords."""
    return user_service.fix_imported_passwords()

@router.get("/roles")
def list_roles(
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Return all available roles so the frontend can display dynamic role options."""
    return user_service.list_roles(current_user)

@router.get("", response_model=PaginatedResponse)
def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str = Query("", description="Search by name or email"),
    role: str = Query("", description="Filter by role name"),
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """List all users with pagination, search, and role filter."""
    result = user_service.list_users(page, size, search, role, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )

@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific user by ID."""
    return user_service.get_user(user_id, current_user)

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update user profile. Users can update their own profile, admins can update anyone."""
    return user_service.update_user(user_id, data, current_user)

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Deactivate a user (soft delete)."""
    user_service.delete_user(user_id, current_user)
    return {"message": "User deactivated"}

@router.post("/admin/create", response_model=UserOut, status_code=201)
def create_admin_user(
    data: dict,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Create a new admin (or any role) user."""
    return user_service.create_admin_user(data, current_user)

@router.put("/{user_id}/restore")
def restore_user(
    user_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Restore a deactivated user."""
    user_service.restore_user(user_id, current_user)
    return {"message": "User restored"}
