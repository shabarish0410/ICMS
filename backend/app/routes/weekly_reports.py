from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, WeeklyReport, Student
from app.schemas import WeeklyReportCreate, WeeklyReportReview, WeeklyReportOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/weekly-reports", tags=["Weekly Reports"])


@router.get("", response_model=PaginatedResponse)
def list_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List weekly reports. Student: own. Admin: all."""
    q = db.query(WeeklyReport).options(joinedload(WeeklyReport.student).joinedload(Student.user))

    if current_user.role.name == "student" and current_user.student:
        q = q.filter(WeeklyReport.student_id == current_user.student.id)

    if status:
        q = q.filter(WeeklyReport.status == status)

    total = q.count()
    reports = q.order_by(WeeklyReport.submitted_at.desc()).offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[WeeklyReportOut.model_validate(r) for r in reports],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.post("", response_model=WeeklyReportOut, status_code=201)
def submit_report(req: WeeklyReportCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Student submits a weekly report."""
    if not current_user.student:
        raise HTTPException(status_code=403, detail="Only students can submit weekly reports")

    # Check if already submitted this week
    existing = db.query(WeeklyReport).filter(
        WeeklyReport.student_id == current_user.student.id,
        WeeklyReport.week_number == req.week_number,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Week {req.week_number} report already submitted")

    report = WeeklyReport(student_id=current_user.student.id, **req.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return db.query(WeeklyReport).options(
        joinedload(WeeklyReport.student).joinedload(Student.user)
    ).filter(WeeklyReport.id == report.id).first()


@router.put("/{report_id}/review", response_model=WeeklyReportOut)
def review_report(
    report_id: int, req: WeeklyReportReview,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin reviews a weekly report."""
    report = db.query(WeeklyReport).filter(WeeklyReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = req.status
    report.admin_comments = req.admin_comments
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return db.query(WeeklyReport).options(
        joinedload(WeeklyReport.student).joinedload(Student.user)
    ).filter(WeeklyReport.id == report.id).first()
