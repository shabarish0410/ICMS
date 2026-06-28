from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import (
    FormCreate, FormUpdate, FormOut, FormResponseCreate, FormResponseOut, PaginatedResponse
)
import math

router = APIRouter(prefix="/api/forms", tags=["Native Forms"])

@router.get("", response_model=PaginatedResponse)
def list_forms(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    query = supabase.table("forms").select("*, form_questions(id)", count="exact")
    
    role_info = current_user.get("role", {})
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    
    if role_name == "student":
        now_iso = datetime.now(timezone.utc).isoformat()
        query = query.eq("status", "Published")
        # In Supabase REST, date filtering is slightly complex. We will filter status here and date on python side for safety.

    res = query.order("created_at", desc=True).execute()
    forms = res.data
    total = res.count or 0

    if role_name == "student":
        # Filter active dates
        now = datetime.now(timezone.utc)
        valid_forms = []
        for f in forms:
            pub_date = datetime.fromisoformat(f["publish_date"].replace('Z', '+00:00')) if f.get("publish_date") else None
            close_date = datetime.fromisoformat(f["close_date"].replace('Z', '+00:00')) if f.get("close_date") else None
            
            is_valid = True
            if pub_date and now < pub_date: is_valid = False
            if close_date and now > close_date: is_valid = False
            if is_valid: valid_forms.append(f)
        forms = valid_forms
        total = len(forms)

    # Paginate manually since we filtered in python
    start = (page - 1) * size
    forms = forms[start: start + size]

    # Add response counts (Admin only)
    if role_name == "admin":
        for f in forms:
            sub_res = supabase.table("form_responses").select("id", count="exact").eq("form_id", f["id"]).execute()
            f["response_count"] = sub_res.count or 0

    return PaginatedResponse(
        items=forms, total=total, page=page, size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{form_id}", response_model=FormOut)
def get_form(form_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("forms").select(
        "*, questions:form_questions(*, options:question_options(*))"
    ).eq("id", form_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    form = res.data[0]
    
    # Sort questions and options
    form["questions"] = sorted(form.get("questions", []), key=lambda x: x.get("order_no", 0))
    for q in form["questions"]:
        q["options"] = sorted(q.get("options", []), key=lambda x: x.get("order_no", 0))

    if current_user.get("role", {}).get("name") == "admin":
        sub_res = supabase.table("form_responses").select("id", count="exact").eq("form_id", form["id"]).execute()
        form["response_count"] = sub_res.count or 0
        
    return form


@router.post("", response_model=FormOut, status_code=201)
def create_form(req: FormCreate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    
    new_form = {
        "title": req.title,
        "description": req.description,
        "category": req.category,
        "status": req.status,
        "settings": req.settings,
        "publish_date": req.publish_date.isoformat() if req.publish_date else None,
        "close_date": req.close_date.isoformat() if req.close_date else None,
        "created_by": current_user["id"],
    }
    
    res = supabase.table("forms").insert(new_form).execute()
    form_id = res.data[0]["id"]

    # Insert Questions
    for q_idx, q in enumerate(req.questions):
        new_q = {
            "form_id": form_id,
            "question": q.question,
            "type": q.type,
            "required": q.required,
            "order_no": q.order_no or q_idx,
            "validation": q.validation,
            "logic": q.logic
        }
        q_res = supabase.table("form_questions").insert(new_q).execute()
        q_id = q_res.data[0]["id"]
        
        # Insert Options
        if q.options:
            opts_to_insert = [
                {"question_id": q_id, "option_text": opt.option_text, "order_no": opt.order_no or o_idx}
                for o_idx, opt in enumerate(q.options)
            ]
            supabase.table("question_options").insert(opts_to_insert).execute()

    # Re-fetch full form
    final = supabase.table("forms").select("*, questions:form_questions(*, options:question_options(*))").eq("id", form_id).execute()
    return final.data[0]


@router.put("/{form_id}", response_model=FormOut)
def update_form(form_id: int, req: FormUpdate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("forms").select("id").eq("id", form_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Form not found")
        
    data = req.model_dump(exclude_unset=True)
    update_payload = {}
    for key in ["title", "description", "category", "status", "settings"]:
        if key in data: update_payload[key] = data[key]
        
    if "publish_date" in data: update_payload["publish_date"] = data["publish_date"].isoformat() if data["publish_date"] else None
    if "close_date" in data: update_payload["close_date"] = data["close_date"].isoformat() if data["close_date"] else None
        
    if update_payload:
        supabase.table("forms").update(update_payload).eq("id", form_id).execute()

    if req.questions is not None:
        # Delete existing questions (options cascade)
        supabase.table("form_questions").delete().eq("form_id", form_id).execute()
        
        # Re-insert
        for q_idx, q in enumerate(req.questions):
            new_q = {
                "form_id": form_id,
                "question": q.question,
                "type": q.type,
                "required": q.required,
                "order_no": q.order_no or q_idx,
                "validation": q.validation,
                "logic": q.logic
            }
            q_res = supabase.table("form_questions").insert(new_q).execute()
            q_id = q_res.data[0]["id"]
            if q.options:
                opts = [{"question_id": q_id, "option_text": opt.option_text, "order_no": opt.order_no or o_idx} for o_idx, opt in enumerate(q.options)]
                supabase.table("question_options").insert(opts).execute()

    final = supabase.table("forms").select("*, questions:form_questions(*, options:question_options(*))").eq("id", form_id).execute()
    return final.data[0]


@router.delete("/{form_id}")
def delete_form(form_id: int, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    supabase.table("forms").delete().eq("id", form_id).execute()
    return {"message": "Form deleted successfully"}


# ─── Form Submissions ────────────────────────────────────────────────────────

@router.post("/{form_id}/submit", response_model=FormResponseOut, status_code=201)
def submit_form(form_id: int, req: FormResponseCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("student") or len(current_user["student"]) == 0:
        raise HTTPException(status_code=403, detail="Only students can submit forms.")
    student_id = current_user["student"][0]["id"]
    
    supabase = get_supabase()
    form_res = supabase.table("forms").select("settings, status").eq("id", form_id).execute()
    if not form_res.data or form_res.data[0]["status"] != "Published":
        raise HTTPException(status_code=404, detail="Form not active")
        
    settings = form_res.data[0].get("settings", {})
    if settings.get("one_response_per_student", True):
        existing = supabase.table("form_responses").select("id").eq("form_id", form_id).eq("student_id", student_id).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="You have already submitted this form.")

    # Insert response
    res = supabase.table("form_responses").insert({
        "form_id": form_id,
        "student_id": student_id,
        "status": "Completed"
    }).execute()
    response_id = res.data[0]["id"]
    
    # Insert answers
    answers_to_insert = []
    for a in req.answers:
        answers_to_insert.append({
            "response_id": response_id,
            "question_id": a.question_id,
            "answer": a.answer,
            "file_path": a.file_path
        })
    if answers_to_insert:
        supabase.table("response_answers").insert(answers_to_insert).execute()
        
    final = supabase.table("form_responses").select("*, student:students(*, user:users(*)), answers:response_answers(*)").eq("id", response_id).execute()
    return final.data[0]


@router.get("/{form_id}/responses", response_model=PaginatedResponse)
def list_responses(
    form_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    query = supabase.table("form_responses").select("*, student:students(*, user:users(*)), answers:response_answers(*)", count="exact").eq("form_id", form_id)
    res = query.order("submitted_at", desc=True).range((page - 1) * size, page * size - 1).execute()
    
    return PaginatedResponse(
        items=res.data,
        total=res.count or 0, page=page, size=size, pages=math.ceil((res.count or 0) / size) if (res.count or 0) else 0,
    )
