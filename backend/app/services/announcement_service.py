from datetime import datetime, timezone
from typing import Dict, Any

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError
from app.schemas import AnnouncementCreate


def list_announcements(page: int, size: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("announcements").select("*, creator:users!announcements_created_by_fkey(*)", count="exact")

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student":
        now = datetime.now(timezone.utc).isoformat()
        query = query.or_(f"expiry_date.is.null,expiry_date.gt.{now}")

    res = query.order("created_at", desc=True).range((page - 1) * size, page * size - 1).execute()

    return {
        "items": res.data,
        "total": res.count or 0,
        "page": page,
        "size": size,
    }


def create_announcement(req: AnnouncementCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    new_ann = req.model_dump()
    new_ann["created_by"] = current_user["id"]
    if new_ann.get("expiry_date"):
        new_ann["expiry_date"] = new_ann["expiry_date"].isoformat()
        
    res = supabase.table("announcements").insert(new_ann).execute()
    ann = res.data[0]

    student_role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if student_role_res.data:
        student_role_id = student_role_res.data[0]["id"]
        students_res = supabase.table("users").select("id").eq("role_id", student_role_id).eq("is_active", True).execute()
        
        notifications = []
        for s in students_res.data:
            notifications.append({
                "user_id": s["id"], 
                "title": f"📢 {ann['title']}",
                "message": ann.get("description", "")[:200], 
                "notification_type": "announcement",
                "link": "/dashboard/announcements",
            })
        if notifications:
            supabase.table("notifications").insert(notifications).execute()

    final_res = supabase.table("announcements").select("*, creator:users!announcements_created_by_fkey(*)").eq("id", ann["id"]).execute()
    return final_res.data[0]


def update_announcement(ann_id: int, req: AnnouncementCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("announcements").select("id").eq("id", ann_id).execute()
    if not existing.data:
        raise NotFoundError("Announcement not found")
        
    update_data = req.model_dump()
    if update_data.get("expiry_date"):
        update_data["expiry_date"] = update_data["expiry_date"].isoformat()
        
    supabase.table("announcements").update(update_data).eq("id", ann_id).execute()
    
    final_res = supabase.table("announcements").select("*, creator:users!announcements_created_by_fkey(*)").eq("id", ann_id).execute()
    return final_res.data[0]


def delete_announcement(ann_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("announcements").select("id").eq("id", ann_id).execute()
    if not existing.data:
        raise NotFoundError("Announcement not found")
        
    supabase.table("announcements").delete().eq("id", ann_id).execute()
