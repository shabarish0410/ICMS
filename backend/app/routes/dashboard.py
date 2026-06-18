from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, date, timezone, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    User, Student, Team, Project, Attendance, DynamicForm, FormSubmission,
    Meeting, WeeklyReport, Notification, Event, ProjectSubmission
)
from app.schemas import AdminDashboardStats, StudentDashboardData

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/admin", response_model=AdminDashboardStats)
def admin_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin dashboard analytics."""
    today = date.today()
    total_students = db.query(Student).join(User).filter(User.is_active == True).count()
    present_today = db.query(Attendance).filter(
        Attendance.date == today, Attendance.status.in_(["present", "late"])
    ).count()

    pending_reviews = db.query(ProjectSubmission).filter(ProjectSubmission.status == "submitted").count()
    pending_reviews += db.query(WeeklyReport).filter(WeeklyReport.status == "submitted").count()

    forms_pending = db.query(FormSubmission).filter(FormSubmission.status == "submitted").count()

    upcoming_meetings = db.query(Meeting).filter(Meeting.date >= datetime.now(timezone.utc)).count()

    return AdminDashboardStats(
        total_students=total_students,
        total_teams=db.query(Team).count(),
        total_projects=db.query(Project).count(),
        active_projects=db.query(Project).filter(Project.status == "ongoing").count(),
        completed_projects=db.query(Project).filter(Project.status == "completed").count(),
        pending_reviews=pending_reviews,
        students_present_today=present_today,
        students_absent_today=total_students - present_today,
        attendance_percentage=round(present_today / total_students * 100, 1) if total_students > 0 else 0,
        forms_pending=forms_pending,
        upcoming_meetings=upcoming_meetings,
        total_events=db.query(Event).count(),
    )


@router.get("/student")
def student_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Student's personal dashboard data."""
    student = db.query(Student).options(
        joinedload(Student.team), joinedload(Student.user)
    ).filter(Student.user_id == current_user.id).first()

    project = None
    if student and student.team_id:
        project = db.query(Project).filter(Project.team_id == student.team_id).first()

    # Attendance percentage
    att_total = db.query(Attendance).filter(Attendance.student_id == student.id).count() if student else 0
    att_present = db.query(Attendance).filter(
        Attendance.student_id == student.id, Attendance.status.in_(["present", "late"])
    ).count() if student else 0
    att_pct = round(att_present / att_total * 100, 1) if att_total > 0 else 0

    # Active forms count
    pending_forms = db.query(DynamicForm).filter(DynamicForm.is_active == True).count()
    submitted_forms = db.query(FormSubmission).filter(FormSubmission.user_id == current_user.id).count()

    # Upcoming meetings
    upcoming_meetings = db.query(Meeting).filter(
        Meeting.date >= datetime.now(timezone.utc),
        Meeting.invitees.any(User.id == current_user.id),
    ).count()

    # Recent notifications
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(5).all()

    # Latest weekly report
    latest_report = None
    if student:
        latest_report = db.query(WeeklyReport).filter(
            WeeklyReport.student_id == student.id
        ).order_by(WeeklyReport.submitted_at.desc()).first()

    from app.schemas import (
        UserOut, StudentOut, TeamOut, ProjectOut, NotificationOut, WeeklyReportOut
    )

    return {
        "user": UserOut.model_validate(current_user) if current_user else None,
        "student": StudentOut.model_validate(student) if student else None,
        "team": TeamOut.model_validate(student.team) if student and student.team else None,
        "project": ProjectOut.model_validate(project) if project else None,
        "attendance_percentage": att_pct,
        "weekly_progress": WeeklyReportOut.model_validate(latest_report) if latest_report else None,
        "pending_forms": pending_forms - submitted_forms,
        "upcoming_meetings": upcoming_meetings,
        "recent_notifications": [NotificationOut.model_validate(n) for n in notifications],
    }


@router.get("/charts/attendance-trend")
def attendance_trend(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Attendance trend for last 7 days."""
    today = date.today()
    labels = []
    present_data = []
    absent_data = []
    total_students = db.query(Student).join(User).filter(User.is_active == True).count()

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        labels.append(d.strftime("%a"))
        present = db.query(Attendance).filter(
            Attendance.date == d, Attendance.status.in_(["present", "late"])
        ).count()
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
def project_status_chart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    statuses = ["planning", "ongoing", "completed", "on_hold"]
    counts = []
    for s in statuses:
        counts.append(db.query(Project).filter(Project.status == s).count())

    return {
        "labels": ["Planning", "Ongoing", "Completed", "On Hold"],
        "datasets": [{"data": counts, "backgroundColor": ["#3b82f6", "#f59e0b", "#10b981", "#6b7280"]}]
    }


@router.get("/charts/department-distribution")
def department_chart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    depts = db.query(Student.department, db.query(Student).filter(Student.department == Student.department).correlate(Student).count()).group_by(Student.department).all()
    # Simpler approach
    from sqlalchemy import func
    result = db.query(Student.department, func.count(Student.id)).group_by(Student.department).all()

    return {
        "labels": [r[0] for r in result],
        "datasets": [{"data": [r[1] for r in result], "backgroundColor": ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"]}]
    }
