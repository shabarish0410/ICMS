from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import (
    FormCreate, FormUpdate, FormOut, FormSubmissionCreate, FormSubmissionOut, PaginatedResponse
)
import math

router = APIRouter(prefix="/api/forms", tags=["Dynamic Forms"])

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
    forms = res.data
    total = res.count or 0

    items = []
    for f in forms:
        sub_res = supabase.table("form_submissions").select("id", count="exact").eq("form_id", f["id"]).execute()
        f["response_count"] = sub_res.count or 0
        items.append(f)

    return PaginatedResponse(
        items=items, total=total, page=page, size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{form_id}", response_model=FormOut)
def get_form(form_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("dynamic_forms").select("*").eq("id", form_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    form = res.data[0]
    sub_res = supabase.table("form_submissions").select("id", count="exact").eq("form_id", form["id"]).execute()
    form["response_count"] = sub_res.count or 0
    return form


@router.post("", response_model=FormOut, status_code=201)
def create_form(req: FormCreate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    
    deadline_str = req.deadline.isoformat() if req.deadline else None
    
    new_form = {
        "title": req.title,
        "description": req.description,
        "fields": [f.model_dump() for f in req.fields],
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
                "link": f"/dashboard/forms/{form['id']}",
            })
        if notifications:
            supabase.table("notifications").insert(notifications).execute()

    form["response_count"] = 0
    return form


@router.put("/{form_id}", response_model=FormOut)
def update_form(form_id: int, req: FormUpdate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("dynamic_forms").select("id").eq("id", form_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    data = req.model_dump(exclude_unset=True)
    if "fields" in data and data["fields"]:
        data["fields"] = [f.model_dump() if hasattr(f, 'model_dump') else f for f in data["fields"]]
    if "deadline" in data and data["deadline"]:
        data["deadline"] = data["deadline"].isoformat()
        
    res = supabase.table("dynamic_forms").update(data).eq("id", form_id).execute()
    
    form = res.data[0]
    sub_res = supabase.table("form_submissions").select("id", count="exact").eq("form_id", form["id"]).execute()
    form["response_count"] = sub_res.count or 0
    return form


@router.delete("/{form_id}")
def delete_form(form_id: int, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("dynamic_forms").select("id").eq("id", form_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    supabase.table("dynamic_forms").delete().eq("id", form_id).execute()
    return {"message": "Form deleted successfully"}


# ─── Submissions ──────────────────────────────────────────────────────────────

@router.post("/{form_id}/submit", response_model=FormSubmissionOut, status_code=201)
def submit_form(form_id: int, req: FormSubmissionCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    form_res = supabase.table("dynamic_forms").select("is_active").eq("id", form_id).execute()
    if not form_res.data or not form_res.data[0].get("is_active"):
        raise HTTPException(status_code=404, detail="Form not found or inactive")

    existing = supabase.table("form_submissions").select("id").eq("form_id", form_id).eq("user_id", current_user["id"]).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already submitted this form")

    new_sub = {
        "form_id": form_id,
        "user_id": current_user["id"],
        "data": req.data
    }
    
    res = supabase.table("form_submissions").insert(new_sub).execute()
    sub_id = res.data[0]["id"]
    
    final_res = supabase.table("form_submissions").select("*, user:users(*)").eq("id", sub_id).execute()
    return final_res.data[0]


@router.get("/{form_id}/responses", response_model=PaginatedResponse)
def list_responses(
    form_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str = Query(""),
    current_user: dict = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    query = supabase.table("form_submissions").select("*, user:users(*)", count="exact").eq("form_id", form_id)
    if status:
        query = query.eq("status", status)

    res = query.order("submitted_at", desc=True).range((page - 1) * size, page * size - 1).execute()

    return PaginatedResponse(
        items=res.data,
        total=res.count or 0, page=page, size=size, pages=math.ceil((res.count or 0) / size) if (res.count or 0) else 0,
    )


@router.put("/{form_id}/responses/{response_id}/review", response_model=FormSubmissionOut)
def review_response(
    form_id: int, response_id: int,
    admin_remarks: str = "",
    status: str = "reviewed",
    current_user: dict = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    existing = supabase.table("form_submissions").select("id").eq("id", response_id).eq("form_id", form_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    update_data = {
        "status": status,
        "admin_remarks": admin_remarks,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    supabase.table("form_submissions").update(update_data).eq("id", response_id).execute()
    
    final_res = supabase.table("form_submissions").select("*, user:users(*)").eq("id", response_id).execute()
    return final_res.data[0]


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
    out = res.data[0]
    out["response_count"] = 0
    return out
