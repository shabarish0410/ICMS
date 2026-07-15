from fastapi import APIRouter, Depends
from app.core.security import require_roles
from app.services import export_service

router = APIRouter(prefix="/api/exports", tags=["Exports"])

@router.get("/students")
def export_students(current_user: dict = Depends(require_roles("admin", "super_admin"))):
    return export_service.export_students(current_user)

@router.get("/attendance")
def export_attendance(
    event_id: int = None,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    return export_service.export_attendance(event_id, current_user)
