from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import AnnouncementCreate, AnnouncementOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/announcements", tags=["Announcements"])


@router.get("", response_model=PaginatedResponse)
def list_announcements(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """List announcements. Filters expired ones for students."""
    supabase = get_supabase()
    query = supabase.table("announcements").select("*, creator:users!announcements_created_by_fkey(*)", count="exact")

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student":
        now = datetime.now(timezone.utc).isoformat()
        # PostgREST doesn't directly support OR with IS NULL elegantly in single query builder easily without custom views, 
        # but we can fetch all and filter, or use an OR filter:
        query = query.or_(f"expiry_date.is.null,expiry_date.gt.{now}")

    res = query.order("created_at", desc=True).range((page - 1) * size, page * size - 1).execute()

    return PaginatedResponse(
        items=res.data,
        total=res.count or 0, page=page, size=size, pages=math.ceil((res.count or 0) / size) if (res.count or 0) else 0,
    )


@router.post("", response_model=AnnouncementOut, status_code=201)
def create_announcement(req: AnnouncementCreate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    new_ann = req.model_dump()
    new_ann["created_by"] = current_user["id"]
    if new_ann.get("expiry_date"):
        new_ann["expiry_date"] = new_ann["expiry_date"].isoformat()
        
    res = supabase.table("announcements").insert(new_ann).execute()
    ann = res.data[0]

    # Notify all students
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


@router.put("/{ann_id}", response_model=AnnouncementOut)
def update_announcement(ann_id: int, req: AnnouncementCreate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("announcements").select("id").eq("id", ann_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    update_data = req.model_dump()
    if update_data.get("expiry_date"):
        update_data["expiry_date"] = update_data["expiry_date"].isoformat()
        
    supabase.table("announcements").update(update_data).eq("id", ann_id).execute()
    
    final_res = supabase.table("announcements").select("*, creator:users!announcements_created_by_fkey(*)").eq("id", ann_id).execute()
    return final_res.data[0]


@router.delete("/{ann_id}")
def delete_announcement(ann_id: int, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("announcements").select("id").eq("id", ann_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    supabase.table("announcements").delete().eq("id", ann_id).execute()
    return {"message": "Announcement deleted successfully"}
