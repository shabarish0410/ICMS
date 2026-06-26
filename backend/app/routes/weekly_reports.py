from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import WeeklyReportCreate, WeeklyReportReview, WeeklyReportOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/weekly-reports", tags=["Weekly Reports"])


@router.get("", response_model=PaginatedResponse)
def list_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str = Query(""),
    current_user: dict = Depends(get_current_user)
):
    """List weekly reports. Student: own. Admin: all."""
    supabase = get_supabase()
    query = supabase.table("weekly_reports").select("*, student:students(*, user:users(*))", count="exact")

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student" and current_user.get("student"):
        student_data = current_user.get("student")
        student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
        query = query.eq("student_id", student_id)

    if status:
        query = query.eq("status", status)

    res = query.order("submitted_at", desc=True).range((page - 1) * size, page * size - 1).execute()

    return PaginatedResponse(
        items=res.data,
        total=res.count or 0, page=page, size=size, pages=math.ceil((res.count or 0) / size) if (res.count or 0) else 0,
    )


@router.post("", response_model=WeeklyReportOut, status_code=201)
def submit_report(req: WeeklyReportCreate, current_user: dict = Depends(get_current_user)):
    """Student submits a weekly report."""
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name != "student" or not current_user.get("student"):
        raise HTTPException(status_code=403, detail="Only students can submit weekly reports")

    student_data = current_user.get("student")
    student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
    supabase = get_supabase()

    existing = supabase.table("weekly_reports").select("id").eq("student_id", student_id).eq("week_number", req.week_number).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail=f"Week {req.week_number} report already submitted")

    new_report = req.model_dump()
    new_report["student_id"] = student_id
    
    res = supabase.table("weekly_reports").insert(new_report).execute()
    report_id = res.data[0]["id"]
    
    final_res = supabase.table("weekly_reports").select("*, student:students(*, user:users(*))").eq("id", report_id).execute()
    return final_res.data[0]


@router.put("/{report_id}/review", response_model=WeeklyReportOut)
def review_report(
    report_id: int, req: WeeklyReportReview,
    current_user: dict = Depends(require_roles("admin"))
):
    """Admin reviews a weekly report."""
    supabase = get_supabase()
    existing = supabase.table("weekly_reports").select("id").eq("id", report_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Report not found")

    update_data = {
        "status": req.status,
        "admin_comments": req.admin_comments,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("weekly_reports").update(update_data).eq("id", report_id).execute()
    
    final_res = supabase.table("weekly_reports").select("*, student:students(*, user:users(*))").eq("id", report_id).execute()
    return final_res.data[0]
