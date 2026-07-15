from datetime import datetime, date, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

from app.core.supabase import get_supabase
from app.schemas import AdminDashboardStats


def admin_dashboard(current_user: dict) -> dict:
    supabase = get_supabase()
    today = date.today().isoformat()
    now_utc = datetime.now(timezone.utc).isoformat()

    def q_students():
        return supabase.table("users").select("id", count="exact").eq("is_active", True).eq("role_id", 2).execute()

    def q_teams():
        return supabase.table("teams").select("id", count="exact").execute()

    def q_projects():
        return supabase.table("projects").select("status").execute()

    def q_project_submissions():
        return supabase.table("project_submissions").select("id", count="exact").eq("status", "submitted").execute()

    def q_weekly_reports():
        return supabase.table("weekly_reports").select("id", count="exact").eq("status", "submitted").execute()

    def q_form_submissions():
        return supabase.table("form_submissions").select("id", count="exact").eq("status", "submitted").execute()

    def q_meetings():
        return supabase.table("meetings").select("id", count="exact").gte("date", now_utc).execute()

    def q_events():
        return supabase.table("events").select("id", count="exact").execute()

    def q_attendance():
        return supabase.table("attendance").select("status").eq("date", today).in_("status", ["present", "late"]).execute()

    def q_new_registrations():
        return supabase.table("students").select("id", count="exact").gte("created_at", today).execute()

    def q_unread_notifications():
        return supabase.table("notifications").select("id", count="exact").eq("user_id", current_user["id"]).eq("is_read", False).execute()

    with ThreadPoolExecutor(max_workers=11) as ex:
        f_students    = ex.submit(q_students)
        f_teams       = ex.submit(q_teams)
        f_projects    = ex.submit(q_projects)
        f_ps          = ex.submit(q_project_submissions)
        f_wr          = ex.submit(q_weekly_reports)
        f_fs          = ex.submit(q_form_submissions)
        f_meetings    = ex.submit(q_meetings)
        f_events      = ex.submit(q_events)
        f_attendance  = ex.submit(q_attendance)
        f_new_regs    = ex.submit(q_new_registrations)
        f_unread_notif= ex.submit(q_unread_notifications)

    total_students = f_students.result().count or 0
    total_teams    = f_teams.result().count or 0

    projects       = f_projects.result().data
    total_projects     = len(projects)
    active_projects    = sum(1 for p in projects if p.get("status") == "ongoing")
    completed_projects = sum(1 for p in projects if p.get("status") == "completed")

    pending_reviews = (f_ps.result().count or 0) + (f_wr.result().count or 0)
    forms_pending   = f_fs.result().count or 0
    upcoming_meetings = f_meetings.result().count or 0
    total_events    = f_events.result().count or 0

    present_today   = len(f_attendance.result().data)
    absent_today    = total_students - present_today
    attendance_pct  = round(present_today / total_students * 100, 1) if total_students > 0 else 0.0

    new_registrations_today = f_new_regs.result().count or 0
    unread_notifications = f_unread_notif.result().count or 0

    data = AdminDashboardStats(
        total_students=total_students,
        total_teams=total_teams,
        total_projects=total_projects,
        active_projects=active_projects,
        completed_projects=completed_projects,
        pending_reviews=pending_reviews,
        students_present_today=present_today,
        students_absent_today=absent_today,
        attendance_percentage=attendance_pct,
        forms_pending=forms_pending,
        upcoming_meetings=upcoming_meetings,
        total_events=total_events,
        unread_notifications=unread_notifications,
        new_registrations_today=new_registrations_today,
    )
    return data.model_dump()


def student_dashboard(current_user: dict) -> dict:
    supabase = get_supabase()
    user_id = current_user["id"]
    now_utc = datetime.now(timezone.utc).isoformat()

    student_res = supabase.table("students").select("*, team:teams!students_team_id_fkey(*)").eq("user_id", user_id).execute()
    student = student_res.data[0] if student_res.data else None

    student_id = student["id"] if student else None
    team_id    = student.get("team_id") if student else None

    def q_project():
        if not team_id:
            return None
        res = supabase.table("projects").select("*").eq("team_id", team_id).execute()
        return res.data[0] if res.data else None

    def q_attendance():
        if not student_id:
            return []
        return supabase.table("attendance").select("status").eq("student_id", student_id).execute().data

    def q_forms_total():
        return supabase.table("dynamic_forms").select("id", count="exact").eq("is_active", True).execute()

    def q_forms_submitted():
        return supabase.table("form_submissions").select("id", count="exact").eq("user_id", user_id).execute()

    def q_meeting_invites():
        return supabase.table("meeting_invites").select("meeting_id").eq("user_id", user_id).execute()

    def q_notifications():
        return supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()

    def q_latest_report():
        if not student_id:
            return None
        res = supabase.table("weekly_reports").select("*").eq("student_id", student_id).order("submitted_at", desc=True).limit(1).execute()
        return res.data[0] if res.data else None

    with ThreadPoolExecutor(max_workers=7) as ex:
        f_project      = ex.submit(q_project)
        f_attendance   = ex.submit(q_attendance)
        f_forms_total  = ex.submit(q_forms_total)
        f_forms_sub    = ex.submit(q_forms_submitted)
        f_invites      = ex.submit(q_meeting_invites)
        f_notifs       = ex.submit(q_notifications)
        f_report       = ex.submit(q_latest_report)

    att_data    = f_attendance.result()
    att_total   = len(att_data)
    att_present = sum(1 for a in att_data if a.get("status") in ["present", "late"])
    att_pct     = round(att_present / att_total * 100, 1) if att_total > 0 else 0.0

    pending_forms   = f_forms_total.result().count or 0
    submitted_forms = f_forms_sub.result().count or 0

    invites = f_invites.result().data
    upcoming_meetings = 0
    if invites:
        m_ids = [m["meeting_id"] for m in invites]
        if m_ids:
            mtgs = supabase.table("meetings").select("id").gte("date", now_utc).in_("id", m_ids).execute()
            upcoming_meetings = len(mtgs.data)

    return {
        "user": current_user,
        "student": student,
        "team": student.get("team") if student else None,
        "project": f_project.result(),
        "attendance_percentage": att_pct,
        "weekly_progress": f_report.result(),
        "pending_forms": pending_forms - submitted_forms,
        "upcoming_meetings": upcoming_meetings,
        "recent_notifications": f_notifs.result().data,
    }


def attendance_trend(current_user: dict) -> dict:
    supabase = get_supabase()
    today = date.today()

    start_date = (today - timedelta(days=6)).isoformat()
    end_date   = today.isoformat()

    students_res = supabase.table("users").select("id", count="exact").eq("is_active", True).eq("role_id", 2).execute()
    total_students = students_res.count or 0

    att_res = supabase.table("attendance").select("date, status").gte("date", start_date).lte("date", end_date).in_("status", ["present", "late"]).execute()

    present_by_date: dict = {}
    for record in att_res.data:
        d = record.get("date")
        if d:
            present_by_date[d] = present_by_date.get(d, 0) + 1

    labels = []
    present_data = []
    absent_data  = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_iso = d.isoformat()
        labels.append(d.strftime("%a"))
        present = present_by_date.get(d_iso, 0)
        present_data.append(present)
        absent_data.append(total_students - present)

    return {
        "labels": labels,
        "datasets": [
            {"label": "Present", "data": present_data, "backgroundColor": "#10b981"},
            {"label": "Absent",  "data": absent_data,  "backgroundColor": "#ef4444"},
        ]
    }


def project_status_chart(current_user: dict) -> dict:
    supabase = get_supabase()
    statuses = ["planning", "ongoing", "completed", "on_hold"]

    res = supabase.table("projects").select("status").execute()
    all_statuses = [p.get("status") for p in res.data]
    counts = [all_statuses.count(s) for s in statuses]

    return {
        "labels": ["Planning", "Ongoing", "Completed", "On Hold"],
        "datasets": [{"data": counts, "backgroundColor": ["#3b82f6", "#f59e0b", "#10b981", "#6b7280"]}]
    }


def department_chart(current_user: dict) -> dict:
    supabase = get_supabase()
    res = supabase.table("students").select("department").execute()

    depts: dict = {}
    for r in res.data:
        d = r.get("department")
        if d:
            depts[d] = depts.get(d, 0) + 1

    colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#f97316"]
    return {
        "labels": list(depts.keys()),
        "datasets": [{"data": list(depts.values()), "backgroundColor": colors[:len(depts)]}]
    }
