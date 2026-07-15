from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import WeeklyReportCreate, WeeklyReportReview, WeeklyReportOut, PaginatedResponse
from app.services import weekly_report_service
import math

router = APIRouter(prefix="/api/weekly-reports", tags=["Weekly Reports"])


@router.get("", response_model=PaginatedResponse)
def list_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str = Query(""),
    current_user: dict = Depends(get_current_user)
):
    """List weekly reports. Student: own. Admin: all."""
    result = weekly_report_service.list_reports(page, size, status, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )


@router.post("", response_model=WeeklyReportOut, status_code=201)
def submit_report(req: WeeklyReportCreate, current_user: dict = Depends(get_current_user)):
    """Student submits a weekly report."""
    return weekly_report_service.submit_report(req, current_user)


@router.put("/{report_id}/review", response_model=WeeklyReportOut)
def review_report(
    report_id: int, req: WeeklyReportReview,
    current_user: dict = Depends(require_roles("admin"))
):
    """Admin reviews a weekly report."""
    return weekly_report_service.review_report(report_id, req, current_user)
