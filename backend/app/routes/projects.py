from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, Project, ProjectSubmission, Student, Team
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut, PaginatedResponse,
    SubmissionCreate, SubmissionReview, SubmissionOut
)
import math

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.get("", response_model=PaginatedResponse)
def list_projects(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List projects. Admin: all. Student: own team's project only."""
    q = db.query(Project).options(joinedload(Project.team))

    if current_user.role.name == "student" and current_user.student:
        q = q.filter(Project.team_id == current_user.student.team_id)

    if search:
        q = q.filter(Project.title.ilike(f"%{search}%"))
    if status:
        q = q.filter(Project.status == status)

    total = q.count()
    projects = q.offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[ProjectOut.model_validate(p) for p in projects],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).options(joinedload(Project.team)).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Student can only view own team's project
    if current_user.role.name == "student" and current_user.student:
        if project.team_id != current_user.student.team_id:
            raise HTTPException(status_code=403, detail="Access denied")
    return project


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(req: ProjectCreate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    project = Project(**req.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return db.query(Project).options(joinedload(Project.team)).filter(Project.id == project.id).first()


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, req: ProjectUpdate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    return db.query(Project).options(joinedload(Project.team)).filter(Project.id == project.id).first()


@router.delete("/{project_id}")
def delete_project(project_id: int, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}


# ─── Submissions ──────────────────────────────────────────────────────────────

@router.post("/{project_id}/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(
    project_id: int, req: SubmissionCreate,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Student uploads a submission (report, document, code, presentation)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    submission = ProjectSubmission(
        project_id=project_id,
        submitted_by=current_user.id,
        **req.model_dump(),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return db.query(ProjectSubmission).options(joinedload(ProjectSubmission.submitter)).filter(ProjectSubmission.id == submission.id).first()


@router.get("/{project_id}/submissions")
def list_submissions(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """View all submissions for a project."""
    subs = db.query(ProjectSubmission).options(
        joinedload(ProjectSubmission.submitter)
    ).filter(ProjectSubmission.project_id == project_id).order_by(ProjectSubmission.submitted_at.desc()).all()
    return [SubmissionOut.model_validate(s) for s in subs]


@router.put("/{project_id}/submissions/{submission_id}/review", response_model=SubmissionOut)
def review_submission(
    project_id: int, submission_id: int,
    req: SubmissionReview,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin reviews a submission (approve/reject/request revision)."""
    sub = db.query(ProjectSubmission).filter(
        ProjectSubmission.id == submission_id,
        ProjectSubmission.project_id == project_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    sub.status = req.status
    sub.admin_comments = req.admin_comments
    sub.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return db.query(ProjectSubmission).options(joinedload(ProjectSubmission.submitter)).filter(ProjectSubmission.id == sub.id).first()
