from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import AnnouncementCreate, AnnouncementOut, PaginatedResponse
from app.services import announcement_service
import math

router = APIRouter(prefix="/api/announcements", tags=["Announcements"])

@router.get("", response_model=PaginatedResponse)
def list_announcements(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """List announcements. Filters expired ones for students."""
    result = announcement_service.list_announcements(page, size, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )

@router.post("", response_model=AnnouncementOut, status_code=201)
def create_announcement(req: AnnouncementCreate, current_user: dict = Depends(require_roles("admin"))):
    return announcement_service.create_announcement(req, current_user)

@router.put("/{ann_id}", response_model=AnnouncementOut)
def update_announcement(ann_id: int, req: AnnouncementCreate, current_user: dict = Depends(require_roles("admin"))):
    return announcement_service.update_announcement(ann_id, req, current_user)

@router.delete("/{ann_id}")
def delete_announcement(ann_id: int, current_user: dict = Depends(require_roles("admin"))):
    announcement_service.delete_announcement(ann_id, current_user)
    return {"message": "Announcement deleted successfully"}
