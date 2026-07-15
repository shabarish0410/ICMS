from datetime import datetime, timezone
from typing import Dict, Any

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, ValidationError, PermissionDeniedError
from app.schemas import WeeklyReportCreate, WeeklyReportReview


def list_reports(page: int, size: int, status: str, current_user: dict) -> Dict[str, Any]:
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

    return {
        "items": res.data,
        "total": res.count or 0,
        "page": page,
        "size": size,
    }


def submit_report(req: WeeklyReportCreate, current_user: dict) -> Dict[str, Any]:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name != "student" or not current_user.get("student"):
        raise PermissionDeniedError("Only students can submit weekly reports")

    student_data = current_user.get("student")
    student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
    supabase = get_supabase()

    existing = supabase.table("weekly_reports").select("id").eq("student_id", student_id).eq("week_number", req.week_number).execute()
    if existing.data:
        raise ValidationError(f"Week {req.week_number} report already submitted")

    new_report = req.model_dump()
    new_report["student_id"] = student_id
    
    res = supabase.table("weekly_reports").insert(new_report).execute()
    report_id = res.data[0]["id"]
    
    final_res = supabase.table("weekly_reports").select("*, student:students(*, user:users(*))").eq("id", report_id).execute()
    return final_res.data[0]


def review_report(report_id: int, req: WeeklyReportReview, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("weekly_reports").select("id").eq("id", report_id).execute()
    if not existing.data:
        raise NotFoundError("Report not found")

    update_data = {
        "status": req.status,
        "admin_comments": req.admin_comments,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    supabase.table("weekly_reports").update(update_data).eq("id", report_id).execute()
    
    final_res = supabase.table("weekly_reports").select("*, student:students(*, user:users(*))").eq("id", report_id).execute()
    return final_res.data[0]
