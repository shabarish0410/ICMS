from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import FormCreate, FormUpdate, FormOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/forms", tags=["Google Forms"])

def _parse_form(form: dict) -> dict:
    """Extract google_form_url from the fields JSONB column."""
    fields = form.get("fields") or []
    google_form_url = ""
    if isinstance(fields, list) and len(fields) > 0:
        google_form_url = fields[0].get("google_form_url", "")
    form["google_form_url"] = google_form_url
    return form

@router.get("", response_model=PaginatedResponse)
def list_forms(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """List forms. Admin: all. Student: active only."""
    supabase = get_supabase()
    query = supabase.table("dynamic_forms").select("*", count="exact")
    
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    
    if role_name == "student":
        query = query.eq("is_active", True)

    res = query.order("created_at", desc=True).range((page - 1) * size, page * size - 1).execute()
    forms = [_parse_form(f) for f in res.data]
    total = res.count or 0

    return PaginatedResponse(
        items=forms, total=total, page=page, size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{form_id}", response_model=FormOut)
def get_form(form_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("dynamic_forms").select("*").eq("id", form_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    return _parse_form(res.data[0])


@router.post("", response_model=FormOut, status_code=201)
def create_form(req: FormCreate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    
    deadline_str = req.deadline.isoformat() if req.deadline else None
    
    new_form = {
        "title": req.title,
        "description": req.description,
        # Store the URL in the fields JSON array to avoid DB schema migrations
        "fields": [{"google_form_url": req.google_form_url}],
        "is_active": req.is_active,
        "deadline": deadline_str,
        "created_by": current_user["id"],
    }
    
    res = supabase.table("dynamic_forms").insert(new_form).execute()
    form = res.data[0]

    # Notify all students about new form
    student_role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if student_role_res.data:
        student_role_id = student_role_res.data[0]["id"]
        students_res = supabase.table("users").select("id").eq("role_id", student_role_id).eq("is_active", True).execute()
        
        notifications = []
        for s in students_res.data:
            notifications.append({
                "user_id": s["id"], 
                "title": f"New Form: {form['title']}",
                "message": f"A new form '{form['title']}' is available. Please fill it out.",
                "notification_type": "form", 
                "link": f"/dashboard/forms",
            })
        if notifications:
            supabase.table("notifications").insert(notifications).execute()

    return _parse_form(form)


@router.put("/{form_id}", response_model=FormOut)
def update_form(form_id: int, req: FormUpdate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("dynamic_forms").select("id").eq("id", form_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    data = req.model_dump(exclude_unset=True)
    update_payload = {}
    if "title" in data: update_payload["title"] = data["title"]
    if "description" in data: update_payload["description"] = data["description"]
    if "is_active" in data: update_payload["is_active"] = data["is_active"]
    if "deadline" in data and data["deadline"]: update_payload["deadline"] = data["deadline"].isoformat()
    if "google_form_url" in data:
        update_payload["fields"] = [{"google_form_url": data["google_form_url"]}]
        
    res = supabase.table("dynamic_forms").update(update_payload).eq("id", form_id).execute()
    return _parse_form(res.data[0])


@router.delete("/{form_id}")
def delete_form(form_id: int, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("dynamic_forms").select("id").eq("id", form_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    supabase.table("dynamic_forms").delete().eq("id", form_id).execute()
    return {"message": "Form deleted successfully"}


@router.post("/{form_id}/duplicate", response_model=FormOut, status_code=201)
def duplicate_form(form_id: int, current_user: dict = Depends(require_roles("admin"))):
    """Clone an existing form."""
    supabase = get_supabase()
    form_res = supabase.table("dynamic_forms").select("*").eq("id", form_id).execute()
    if not form_res.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    form = form_res.data[0]
    
    new_form = {
        "title": f"Copy of {form['title']}",
        "description": form.get("description"),
        "fields": form.get("fields"),
        "is_active": False,
        "deadline": form.get("deadline"),
        "created_by": current_user["id"],
    }
    
    res = supabase.table("dynamic_forms").insert(new_form).execute()
    return _parse_form(res.data[0])
