from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user
from app.schemas import PaginatedResponse
from app.services import notification_service
import math

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("", response_model=PaginatedResponse)
def list_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    result = notification_service.list_notifications(page, size, unread_only, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] > 0 else 0,
    )

@router.get("/unread-count")
def unread_count(current_user: dict = Depends(get_current_user)):
    return notification_service.unread_count(current_user)

@router.put("/{notif_id}/read")
def mark_read(notif_id: int, current_user: dict = Depends(get_current_user)):
    notification_service.mark_read(notif_id, current_user)
    return {"message": "Marked as read"}

@router.put("/read-all")
def mark_all_read(current_user: dict = Depends(get_current_user)):
    notification_service.mark_all_read(current_user)
    return {"message": "All notifications marked as read"}
