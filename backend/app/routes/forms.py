from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import (
    FormCreate, FormUpdate, FormOut, FormResponseCreate, FormResponseOut, PaginatedResponse
)
from app.services import form_service
import math

router = APIRouter(prefix="/api/forms", tags=["Native Forms"])

@router.get("", response_model=PaginatedResponse)
def list_forms(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    result = form_service.list_forms(page, size, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )

@router.get("/{form_id}", response_model=FormOut)
def get_form(form_id: int, current_user: dict = Depends(get_current_user)):
    return form_service.get_form(form_id, current_user)

@router.post("", response_model=FormOut, status_code=201)
def create_form(req: FormCreate, current_user: dict = Depends(require_roles("admin"))):
    return form_service.create_form(req, current_user)

@router.put("/{form_id}", response_model=FormOut)
def update_form(form_id: int, req: FormUpdate, current_user: dict = Depends(require_roles("admin"))):
    return form_service.update_form(form_id, req, current_user)

@router.delete("/{form_id}")
def delete_form(form_id: int, current_user: dict = Depends(require_roles("admin"))):
    form_service.delete_form(form_id, current_user)
    return {"message": "Form deleted successfully"}

# ─── Form Submissions ────────────────────────────────────────────────────────

@router.post("/{form_id}/submit", response_model=FormResponseOut, status_code=201)
def submit_form(form_id: int, req: FormResponseCreate, current_user: dict = Depends(get_current_user)):
    return form_service.submit_form(form_id, req, current_user)

@router.get("/{form_id}/responses", response_model=PaginatedResponse)
def list_responses(
    form_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin"))
):
    result = form_service.list_responses(form_id, page, size, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )
