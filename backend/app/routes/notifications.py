from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user
from app.core.supabase import get_supabase
from app.schemas import NotificationOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=PaginatedResponse)
def list_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    query = supabase.table("notifications").select("*", count="exact").eq("user_id", current_user["id"])
    
    if unread_only:
        query = query.eq("is_read", False)

    res = query.order("created_at", desc=True).range((page - 1) * size, page * size - 1).execute()
    
    items = res.data
    total = res.count if res.count is not None else 0

    return PaginatedResponse(
        items=items,
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/unread-count")
def unread_count(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("notifications").select("id", count="exact").eq("user_id", current_user["id"]).eq("is_read", False).execute()
    return {"count": res.count if res.count is not None else 0}


@router.put("/{notif_id}/read")
def mark_read(notif_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", current_user["id"]).execute()
    return {"message": "Marked as read"}


@router.put("/read-all")
def mark_all_read(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("notifications").update({"is_read": True}).eq("user_id", current_user["id"]).eq("is_read", False).execute()
    return {"message": "All notifications marked as read"}
