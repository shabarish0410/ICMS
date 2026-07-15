from fastapi import APIRouter, Depends
from app.core.security import require_roles
from app.services.achievement_service import (
    AchievementCreate, AchievementUpdate, 
    create_achievement, list_my_achievements, 
    update_achievement, delete_achievement
)

router = APIRouter(prefix="/api/achievements", tags=["Achievements"])

@router.post("/", status_code=201)
def route_create_achievement(req: AchievementCreate, current_user: dict = Depends(require_roles("student"))):
    return create_achievement(req, current_user)

@router.get("/")
def route_list_my_achievements(current_user: dict = Depends(require_roles("student"))):
    return list_my_achievements(current_user)

@router.put("/{achievement_id}")
def route_update_achievement(achievement_id: int, req: AchievementUpdate, current_user: dict = Depends(require_roles("student"))):
    return update_achievement(achievement_id, req, current_user)

@router.delete("/{achievement_id}")
def route_delete_achievement(achievement_id: int, current_user: dict = Depends(require_roles("student"))):
    delete_achievement(achievement_id, current_user)
    return {"message": "Deleted successfully"}
