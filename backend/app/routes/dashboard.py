from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from app.core.security import get_current_user
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

from app.core.supabase import get_supabase
from datetime import datetime, timezone
@router.get("/active-attendance-sessions")
def active_attendance_sessions(current_user: dict = Depends(get_current_user)):
    """Fetch active attendance sessions."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    response = supabase.table('attendance_sessions').select('*').eq('is_active', True).gte('expires_at', now).order('created_at', desc=True).execute()
    return response.data

@router.get("/my-active-attendance-session")
def my_active_attendance_session(current_user: dict = Depends(get_current_user)):
    """Fetch active attendance session for the current admin."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    response = supabase.table('attendance_sessions').select('*').eq('faculty_id', current_user['id']).eq('is_active', True).gte('expires_at', now).order('created_at', desc=True).limit(1).execute()
    if response.data:
        return response.data[0]
    return None
@router.get("/admin")
def admin_dashboard(current_user: dict = Depends(get_current_user)):
    """Admin dashboard analytics."""
    data = dashboard_service.admin_dashboard(current_user)
    response = JSONResponse(content=data)
    response.headers["Cache-Control"] = "public, max-age=30"
    return response

@router.get("/student")
def student_dashboard(current_user: dict = Depends(get_current_user)):
    """Student's personal dashboard data."""
    return dashboard_service.student_dashboard(current_user)



@router.get("/charts/project-status")
def project_status_chart(current_user: dict = Depends(get_current_user)):
    """Project status distribution."""
    data = dashboard_service.project_status_chart(current_user)
    response = JSONResponse(content=data)
    response.headers["Cache-Control"] = "public, max-age=60"
    return response

@router.get("/charts/department-distribution")
def department_chart(current_user: dict = Depends(get_current_user)):
    """Department distribution."""
    data = dashboard_service.department_chart(current_user)
    response = JSONResponse(content=data)
    response.headers["Cache-Control"] = "public, max-age=60"
    return response
