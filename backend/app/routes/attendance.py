from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import (
    AttendanceMarkRequest, AdminAttendanceMarkRequest, AttendanceOut,
    PaginatedResponse, FaceMarkAttendanceRequest
)
from app.services import attendance_service
import math

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.post("/mark", response_model=AttendanceOut, status_code=201)
def mark_attendance(
    req: AttendanceMarkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark attendance for today."""
    return attendance_service.mark_attendance(req, current_user)


@router.post("/face", status_code=201)
def face_attendance(
    req: FaceMarkAttendanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark attendance using Face Recognition."""
    return attendance_service.face_attendance(req, current_user)


@router.get("", response_model=PaginatedResponse)
def list_attendance(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    date_filter: str = Query("", description="Filter by date (YYYY-MM-DD)"),
    department: str = Query(""),
    team_id: int = Query(None),
    student_id: int = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List attendance. Student: own. Admin: all with filters."""
    result = attendance_service.list_attendance(
        page, size, date_filter, department, team_id, student_id, current_user
    )
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )


@router.get("/stats")
def attendance_stats(current_user: dict = Depends(get_current_user)):
    """Attendance statistics."""
    return attendance_service.attendance_stats(current_user)


@router.get("/monthly")
def monthly_attendance(
    month: int = Query(None, ge=1, le=12),
    year: int = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get monthly attendance summary."""
    return attendance_service.monthly_attendance(month, year, current_user)


@router.post("/admin/mark", response_model=AttendanceOut)
def admin_mark_attendance(
    req: AdminAttendanceMarkRequest,
    current_user: dict = Depends(require_roles("admin"))
):
    """Mark or update attendance for any student on a given date (Admin only)."""
    return attendance_service.admin_mark_attendance(req, current_user)


@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(
    attendance_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Delete an attendance record (and clears its photo_url). Admin only."""
    attendance_service.delete_attendance(attendance_id, current_user)
    return
