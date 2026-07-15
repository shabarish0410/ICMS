from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import MeetingCreate, MeetingUpdate, MeetingOut, PaginatedResponse
from app.services import meeting_service
import math

router = APIRouter(prefix="/api/meetings", tags=["Meetings"])

@router.get("", response_model=PaginatedResponse)
def list_meetings(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """List meetings. Student sees only meetings they're invited to."""
    result = meeting_service.list_meetings(page, size, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )

@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(meeting_id: int, current_user: dict = Depends(get_current_user)):
    return meeting_service.get_meeting(meeting_id, current_user)

@router.post("", response_model=MeetingOut, status_code=201)
def create_meeting(req: MeetingCreate, current_user: dict = Depends(require_roles("admin"))):
    return meeting_service.create_meeting(req, current_user)

@router.put("/{meeting_id}", response_model=MeetingOut)
def update_meeting(meeting_id: int, req: MeetingUpdate, current_user: dict = Depends(require_roles("admin"))):
    return meeting_service.update_meeting(meeting_id, req, current_user)

@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: int, current_user: dict = Depends(require_roles("admin"))):
    meeting_service.delete_meeting(meeting_id, current_user)
    return {"message": "Meeting deleted successfully"}

@router.get("/{meeting_id}/invitees")
def list_invitees(meeting_id: int, current_user: dict = Depends(get_current_user)):
    return meeting_service.list_invitees(meeting_id, current_user)
