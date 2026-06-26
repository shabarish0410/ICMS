from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import EventCreate, EventUpdate, EventOut, PaginatedResponse
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
    supabase = get_supabase()
    query = supabase.table("events").select("*", count="exact")
    
    if event_type:
        query = query.eq("event_type", event_type)
    if status:
        query = query.eq("status", status)
    if search:
        query = query.ilike("title", f"%{search}%")

    res = query.order("date", desc=True).range((page - 1) * size, page * size - 1).execute()

    return PaginatedResponse(
        items=res.data,
        total=res.count or 0, page=page, size=size, pages=math.ceil((res.count or 0) / size) if (res.count or 0) else 0,
    )


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("events").select("*").eq("id", event_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return res.data[0]


@router.post("", response_model=EventOut, status_code=201)
def create_event(req: EventCreate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    new_event = req.model_dump()
    new_event["created_by"] = current_user["id"]
    if new_event.get("date"):
        new_event["date"] = new_event["date"].isoformat()
    if new_event.get("end_date"):
        new_event["end_date"] = new_event["end_date"].isoformat()
        
    res = supabase.table("events").insert(new_event).execute()
    return res.data[0]


@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, req: EventUpdate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("events").select("id").eq("id", event_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Event not found")
        
    update_data = req.model_dump(exclude_unset=True)
    if update_data.get("date"):
        update_data["date"] = update_data["date"].isoformat()
    if update_data.get("end_date"):
        update_data["end_date"] = update_data["end_date"].isoformat()
        
    res = supabase.table("events").update(update_data).eq("id", event_id).execute()
    return res.data[0]


@router.delete("/{event_id}")
def delete_event(event_id: int, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("events").select("id").eq("id", event_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Event not found")
        
    supabase.table("events").delete().eq("id", event_id).execute()
    return {"message": "Event deleted successfully"}


@router.post("/{event_id}/register")
def register_for_event(event_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_res = supabase.table("events").select("*").eq("id", event_id).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Event not found")
    event = event_res.data[0]

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name != "student" or not current_user.get("student"):
        raise HTTPException(status_code=403, detail="Only students can register for events")

    student_id = current_user["student"][0]["id"]
    
    existing = supabase.table("registrations").select("id").eq("event_id", event_id).eq("student_id", student_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Already registered")

    if event.get("max_participants"):
        count_res = supabase.table("registrations").select("id", count="exact").eq("event_id", event_id).execute()
        count = count_res.count or 0
        if count >= event["max_participants"]:
            raise HTTPException(status_code=400, detail="Event is full")

    new_reg = {"event_id": event_id, "student_id": student_id}
    supabase.table("registrations").insert(new_reg).execute()
    return {"message": "Registered successfully"}
