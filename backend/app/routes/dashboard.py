from fastapi import APIRouter, Depends
from datetime import datetime, date, timezone, timedelta
from app.core.security import get_current_user
from app.core.supabase import get_supabase
from app.schemas import AdminDashboardStats, StudentDashboardData

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/admin", response_model=AdminDashboardStats)
def admin_dashboard(current_user: dict = Depends(get_current_user)):
    """Admin dashboard analytics."""
    supabase = get_supabase()
    today = date.today().isoformat()
    now_utc = datetime.now(timezone.utc).isoformat()
    
    # Students
    students_res = supabase.table("users").select("id", count="exact").eq("is_active", True).eq("role_id", 2).execute() # assuming 2 is student role
    total_students = students_res.count if students_res.count is not None else 0

    # Teams
    teams_res = supabase.table("teams").select("id", count="exact").execute()
    total_teams = teams_res.count if teams_res.count is not None else 0

    # Projects
    projects_res = supabase.table("projects").select("status").execute()
    projects = projects_res.data
    total_projects = len(projects)
    active_projects = sum(1 for p in projects if p.get("status") == "ongoing")
    completed_projects = sum(1 for p in projects if p.get("status") == "completed")

    # Pending reviews
    ps_res = supabase.table("project_submissions").select("id", count="exact").eq("status", "submitted").execute()
    wr_res = supabase.table("weekly_reports").select("id", count="exact").eq("status", "submitted").execute()
    pending_reviews = (ps_res.count or 0) + (wr_res.count or 0)

    # Forms Pending
    fs_res = supabase.table("form_submissions").select("id", count="exact").eq("status", "submitted").execute()
    forms_pending = fs_res.count or 0

    # Meetings
    m_res = supabase.table("meetings").select("id", count="exact").gte("date", now_utc).execute()
    upcoming_meetings = m_res.count or 0

    # Events
    e_res = supabase.table("events").select("id", count="exact").execute()
    total_events = e_res.count or 0

    # Attendance
    att_res = supabase.table("attendance").select("status").eq("date", today).in_("status", ["present", "late"]).execute()
    present_today = len(att_res.data)
    absent_today = total_students - present_today
    attendance_percentage = round(present_today / total_students * 100, 1) if total_students > 0 else 0

    return AdminDashboardStats(
        total_students=total_students,
        total_teams=total_teams,
        total_projects=total_projects,
        active_projects=active_projects,
        completed_projects=completed_projects,
        pending_reviews=pending_reviews,
        students_present_today=present_today,
        students_absent_today=absent_today,
        attendance_percentage=attendance_percentage,
        forms_pending=forms_pending,
        upcoming_meetings=upcoming_meetings,
        total_events=total_events,
    )


@router.get("/student")
def student_dashboard(current_user: dict = Depends(get_current_user)):
    """Student's personal dashboard data."""
    supabase = get_supabase()
    user_id = current_user["id"]
    now_utc = datetime.now(timezone.utc).isoformat()
    
    student_res = supabase.table("students").select("*, team:teams!students_team_id_fkey(*)").eq("user_id", user_id).execute()
    student = student_res.data[0] if student_res.data else None
    
    project = None
    if student and student.get("team_id"):
        project_res = supabase.table("projects").select("*").eq("team_id", student["team_id"]).execute()
        project = project_res.data[0] if project_res.data else None

    # Attendance
    if student:
        att_res = supabase.table("attendance").select("status").eq("student_id", student["id"]).execute()
        att_total = len(att_res.data)
        att_present = sum(1 for a in att_res.data if a.get("status") in ["present", "late"])
        att_pct = round(att_present / att_total * 100, 1) if att_total > 0 else 0
    else:
        att_pct = 0.0

    # Forms
    f_res = supabase.table("dynamic_forms").select("id", count="exact").eq("is_active", True).execute()
    pending_forms = f_res.count or 0
    sub_res = supabase.table("form_submissions").select("id", count="exact").eq("user_id", user_id).execute()
    submitted_forms = sub_res.count or 0

    # Meetings
    m_res = supabase.table("meeting_invites").select("meeting_id").eq("user_id", user_id).execute()
    upcoming_meetings = 0
    if m_res.data:
        m_ids = [m["meeting_id"] for m in m_res.data]
        if m_ids:
            mtgs = supabase.table("meetings").select("id").gte("date", now_utc).in_("id", m_ids).execute()
            upcoming_meetings = len(mtgs.data)

    # Notifications
    notif_res = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    notifications = notif_res.data

    # Weekly Report
    latest_report = None
    if student:
        wr_res = supabase.table("weekly_reports").select("*").eq("student_id", student["id"]).order("submitted_at", desc=True).limit(1).execute()
        latest_report = wr_res.data[0] if wr_res.data else None

    return {
        "user": current_user,
        "student": student,
        "team": student.get("team") if student else None,
        "project": project,
        "attendance_percentage": att_pct,
        "weekly_progress": latest_report,
        "pending_forms": pending_forms - submitted_forms,
        "upcoming_meetings": upcoming_meetings,
        "recent_notifications": notifications,
    }


@router.get("/charts/attendance-trend")
def attendance_trend(current_user: dict = Depends(get_current_user)):
    """Attendance trend for last 7 days."""
    supabase = get_supabase()
    today = date.today()
    labels = []
    present_data = []
    absent_data = []
    
    students_res = supabase.table("users").select("id", count="exact").eq("is_active", True).eq("role_id", 2).execute()
    total_students = students_res.count or 0

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_iso = d.isoformat()
        labels.append(d.strftime("%a"))
        
        att_res = supabase.table("attendance").select("id", count="exact").eq("date", d_iso).in_("status", ["present", "late"]).execute()
        present = att_res.count or 0
        present_data.append(present)
        absent_data.append(total_students - present)

    return {
        "labels": labels,
        "datasets": [
            {"label": "Present", "data": present_data, "backgroundColor": "#10b981"},
            {"label": "Absent", "data": absent_data, "backgroundColor": "#ef4444"},
        ]
    }


@router.get("/charts/project-status")
def project_status_chart(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    statuses = ["planning", "ongoing", "completed", "on_hold"]
    counts = []
    
    res = supabase.table("projects").select("status").execute()
    all_statuses = [p.get("status") for p in res.data]
    
    for s in statuses:
        counts.append(all_statuses.count(s))

    return {
        "labels": ["Planning", "Ongoing", "Completed", "On Hold"],
        "datasets": [{"data": counts, "backgroundColor": ["#3b82f6", "#f59e0b", "#10b981", "#6b7280"]}]
    }


@router.get("/charts/department-distribution")
def department_chart(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    res = supabase.table("students").select("department").execute()
    
    depts = {}
    for r in res.data:
        d = r.get("department")
        if d:
            depts[d] = depts.get(d, 0) + 1
            
    colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#f97316"]
    return {
        "labels": list(depts.keys()),
        "datasets": [{
            "data": list(depts.values()),
            "backgroundColor": colors[:len(depts)]
        }]
    }
