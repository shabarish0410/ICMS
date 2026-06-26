from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
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
    current_user: dict = Depends(get_current_user)
):
    """List projects. Admin: all. Student: own team's project only."""
    supabase = get_supabase()
    query = supabase.table("projects").select("*, team:teams(*)", count="exact")

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    
    if role_name == "student" and current_user.get("student"):
        student_data = current_user.get("student")
        if isinstance(student_data, list) and len(student_data) > 0:
            team_id = student_data[0].get("team_id")
        elif isinstance(student_data, dict):
            team_id = student_data.get("team_id")
        else:
            team_id = None

        if team_id:
            query = query.eq("team_id", team_id)
        else:
            # Student without a team shouldn't see projects
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)

    if search:
        query = query.ilike("title", f"%{search}%")
    if status:
        query = query.eq("status", status)

    res = query.range((page - 1) * size, page * size - 1).execute()
    
    projects = res.data
    total = res.count if res.count is not None else 0

    return PaginatedResponse(
        items=projects,
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("projects").select("*, team:teams(*)").eq("id", project_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    project = res.data[0]
    
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    
    if role_name == "student" and current_user.get("student"):
        student_data = current_user.get("student")
        if isinstance(student_data, list) and len(student_data) > 0:
            team_id = student_data[0].get("team_id")
        elif isinstance(student_data, dict):
            team_id = student_data.get("team_id")
        else:
            team_id = None

        if project.get("team_id") != team_id:
            raise HTTPException(status_code=403, detail="Access denied")
            
    return project


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(req: ProjectCreate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    new_proj = req.model_dump()
    res = supabase.table("projects").insert(new_proj).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create project")
        
    project_id = res.data[0]["id"]
    final_res = supabase.table("projects").select("*, team:teams(*)").eq("id", project_id).execute()
    return final_res.data[0]


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, req: ProjectUpdate, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("projects").select("id").eq("id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Exclude unset handles python date to string nicely since Supabase wants ISO strings for dates
    update_data = req.model_dump(exclude_unset=True)
    if 'end_date' in update_data and update_data['end_date']:
        update_data['end_date'] = update_data['end_date'].isoformat()
        
    supabase.table("projects").update(update_data).eq("id", project_id).execute()
    
    final_res = supabase.table("projects").select("*, team:teams(*)").eq("id", project_id).execute()
    return final_res.data[0]


@router.delete("/{project_id}")
def delete_project(project_id: int, current_user: dict = Depends(require_roles("admin"))):
    supabase = get_supabase()
    existing = supabase.table("projects").select("id").eq("id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    supabase.table("projects").delete().eq("id", project_id).execute()
    return {"message": "Project deleted successfully"}


# ─── Submissions ──────────────────────────────────────────────────────────────

@router.post("/{project_id}/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(
    project_id: int, req: SubmissionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Student uploads a submission (report, document, code, presentation)."""
    supabase = get_supabase()
    project_res = supabase.table("projects").select("id").eq("id", project_id).execute()
    if not project_res.data:
        raise HTTPException(status_code=404, detail="Project not found")

    new_sub = req.model_dump()
    new_sub["project_id"] = project_id
    new_sub["submitted_by"] = current_user["id"]
    
    res = supabase.table("project_submissions").insert(new_sub).execute()
    sub_id = res.data[0]["id"]
    
    final_res = supabase.table("project_submissions").select("*, submitter:users(*)").eq("id", sub_id).execute()
    return final_res.data[0]


@router.get("/{project_id}/submissions")
def list_submissions(
    project_id: int,
    current_user: dict = Depends(get_current_user)
):
    """View all submissions for a project."""
    supabase = get_supabase()
    res = supabase.table("project_submissions").select("*, submitter:users(*)").eq("project_id", project_id).order("submitted_at", desc=True).execute()
    return res.data


@router.put("/{project_id}/submissions/{submission_id}/review", response_model=SubmissionOut)
def review_submission(
    project_id: int, submission_id: int,
    req: SubmissionReview,
    current_user: dict = Depends(require_roles("admin"))
):
    """Admin reviews a submission (approve/reject/request revision)."""
    supabase = get_supabase()
    existing = supabase.table("project_submissions").select("id").eq("id", submission_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Submission not found")

    update_data = {
        "status": req.status,
        "admin_comments": req.admin_comments,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    supabase.table("project_submissions").update(update_data).eq("id", submission_id).execute()
    
    final_res = supabase.table("project_submissions").select("*, submitter:users(*)").eq("id", submission_id).execute()
    return final_res.data[0]
