from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, ValidationError, BusinessLogicError


class AchievementReview(BaseModel):
    status: str
    rejection_reason: Optional[str] = None


def list_all_achievements(status: Optional[str], current_user: dict) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    
    query = supabase.table("student_achievements").select(
        "*, student:students(*, user:users(id, full_name, ic_number, email))"
    )
    
    if status:
        query = query.eq("status", status)
        
    res = query.order("created_at", desc=True).execute()
    return res.data


def review_achievement(achievement_id: int, req: AchievementReview, current_user: dict) -> Dict[str, Any]:
    if req.status not in ["Approved", "Rejected"]:
        raise ValidationError("Invalid status. Must be 'Approved' or 'Rejected'.")
        
    if req.status == "Rejected" and not req.rejection_reason:
        raise ValidationError("Rejection reason is mandatory when rejecting.")

    supabase = get_supabase()
    
    existing = supabase.table("student_achievements").select(
        "*, student:students(user_id)"
    ).eq("id", achievement_id).execute()
    
    if not existing.data:
        raise NotFoundError("Achievement not found.")
        
    update_data = {
        "status": req.status,
        "rejection_reason": req.rejection_reason if req.status == "Rejected" else None,
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    res = supabase.table("student_achievements").update(update_data).eq("id", achievement_id).execute()
    if not res.data:
        raise BusinessLogicError("Failed to update achievement status.", status_code=500)
        
    student_user_id = existing.data[0]["student"]["user_id"]
    title = existing.data[0]["title"]
    
    notification_msg = f"Your submission '{title}' has been {req.status.lower()}."
    if req.status == "Rejected":
        notification_msg += f" Reason: {req.rejection_reason}"
        
    supabase.table("notifications").insert({
        "user_id": student_user_id,
        "title": f"Submission {req.status}",
        "message": notification_msg,
        "notification_type": "info" if req.status == "Approved" else "warning"
    }).execute()
    
    return res.data[0]
