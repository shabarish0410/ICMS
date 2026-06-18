from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, date, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, Attendance, Student
from app.schemas import AttendanceMarkRequest, AdminAttendanceMarkRequest, AttendanceOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.post("/mark", response_model=AttendanceOut, status_code=201)
def mark_attendance(
    req: AttendanceMarkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark attendance for today. Student marks their own attendance."""
    if not current_user.student:
        raise HTTPException(status_code=403, detail="Only students can mark attendance")

    today = date.today()
    existing = db.query(Attendance).filter(
        Attendance.student_id == current_user.student.id,
        Attendance.date == today,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked for today")

    attendance = Attendance(
        student_id=current_user.student.id,
        date=today,
        check_in_time=datetime.now(timezone.utc),
        method=req.method,
        status="present",
        photo_url=req.photo_url,
    )
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance


@router.get("", response_model=PaginatedResponse)
def list_attendance(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    date_filter: str = Query("", description="Filter by date (YYYY-MM-DD)"),
    department: str = Query(""),
    team_id: int = Query(None),
    student_id: int = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List attendance. Student: own. Admin: all with filters."""
    q = db.query(Attendance).options(joinedload(Attendance.student).joinedload(Student.user))

    if current_user.role.name == "student" and current_user.student:
        q = q.filter(Attendance.student_id == current_user.student.id)
    else:
        if student_id:
            q = q.filter(Attendance.student_id == student_id)
        if department:
            q = q.join(Student).filter(Student.department == department)
        if team_id:
            q = q.join(Student).filter(Student.team_id == team_id)

    if date_filter:
        try:
            d = datetime.strptime(date_filter, "%Y-%m-%d").date()
            q = q.filter(Attendance.date == d)
        except ValueError:
            pass

    total = q.count()
    records = q.order_by(Attendance.date.desc()).offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[AttendanceOut.model_validate(r) for r in records],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/stats")
def attendance_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attendance statistics."""
    today = date.today()
    total_students = db.query(Student).join(User).filter(User.is_active == True).count()

    if current_user.role.name == "student" and current_user.student:
        # Student's own stats
        total_days = db.query(Attendance).filter(Attendance.student_id == current_user.student.id).count()
        present = db.query(Attendance).filter(
            Attendance.student_id == current_user.student.id, Attendance.status == "present"
        ).count()
        late = db.query(Attendance).filter(
            Attendance.student_id == current_user.student.id, Attendance.status == "late"
        ).count()
        percentage = (present + late) / total_days * 100 if total_days > 0 else 0

        today_marked = db.query(Attendance).filter(
            Attendance.student_id == current_user.student.id, Attendance.date == today
        ).first()

        return {
            "total_days": total_days,
            "present": present,
            "late": late,
            "absent": total_days - present - late,
            "percentage": round(percentage, 1),
            "today_marked": today_marked is not None,
        }
    else:
        # Admin stats
        present_today = db.query(Attendance).filter(
            Attendance.date == today, Attendance.status.in_(["present", "late"])
        ).count()
        late_today = db.query(Attendance).filter(
            Attendance.date == today, Attendance.status == "late"
        ).count()

        return {
            "total_students": total_students,
            "present_today": present_today,
            "absent_today": total_students - present_today,
            "late_today": late_today,
            "attendance_percentage": round(present_today / total_students * 100, 1) if total_students > 0 else 0,
        }


@router.get("/monthly")
def monthly_attendance(
    month: int = Query(None, ge=1, le=12),
    year: int = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get monthly attendance summary."""
    from datetime import date as d_type
    now = datetime.now()
    m = month or now.month
    y = year or now.year

    q = db.query(Attendance).filter(
        Attendance.date >= d_type(y, m, 1),
    )
    if m == 12:
        q = q.filter(Attendance.date < d_type(y + 1, 1, 1))
    else:
        q = q.filter(Attendance.date < d_type(y, m + 1, 1))

    if current_user.role.name == "student" and current_user.student:
        q = q.filter(Attendance.student_id == current_user.student.id)

    records = q.all()
    days = {}
    for r in records:
        day_str = r.date.isoformat()
        if day_str not in days:
            days[day_str] = {"present": 0, "absent": 0, "late": 0}
        days[day_str][r.status] = days[day_str].get(r.status, 0) + 1

    return {"month": m, "year": y, "days": days}


@router.post("/admin/mark", response_model=AttendanceOut)
def admin_mark_attendance(
    req: AdminAttendanceMarkRequest,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Mark or update attendance for any student on a given date (Admin only)."""
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(Attendance).filter(
        Attendance.student_id == req.student_id,
        Attendance.date == req.date,
    ).first()

    if existing:
        existing.status = req.status
        existing.method = req.method
        if req.status == "absent":
            existing.check_in_time = None
        elif not existing.check_in_time:
            existing.check_in_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        check_in = None
        if req.status in ["present", "late"]:
            check_in = datetime.now(timezone.utc)
        
        attendance = Attendance(
            student_id=req.student_id,
            date=req.date,
            check_in_time=check_in,
            method=req.method,
            status=req.status,
        )
        db.add(attendance)
        db.commit()
        db.refresh(attendance)
        return attendance

