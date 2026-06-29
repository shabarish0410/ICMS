import logging
from datetime import datetime, timezone
from app.core.supabase import get_supabase

logger = logging.getLogger("icms.actions")

def log_admin_action(
    admin_id: int, 
    action: str, 
    module: str, 
    entity_id: int = None,
    old_value: dict = None, 
    new_value: dict = None, 
    ip_address: str = None, 
    device: str = None
):
    """Log an administrative action to the activity_logs table."""
    try:
        supabase = get_supabase()
        details = {}
        if old_value:
            details["old"] = old_value
        if new_value:
            details["new"] = new_value
            
        log_entry = {
            "user_id": admin_id,
            "action": action,
            "entity_type": module,
            "entity_id": entity_id,
            "details": details,
            "ip_address": ip_address,
            "device": device,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        supabase.table("activity_logs").insert(log_entry).execute()
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")


def broadcast_notification(
    title: str, 
    message: str, 
    notification_type: str = "info", 
    link: str = None,
    user_ids: list[int] = None
):
    """
    Send a notification to specific users, or broadcast to all active users if user_ids is None.
    This also triggers Supabase Realtime for live updates on the frontend.
    """
    try:
        supabase = get_supabase()
        
        target_users = user_ids
        if target_users is None:
            # Broadcast to all active users
            res = supabase.table("users").select("id").eq("is_active", True).execute()
            target_users = [u["id"] for u in res.data]
            
        if not target_users:
            return
            
        notifications = []
        now = datetime.now(timezone.utc).isoformat()
        
        for uid in target_users:
            notifications.append({
                "user_id": uid,
                "title": title,
                "message": message,
                "notification_type": notification_type,
                "is_read": False,
                "link": link,
                "created_at": now
            })
            
        # Batch insert
        batch_size = 500
        for i in range(0, len(notifications), batch_size):
            supabase.table("notifications").insert(notifications[i:i+batch_size]).execute()
            
    except Exception as e:
        logger.error(f"Failed to broadcast notification: {e}")
