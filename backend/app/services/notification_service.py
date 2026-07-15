from typing import Dict, Any

from app.core.supabase import get_supabase


def list_notifications(page: int, size: int, unread_only: bool, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("notifications").select("*", count="exact").eq("user_id", current_user["id"])
    
    if unread_only:
        query = query.eq("is_read", False)

    res = query.order("created_at", desc=True).range((page - 1) * size, page * size - 1).execute()
    
    items = res.data
    total = res.count if res.count is not None else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
    }


def unread_count(current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("notifications").select("id", count="exact").eq("user_id", current_user["id"]).eq("is_read", False).execute()
    return {"count": res.count if res.count is not None else 0}


def mark_read(notif_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", current_user["id"]).execute()


def mark_all_read(current_user: dict) -> None:
    supabase = get_supabase()
    supabase.table("notifications").update({"is_read": True}).eq("user_id", current_user["id"]).eq("is_read", False).execute()
