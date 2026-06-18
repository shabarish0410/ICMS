from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, Meeting, Student, Team, Notification, meeting_invites
from app.schemas import MeetingCreate, MeetingUpdate, MeetingOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/meetings", tags=["Meetings"])


@router.get("", response_model=PaginatedResponse)
def list_meetings(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List meetings. Student sees only meetings they're invited to."""
    q = db.query(Meeting).options(joinedload(Meeting.creator))

    if current_user.role.name == "student":
        q = q.filter(Meeting.invitees.any(User.id == current_user.id))

    total = q.count()
    meetings = q.order_by(Meeting.date.desc()).offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[MeetingOut.model_validate(m) for m in meetings],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(meeting_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).options(joinedload(Meeting.creator)).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("", response_model=MeetingOut, status_code=201)
def create_meeting(req: MeetingCreate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    meeting = Meeting(
        title=req.title, agenda=req.agenda, date=req.date,
        duration_minutes=req.duration_minutes, meeting_link=req.meeting_link,
        documents=req.documents or [], created_by=current_user.id,
    )
    db.add(meeting)
    db.flush()

    # Add direct user invites
    invited_user_ids = set(req.invite_user_ids or [])

    # Add team members
    for team_id in (req.invite_team_ids or []):
        team_members = db.query(Student).filter(Student.team_id == team_id).all()
        for member in team_members:
            invited_user_ids.add(member.user_id)

    # Create invite relationships and notifications
    for uid in invited_user_ids:
        user = db.query(User).filter(User.id == uid).first()
        if user:
            meeting.invitees.append(user)
            db.add(Notification(
                user_id=uid, title=f"📅 Meeting: {meeting.title}",
                message=f"You are invited to '{meeting.title}' on {meeting.date.strftime('%b %d, %Y %I:%M %p')}",
                notification_type="meeting", link="/dashboard/meetings",
            ))

    db.commit()
    db.refresh(meeting)
    return db.query(Meeting).options(joinedload(Meeting.creator)).filter(Meeting.id == meeting.id).first()


@router.put("/{meeting_id}", response_model=MeetingOut)
def update_meeting(meeting_id: int, req: MeetingUpdate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(meeting, key, value)
    db.commit()
    return db.query(Meeting).options(joinedload(Meeting.creator)).filter(Meeting.id == meeting.id).first()


@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: int, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()
    return {"message": "Meeting deleted successfully"}


@router.get("/{meeting_id}/invitees")
def list_invitees(meeting_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = db.query(Meeting).options(joinedload(Meeting.invitees)).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return [{"id": u.id, "name": u.full_name, "ic_number": u.ic_number} for u in meeting.invitees]
