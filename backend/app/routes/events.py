from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, Event, Registration, Student
from app.schemas import EventCreate, EventUpdate, EventOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/events", tags=["Events"])


@router.get("", response_model=PaginatedResponse)
def list_events(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    event_type: str = Query(""),
    status: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Event)
    if event_type:
        q = q.filter(Event.event_type == event_type)
    if status:
        q = q.filter(Event.status == status)

    total = q.count()
    events = q.order_by(Event.date.desc()).offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[EventOut.model_validate(e) for e in events],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("", response_model=EventOut, status_code=201)
def create_event(req: EventCreate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    event = Event(created_by=current_user.id, **req.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, req: EventUpdate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}")
def delete_event(event_id: int, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Event deleted successfully"}


@router.post("/{event_id}/register")
def register_for_event(event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not current_user.student:
        raise HTTPException(status_code=403, detail="Only students can register for events")

    existing = db.query(Registration).filter(
        Registration.event_id == event_id, Registration.student_id == current_user.student.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")

    if event.max_participants:
        count = db.query(Registration).filter(Registration.event_id == event_id).count()
        if count >= event.max_participants:
            raise HTTPException(status_code=400, detail="Event is full")

    reg = Registration(event_id=event_id, student_id=current_user.student.id)
    db.add(reg)
    db.commit()
    return {"message": "Registered successfully"}
