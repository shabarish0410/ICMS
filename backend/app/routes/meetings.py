from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import MeetingCreate, MeetingUpdate, MeetingOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/meetings", tags=["Meetings"])


@router.get("", response_model=PaginatedResponse)
def list_meetings(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """List meetings. Student sees only meetings they're invited to."""
    supabase = get_supabase()
    
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    query = supabase.table("meetings").select("*, creator:users!meetings_created_by_fkey(*)", count="exact")

    if role_name == "student":
        invites_res = supabase.table("meeting_invites").select("meeting_id").eq("user_id", current_user["id"]).execute()
        meeting_ids = [r["meeting_id"] for r in invites_res.data]
        if not meeting_ids:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        query = query.in_("id", meeting_ids)

    res = query.order("date", desc=True).range((page - 1) * size, page * size - 1).execute()

    return PaginatedResponse(
        items=res.data,
        total=res.count or 0, page=page, size=size, pages=math.ceil((res.count or 0) / size) if (res.count or 0) else 0,
    )


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(meeting_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("meetings").select("*, creator:users!meetings_created_by_fkey(*)").eq("id", meeting_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return res.data[0]


@router.post("", response_model=MeetingOut, status_code=201)
def create_meeting(req: MeetingCreate, current_user: dict = Depends(require_roles("admin"))):
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

    # Add direct user invites
    invited_user_ids = set(req.invite_user_ids or [])

    # Add team members
    for team_id in (req.invite_team_ids or []):
        team_members = supabase.table("students").select("user_id").eq("team_id", team_id).execute()
        for member in team_members.data:
            invited_user_ids.add(member["user_id"])

    # Create invite relationships and notifications
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
    return final_res.data[0]


@router.put("/{meeting_id}", response_model=MeetingOut)
def update_meeting(meeting_id: int, req: MeetingUpdate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("meetings").select("id").eq("id", meeting_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    update_data = req.model_dump(exclude_unset=True)
    if update_data.get("date"):
        update_data["date"] = update_data["date"].isoformat()
        
    supabase.table("meetings").update(update_data).eq("id", meeting_id).execute()
    
    final_res = supabase.table("meetings").select("*, creator:users!meetings_created_by_fkey(*)").eq("id", meeting_id).execute()
    return final_res.data[0]


@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: int, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("meetings").select("id").eq("id", meeting_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    supabase.table("meetings").delete().eq("id", meeting_id).execute()
    return {"message": "Meeting deleted successfully"}


@router.get("/{meeting_id}/invitees")
def list_invitees(meeting_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = supabase.table("meetings").select("id").eq("id", meeting_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    invites_res = supabase.table("meeting_invites").select("user_id, users(*)").eq("meeting_id", meeting_id).execute()
    invitees = []
    for r in invites_res.data:
        user_info = r.get("users", {})
        if user_info:
            invitees.append({"id": user_info["id"], "name": user_info.get("full_name"), "ic_number": user_info.get("ic_number")})
            
    return invitees
