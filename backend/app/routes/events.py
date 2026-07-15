from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import EventCreate, EventUpdate, EventOut, PaginatedResponse
from app.services import event_service
import math

router = APIRouter(prefix="/api/events", tags=["Events"])

@router.get("", response_model=PaginatedResponse)
def list_events(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    event_type: str = Query(""),
    status: str = Query(""),
    search: str = Query(""),
    current_user: dict = Depends(get_current_user)
):
    result = event_service.list_events(page, size, event_type, status, search, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )

@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, current_user: dict = Depends(get_current_user)):
    return event_service.get_event(event_id, current_user)

@router.post("", response_model=EventOut, status_code=201)
def create_event(req: EventCreate, current_user: dict = Depends(require_roles("admin"))):
    return event_service.create_event(req, current_user)

@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, req: EventUpdate, current_user: dict = Depends(require_roles("admin"))):
    return event_service.update_event(event_id, req, current_user)

@router.delete("/{event_id}")
def delete_event(event_id: int, current_user: dict = Depends(require_roles("admin"))):
    event_service.delete_event(event_id, current_user)
    return {"message": "Event deleted successfully"}

@router.post("/{event_id}/register")
def register_for_event(event_id: int, current_user: dict = Depends(get_current_user)):
    return event_service.register_for_event(event_id, current_user)
