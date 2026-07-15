from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles
from app.schemas import (
    FaceRegisterRequest, FaceStatusOut, FaceUpdateRequest
)
from app.services import face_service

router = APIRouter(prefix="/api/face", tags=["Face"])

@router.post("/register", status_code=201)
def register_face(
    req: FaceRegisterRequest,
    current_user: dict = Depends(get_current_user)
):
    """Register student face."""
    return face_service.register_face(req, current_user)

@router.get("/status/{student_id}", response_model=FaceStatusOut)
def get_face_status(
    student_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get face registration status for a student."""
    return face_service.get_face_status(student_id, current_user)

@router.get("/my-status")
def get_my_face_status(current_user: dict = Depends(get_current_user)):
    """Get face registration status for the currently logged-in student."""
    return face_service.get_my_face_status(current_user)

@router.put("/update", status_code=200)
def update_face(
    req: FaceUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update student face registration."""
    return face_service.update_face(req, current_user)

@router.delete("/reset/{student_id}", status_code=200)
def reset_face(
    student_id: int,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Admin: Reset a student's face registration."""
    return face_service.reset_face(student_id, current_user)

@router.get("/admin/all-status")
def admin_face_status(
    department: str = "",
    page: int = 1,
    size: int = 50,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Admin: Get face registration status for all students."""
    return face_service.admin_face_status(department, page, size, current_user)
