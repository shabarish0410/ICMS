from datetime import datetime
from typing import Dict, Any, List

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError
from app.schemas import MeetingCreate, MeetingUpdate
from app.utils.actions import log_admin_action, broadcast_notification


def list_meetings(page: int, size: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    query = supabase.table("meetings").select("*, creator:users!meetings_created_by_fkey(*)", count="exact")

    if role_name == "student":
        invites_res = supabase.table("meeting_invites").select("meeting_id").eq("user_id", current_user["id"]).execute()
        meeting_ids = [r["meeting_id"] for r in invites_res.data]
        if not meeting_ids:
            return {"items": [], "total": 0, "page": page, "size": size}
        query = query.in_("id", meeting_ids)

    res = query.order("date", desc=True).range((page - 1) * size, page * size - 1).execute()

    return {
        "items": res.data,
        "total": res.count or 0,
        "page": page,
        "size": size,
    }


def get_meeting(meeting_id: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("meetings").select("*, creator:users!meetings_created_by_fkey(*)").eq("id", meeting_id).execute()
    if not res.data:
        raise NotFoundError("Meeting not found")
    return res.data[0]


def create_meeting(req: MeetingCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    
    new_meeting = {
        "title": req.title,
        "agenda": req.agenda,
        "date": req.date.isoformat(),
        "duration_minutes": req.duration_minutes,
        "meeting_link": req.meeting_link,
        "documents": req.documents or [],
        "created_by": current_user["id"],
    }
    res = supabase.table("meetings").insert(new_meeting).execute()
    meeting = res.data[0]

    invited_user_ids = set(req.invite_user_ids or [])

    for team_id in (req.invite_team_ids or []):
        team_members = supabase.table("students").select("user_id").eq("team_id", team_id).execute()
        for member in team_members.data:
            invited_user_ids.add(member["user_id"])

    if invited_user_ids:
        invites = [{"meeting_id": meeting["id"], "user_id": uid} for uid in invited_user_ids]
        supabase.table("meeting_invites").insert(invites).execute()
        
        date_obj = datetime.fromisoformat(meeting["date"].replace('Z', '+00:00'))
        date_str = date_obj.strftime('%b %d, %Y %I:%M %p')

        notifications = []
        for uid in invited_user_ids:
            notifications.append({
                "user_id": uid, 
                "title": f"📅 Meeting: {meeting['title']}",
                "message": f"You are invited to '{meeting['title']}' on {date_str}",
                "notification_type": "meeting", 
                "link": "/dashboard/meetings",
            })
            if notifications:
                supabase.table("notifications").insert(notifications).execute()

    final_res = supabase.table("meetings").select("*, creator:users!meetings_created_by_fkey(*)").eq("id", meeting["id"]).execute()
    log_admin_action(current_user["id"], "create", "meetings", meeting["id"], new_value=meeting)
    broadcast_notification("Meeting Scheduled", f"A new meeting '{meeting['title']}' has been scheduled.", "meeting")
    
    return final_res.data[0]


def update_meeting(meeting_id: int, req: MeetingUpdate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("meetings").select("id").eq("id", meeting_id).execute()
    if not existing.data:
        raise NotFoundError("Meeting not found")
        
    update_data = req.model_dump(exclude_unset=True)
    if update_data.get("date"):
        update_data["date"] = update_data["date"].isoformat()
        
    supabase.table("meetings").update(update_data).eq("id", meeting_id).execute()
    
    final_res = supabase.table("meetings").select("*, creator:users!meetings_created_by_fkey(*)").eq("id", meeting_id).execute()
    log_admin_action(current_user["id"], "update", "meetings", meeting_id, old_value=existing.data[0], new_value=update_data)
    broadcast_notification("Meeting Updated", f"The meeting '{update_data.get('title', 'Meeting')}' has been updated.", "meeting")
    
    return final_res.data[0]


def delete_meeting(meeting_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("meetings").select("id").eq("id", meeting_id).execute()
    if not existing.data:
        raise NotFoundError("Meeting not found")
        
    supabase.table("meetings").delete().eq("id", meeting_id).execute()
    log_admin_action(current_user["id"], "delete", "meetings", meeting_id, old_value=existing.data[0])


def list_invitees(meeting_id: int, current_user: dict) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    existing = supabase.table("meetings").select("id").eq("id", meeting_id).execute()
    if not existing.data:
        raise NotFoundError("Meeting not found")
        
    invites_res = supabase.table("meeting_invites").select("user_id, users(*)").eq("meeting_id", meeting_id).execute()
    invitees = []
    for r in invites_res.data:
        user_info = r.get("users", {})
        if user_info:
            invitees.append({"id": user_info["id"], "name": user_info.get("full_name"), "ic_number": user_info.get("ic_number")})
            
    return invitees
