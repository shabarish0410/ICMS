from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut, PaginatedResponse,
    SubmissionCreate, SubmissionReview, SubmissionOut
)
from app.services import project_service
import math

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.get("", response_model=PaginatedResponse)
def list_projects(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    current_user: dict = Depends(get_current_user)
):
    """List projects. Admin: all. Student: own team's project only."""
    result = project_service.list_projects(page, size, search, status, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, current_user: dict = Depends(get_current_user)):
    return project_service.get_project(project_id, current_user)

@router.post("", response_model=ProjectOut, status_code=201)
def create_project(req: ProjectCreate, current_user: dict = Depends(require_roles("admin"))):
    return project_service.create_project(req, current_user)

@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, req: ProjectUpdate, current_user: dict = Depends(require_roles("admin"))):
    return project_service.update_project(project_id, req, current_user)

@router.delete("/{project_id}")
def delete_project(project_id: int, current_user: dict = Depends(require_roles("admin"))):
    project_service.delete_project(project_id, current_user)
    return {"message": "Project deleted successfully"}

# ─── Submissions ──────────────────────────────────────────────────────────────

@router.post("/{project_id}/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(
    project_id: int, req: SubmissionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Student uploads a submission (report, document, code, presentation)."""
    return project_service.create_submission(project_id, req, current_user)

@router.get("/{project_id}/submissions")
def list_submissions(
    project_id: int,
    current_user: dict = Depends(get_current_user)
):
    """View all submissions for a project."""
    return project_service.list_submissions(project_id, current_user)

@router.put("/{project_id}/submissions/{submission_id}/review", response_model=SubmissionOut)
def review_submission(
    project_id: int, submission_id: int,
    req: SubmissionReview,
    current_user: dict = Depends(require_roles("admin"))
):
    """Admin reviews a submission (approve/reject/request revision)."""
    return project_service.review_submission(project_id, submission_id, req, current_user)
