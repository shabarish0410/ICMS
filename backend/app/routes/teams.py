from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, Team, Student
from app.schemas import TeamCreate, TeamUpdate, TeamOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/teams", tags=["Teams"])


@router.get("", response_model=PaginatedResponse)
def list_teams(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all teams."""
    q = db.query(Team)
    if search:
        q = q.filter(Team.name.ilike(f"%{search}%"))

    total = q.count()
    teams = q.offset((page - 1) * size).limit(size).all()

    items = []
    for t in teams:
        out = TeamOut.model_validate(t)
        out.member_count = db.query(Student).filter(Student.team_id == t.id).count()
        items.append(out)

    return PaginatedResponse(
        items=items, total=total, page=page, size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{team_id}", response_model=TeamOut)
def get_team(team_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    out = TeamOut.model_validate(team)
    out.member_count = db.query(Student).filter(Student.team_id == team.id).count()
    return out


@router.post("", response_model=TeamOut, status_code=201)
def create_team(req: TeamCreate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    existing = db.query(Team).filter(Team.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")
    team = Team(**req.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    out = TeamOut.model_validate(team)
    out.member_count = 0
    return out


@router.put("/{team_id}", response_model=TeamOut)
def update_team(team_id: int, req: TeamUpdate, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(team, key, value)
    db.commit()
    db.refresh(team)
    out = TeamOut.model_validate(team)
    out.member_count = db.query(Student).filter(Student.team_id == team.id).count()
    return out


@router.delete("/{team_id}")
def delete_team(team_id: int, current_user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    db.commit()
    return {"message": "Team deleted successfully"}


@router.get("/{team_id}/members")
def get_team_members(team_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    members = db.query(Student).options(joinedload(Student.user)).filter(Student.team_id == team_id).all()
    return [{"id": s.id, "user_id": s.user_id, "name": s.user.full_name, "ic_number": s.user.ic_number, "department": s.department} for s in members]
