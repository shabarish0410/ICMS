from datetime import datetime, timezone
from typing import Dict, Any

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, ValidationError, BusinessLogicError, PermissionDeniedError
from app.schemas import FormCreate, FormUpdate, FormResponseCreate


def list_forms(page: int, size: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("forms").select("*, form_questions(id)", count="exact")
    
    role_info = current_user.get("role", {})
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    
    if role_name == "student":
        query = query.eq("status", "Published")

    res = query.order("created_at", desc=True).execute()
    forms = res.data
    total = res.count or 0

    if role_name == "student":
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

    start = (page - 1) * size
    forms = forms[start: start + size]

    if role_name == "admin":
        for f in forms:
            sub_res = supabase.table("form_responses").select("id", count="exact").eq("form_id", f["id"]).execute()
            f["response_count"] = sub_res.count or 0

    return {
        "items": forms,
        "total": total,
        "page": page,
        "size": size,
    }


def get_form(form_id: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("forms").select(
        "*, questions:form_questions(*, options:question_options(*))"
    ).eq("id", form_id).execute()
    
    if not res.data:
        raise NotFoundError("Form not found")
        
    form = res.data[0]
    
    form["questions"] = sorted(form.get("questions", []), key=lambda x: x.get("order_no", 0))
    for q in form["questions"]:
        q["options"] = sorted(q.get("options", []), key=lambda x: x.get("order_no", 0))

    if current_user.get("role", {}).get("name") == "admin":
        sub_res = supabase.table("form_responses").select("id", count="exact").eq("form_id", form["id"]).execute()
        form["response_count"] = sub_res.count or 0
        
    return form


def create_form(req: FormCreate, current_user: dict) -> Dict[str, Any]:
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
    
    try:
        res = supabase.table("forms").insert(new_form).execute()
        if not res.data:
            raise BusinessLogicError("Form creation failed in Supabase. Check RLS policies or database constraints.", status_code=500)
        form_id = res.data[0]["id"]
    except Exception as e:
        raise ValidationError(f"Supabase error creating form: {str(e)}")

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
            opts_to_insert = [
                {"question_id": q_id, "option_text": opt.option_text, "order_no": opt.order_no or o_idx}
                for o_idx, opt in enumerate(q.options)
            ]
            supabase.table("question_options").insert(opts_to_insert).execute()

    final = supabase.table("forms").select("*, questions:form_questions(*, options:question_options(*))").eq("id", form_id).execute()
    return final.data[0]


def update_form(form_id: int, req: FormUpdate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("forms").select("id").eq("id", form_id).execute()
    if not existing.data:
        raise NotFoundError("Form not found")
        
    data = req.model_dump(exclude_unset=True)
    update_payload = {}
    for key in ["title", "description", "category", "status", "settings"]:
        if key in data: update_payload[key] = data[key]
        
    if "publish_date" in data: update_payload["publish_date"] = data["publish_date"].isoformat() if data["publish_date"] else None
    if "close_date" in data: update_payload["close_date"] = data["close_date"].isoformat() if data["close_date"] else None
        
    if update_payload:
        supabase.table("forms").update(update_payload).eq("id", form_id).execute()

    if req.questions is not None:
        supabase.table("form_questions").delete().eq("form_id", form_id).execute()
        
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


def delete_form(form_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    supabase.table("forms").delete().eq("id", form_id).execute()


def submit_form(form_id: int, req: FormResponseCreate, current_user: dict) -> Dict[str, Any]:
    student_data = current_user.get("student")
    if not student_data:
        raise PermissionDeniedError("Only students can submit forms.")
    student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
    
    supabase = get_supabase()
    form_res = supabase.table("forms").select("settings, status").eq("id", form_id).execute()
    if not form_res.data or form_res.data[0]["status"] != "Published":
        raise NotFoundError("Form not active")
        
    settings = form_res.data[0].get("settings", {})
    if settings.get("one_response_per_student", True):
        existing = supabase.table("form_responses").select("id").eq("form_id", form_id).eq("student_id", student_id).execute()
        if existing.data:
            raise ValidationError("You have already submitted this form.")

    res = supabase.table("form_responses").insert({
        "form_id": form_id,
        "student_id": student_id,
        "status": "Completed"
    }).execute()
    response_id = res.data[0]["id"]
    
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


def list_responses(form_id: int, page: int, size: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("form_responses").select("*, student:students(*, user:users(*)), answers:response_answers(*)", count="exact").eq("form_id", form_id)
    res = query.order("submitted_at", desc=True).range((page - 1) * size, page * size - 1).execute()
    
    return {
        "items": res.data,
        "total": res.count or 0,
        "page": page,
        "size": size,
    }
