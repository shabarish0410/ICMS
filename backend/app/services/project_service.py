from typing import Dict, Any, List
from datetime import datetime, timezone

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, BusinessLogicError, PermissionDeniedError
from app.schemas import ProjectCreate, ProjectUpdate, SubmissionCreate, SubmissionReview


def list_projects(page: int, size: int, search: str, status: str, current_user: dict) -> Dict[str, Any]:
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
            return {"items": [], "total": 0, "page": page, "size": size}

    if search:
        query = query.ilike("title", f"%{search}%")
    if status:
        query = query.eq("status", status)

    res = query.range((page - 1) * size, page * size - 1).execute()
    
    projects = res.data
    total = res.count if res.count is not None else 0

    return {
        "items": projects,
        "total": total,
        "page": page,
        "size": size,
    }


def get_project(project_id: int, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("projects").select("*, team:teams(*)").eq("id", project_id).execute()
    if not res.data:
        raise NotFoundError("Project not found")
        
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
            raise PermissionDeniedError("Access denied")
            
    return project


def create_project(req: ProjectCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    new_proj = req.model_dump()
    res = supabase.table("projects").insert(new_proj).execute()
    
    if not res.data:
        raise BusinessLogicError("Failed to create project")
        
    project_id = res.data[0]["id"]
    final_res = supabase.table("projects").select("*, team:teams(*)").eq("id", project_id).execute()
    return final_res.data[0]


def update_project(project_id: int, req: ProjectUpdate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("projects").select("id").eq("id", project_id).execute()
    if not existing.data:
        raise NotFoundError("Project not found")
        
    update_data = req.model_dump(exclude_unset=True)
    if 'end_date' in update_data and update_data['end_date']:
        update_data['end_date'] = update_data['end_date'].isoformat()
        
    supabase.table("projects").update(update_data).eq("id", project_id).execute()
    
    final_res = supabase.table("projects").select("*, team:teams(*)").eq("id", project_id).execute()
    return final_res.data[0]


def delete_project(project_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("projects").select("id").eq("id", project_id).execute()
    if not existing.data:
        raise NotFoundError("Project not found")
        
    supabase.table("projects").delete().eq("id", project_id).execute()


def create_submission(project_id: int, req: SubmissionCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    project_res = supabase.table("projects").select("id").eq("id", project_id).execute()
    if not project_res.data:
        raise NotFoundError("Project not found")

    new_sub = req.model_dump()
    new_sub["project_id"] = project_id
    new_sub["submitted_by"] = current_user["id"]
    
    res = supabase.table("project_submissions").insert(new_sub).execute()
    sub_id = res.data[0]["id"]
    
    final_res = supabase.table("project_submissions").select("*, submitter:users(*)").eq("id", sub_id).execute()
    return final_res.data[0]


def list_submissions(project_id: int, current_user: dict) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("project_submissions").select("*, submitter:users(*)").eq("project_id", project_id).order("submitted_at", desc=True).execute()
    return res.data


def review_submission(project_id: int, submission_id: int, req: SubmissionReview, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("project_submissions").select("id").eq("id", submission_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise NotFoundError("Submission not found")

    update_data = {
        "status": req.status,
        "admin_comments": req.admin_comments,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    supabase.table("project_submissions").update(update_data).eq("id", submission_id).execute()
    
    final_res = supabase.table("project_submissions").select("*, submitter:users(*)").eq("id", submission_id).execute()
    return final_res.data[0]
