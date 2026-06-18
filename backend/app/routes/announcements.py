from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, Announcement
from app.schemas import AnnouncementCreate, AnnouncementOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/announcements", tags=["Announcements"])


@router.get("", response_model=PaginatedResponse)
def list_announcements(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List announcements. Filters expired ones for students."""
    q = db.query(Announcement).options(joinedload(Announcement.creator))

    if current_user.role.name == "student":
        now = datetime.now(timezone.utc)
        q = q.filter((Announcement.expiry_date == None) | (Announcement.expiry_date > now))

    total = q.count()
    items = q.order_by(Announcement.created_at.desc()).offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[AnnouncementOut.model_validate(a) for a in items],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.post("", response_model=AnnouncementOut, status_code=201)
def create_announcement(req: AnnouncementCreate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    ann = Announcement(created_by=current_user.id, **req.model_dump())
    db.add(ann)
    db.commit()
    db.refresh(ann)

    # Notify all students
    from app.models import Role, Notification
    student_role = db.query(Role).filter(Role.name == "student").first()
    if student_role:
        students = db.query(User).filter(User.role_id == student_role.id, User.is_active == True).all()
        for s in students:
            db.add(Notification(
                user_id=s.id, title=f"📢 {ann.title}",
                message=ann.description[:200], notification_type="announcement",
                link="/dashboard/announcements",
            ))
        db.commit()

    return db.query(Announcement).options(joinedload(Announcement.creator)).filter(Announcement.id == ann.id).first()


@router.put("/{ann_id}", response_model=AnnouncementOut)
def update_announcement(ann_id: int, req: AnnouncementCreate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for key, value in req.model_dump().items():
        setattr(ann, key, value)
    db.commit()
    return db.query(Announcement).options(joinedload(Announcement.creator)).filter(Announcement.id == ann.id).first()


@router.delete("/{ann_id}")
def delete_announcement(ann_id: int, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(ann)
    db.commit()
    return {"message": "Announcement deleted successfully"}
