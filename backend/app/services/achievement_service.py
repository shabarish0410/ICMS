from typing import Dict, Any, List
from pydantic import BaseModel
from typing import Optional
from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, ValidationError, BusinessLogicError


class AchievementCreate(BaseModel):
    title: str
    description: Optional[str] = None
    issuer: Optional[str] = None
    issue_date: Optional[str] = None
    certificate_url: Optional[str] = None

class AchievementUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    issuer: Optional[str] = None
    issue_date: Optional[str] = None
    certificate_url: Optional[str] = None


def create_achievement(req: AchievementCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    
    student_res = supabase.table("students").select("id").eq("user_id", current_user["id"]).execute()
    if not student_res.data:
        raise NotFoundError("Student record not found.")
    student_id = student_res.data[0]["id"]
    
    new_achievement = {
        "student_id": student_id,
        "title": req.title,
        "description": req.description,
        "issuer": req.issuer,
        "issue_date": req.issue_date,
        "certificate_url": req.certificate_url,
        "status": "Pending"
    }
    
    res = supabase.table("student_achievements").insert(new_achievement).execute()
    if not res.data:
        raise BusinessLogicError("Failed to save achievement.")
        
    created_id = res.data[0]["id"]
    
    supabase.table("notifications").insert({
        "user_id": current_user["id"],
        "title": "Submission Received",
        "message": f"Your achievement/certification '{req.title}' has been submitted and is pending review.",
        "notification_type": "info"
    }).execute()
    
    return res.data[0]


def list_my_achievements(current_user: dict) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    
    student_res = supabase.table("students").select("id").eq("user_id", current_user["id"]).execute()
    if not student_res.data:
        raise NotFoundError("Student record not found.")
    student_id = student_res.data[0]["id"]
    
    res = supabase.table("student_achievements").select("*").eq("student_id", student_id).order("created_at", desc=True).execute()
    return res.data


def update_achievement(achievement_id: int, req: AchievementUpdate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    
    student_res = supabase.table("students").select("id").eq("user_id", current_user["id"]).execute()
    if not student_res.data:
        raise NotFoundError("Student record not found.")
    student_id = student_res.data[0]["id"]
    
    existing = supabase.table("student_achievements").select("*").eq("id", achievement_id).eq("student_id", student_id).execute()
    if not existing.data:
        raise NotFoundError("Achievement not found.")
        
    if existing.data[0]["status"] != "Pending":
        raise ValidationError("Cannot edit a submission that is already reviewed.")
        
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    
    if not update_data:
        return existing.data[0]
        
    res = supabase.table("student_achievements").update(update_data).eq("id", achievement_id).execute()
    return res.data[0]


def delete_achievement(achievement_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    
    student_res = supabase.table("students").select("id").eq("user_id", current_user["id"]).execute()
    if not student_res.data:
        raise NotFoundError("Student record not found.")
    student_id = student_res.data[0]["id"]
    
    existing = supabase.table("student_achievements").select("*").eq("id", achievement_id).eq("student_id", student_id).execute()
    if not existing.data:
        raise NotFoundError("Achievement not found.")
        
    if existing.data[0]["status"] != "Pending":
        raise ValidationError("Cannot delete a submission that is already reviewed.")
        
    supabase.table("student_achievements").delete().eq("id", achievement_id).execute()
