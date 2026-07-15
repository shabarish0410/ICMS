from fastapi import APIRouter, Depends, Query, UploadFile, File
from app.core.security import get_current_user, require_roles
from app.schemas import TeamCreate, TeamUpdate, TeamOut, PaginatedResponse
from app.services import team_service
from app.core.exceptions import ValidationError
import math

router = APIRouter(prefix="/api/teams", tags=["Teams"])

@router.get("", response_model=PaginatedResponse)
def list_teams(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    current_user: dict = Depends(get_current_user)
):
    """List all teams."""
    result = team_service.list_teams(page, size, search)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] else 0,
    )

@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    team_id: int, 
    current_user: dict = Depends(get_current_user)
):
    return team_service.get_team(team_id)

@router.post("", response_model=TeamOut, status_code=201)
def create_team(
    req: TeamCreate, 
    current_user: dict = Depends(require_roles("admin"))
):
    return team_service.create_team(req, current_user)

@router.post("/bulk-import")
async def bulk_import_teams(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("admin"))
):
    """Import teams via CSV/Excel upload."""
    if not file.filename.endswith(('.csv', '.xlsx', '.pdf')):
        raise ValidationError("Only CSV, Excel, or PDF files are allowed.")
        
    contents = await file.read()
    return team_service.bulk_import_teams(contents, file.filename, current_user)

@router.put("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int, 
    req: TeamUpdate, 
    current_user: dict = Depends(require_roles("admin"))
):
    return team_service.update_team(team_id, req, current_user)

@router.delete("/{team_id}")
def delete_team(
    team_id: int, 
    current_user: dict = Depends(require_roles("admin"))
):
    team_service.delete_team(team_id, current_user)
    return {"message": "Team deleted successfully"}

@router.get("/{team_id}/members")
def get_team_members(
    team_id: int, 
    current_user: dict = Depends(get_current_user)
):
    return team_service.get_team_members(team_id)
