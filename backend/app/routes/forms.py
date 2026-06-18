from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, DynamicForm, FormSubmission, Notification
from app.schemas import (
    FormCreate, FormUpdate, FormOut, FormSubmissionCreate, FormSubmissionOut, PaginatedResponse
)
import math

router = APIRouter(prefix="/api/forms", tags=["Dynamic Forms"])


@router.get("", response_model=PaginatedResponse)
def list_forms(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List forms. Admin: all. Student: active only."""
    q = db.query(DynamicForm)
    if current_user.role.name == "student":
        q = q.filter(DynamicForm.is_active == True)

    total = q.count()
    forms = q.order_by(DynamicForm.created_at.desc()).offset((page - 1) * size).limit(size).all()

    items = []
    for f in forms:
        out = FormOut.model_validate(f)
        out.response_count = db.query(FormSubmission).filter(FormSubmission.form_id == f.id).count()
        items.append(out)

    return PaginatedResponse(
        items=items, total=total, page=page, size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{form_id}", response_model=FormOut)
def get_form(form_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = db.query(DynamicForm).filter(DynamicForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    out = FormOut.model_validate(form)
    out.response_count = db.query(FormSubmission).filter(FormSubmission.form_id == form.id).count()
    return out


@router.post("", response_model=FormOut, status_code=201)
def create_form(req: FormCreate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    form = DynamicForm(
        title=req.title,
        description=req.description,
        fields=[f.model_dump() for f in req.fields],
        is_active=req.is_active,
        deadline=req.deadline,
        created_by=current_user.id,
    )
    db.add(form)
    db.commit()
    db.refresh(form)

    # Notify all students about new form
    from app.models import Role
    student_role = db.query(Role).filter(Role.name == "student").first()
    if student_role:
        students = db.query(User).filter(User.role_id == student_role.id, User.is_active == True).all()
        for s in students:
            notif = Notification(
                user_id=s.id, title=f"New Form: {form.title}",
                message=f"A new form '{form.title}' is available. Please fill it out.",
                notification_type="form", link=f"/dashboard/forms/{form.id}",
            )
            db.add(notif)
        db.commit()

    return FormOut.model_validate(form)


@router.put("/{form_id}", response_model=FormOut)
def update_form(form_id: int, req: FormUpdate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    form = db.query(DynamicForm).filter(DynamicForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    data = req.model_dump(exclude_unset=True)
    if "fields" in data and data["fields"]:
        data["fields"] = [f.model_dump() if hasattr(f, 'model_dump') else f for f in data["fields"]]
    for key, value in data.items():
        setattr(form, key, value)
    db.commit()
    db.refresh(form)
    return FormOut.model_validate(form)


@router.delete("/{form_id}")
def delete_form(form_id: int, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    form = db.query(DynamicForm).filter(DynamicForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    db.delete(form)
    db.commit()
    return {"message": "Form deleted successfully"}


# ─── Submissions ──────────────────────────────────────────────────────────────

@router.post("/{form_id}/submit", response_model=FormSubmissionOut, status_code=201)
def submit_form(form_id: int, req: FormSubmissionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    form = db.query(DynamicForm).filter(DynamicForm.id == form_id).first()
    if not form or not form.is_active:
        raise HTTPException(status_code=404, detail="Form not found or inactive")

    # Check if already submitted
    existing = db.query(FormSubmission).filter(
        FormSubmission.form_id == form_id, FormSubmission.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this form")

    submission = FormSubmission(form_id=form_id, user_id=current_user.id, data=req.data)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return db.query(FormSubmission).options(joinedload(FormSubmission.user)).filter(FormSubmission.id == submission.id).first()


@router.get("/{form_id}/responses", response_model=PaginatedResponse)
def list_responses(
    form_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str = Query(""),
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    q = db.query(FormSubmission).options(joinedload(FormSubmission.user)).filter(FormSubmission.form_id == form_id)
    if status:
        q = q.filter(FormSubmission.status == status)

    total = q.count()
    subs = q.order_by(FormSubmission.submitted_at.desc()).offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[FormSubmissionOut.model_validate(s) for s in subs],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.put("/{form_id}/responses/{response_id}/review", response_model=FormSubmissionOut)
def review_response(
    form_id: int, response_id: int,
    admin_remarks: str = "",
    status: str = "reviewed",
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    sub = db.query(FormSubmission).filter(FormSubmission.id == response_id, FormSubmission.form_id == form_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.status = status
    sub.admin_remarks = admin_remarks
    sub.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return db.query(FormSubmission).options(joinedload(FormSubmission.user)).filter(FormSubmission.id == sub.id).first()


@router.post("/{form_id}/duplicate", response_model=FormOut, status_code=201)
def duplicate_form(form_id: int, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    """Clone an existing form."""
    form = db.query(DynamicForm).filter(DynamicForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    new_form = DynamicForm(
        title=f"Copy of {form.title}",
        description=form.description,
        fields=form.fields,
        is_active=False,
        deadline=form.deadline,
        created_by=current_user.id,
    )
    db.add(new_form)
    db.commit()
    db.refresh(new_form)
    return FormOut.model_validate(new_form)
