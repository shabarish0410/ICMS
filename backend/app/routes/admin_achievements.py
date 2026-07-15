from fastapi import APIRouter, Depends
from typing import Optional
from app.core.security import require_roles
from app.services.admin_achievement_service import (
    AchievementReview, list_all_achievements, review_achievement
)

router = APIRouter(prefix="/api/admin/achievements", tags=["Admin Achievements"])

@router.get("/")
def route_list_all_achievements(
    status: Optional[str] = None,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    return list_all_achievements(status, current_user)

@router.put("/{achievement_id}/review")
def route_review_achievement(
    achievement_id: int, 
    req: AchievementReview, 
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    return review_achievement(achievement_id, req, current_user)
