from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import Equipment, User, ActivityLog
from app.schemas import EquipmentCreate, EquipmentUpdate, EquipmentOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/equipment", tags=["Equipment"])


@router.get("", response_model=PaginatedResponse)
def list_equipment(
    page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=100),
    search: str = Query(""), status: str = Query(""), category: str = Query(""),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    query = db.query(Equipment)
    if search:
        query = query.filter(Equipment.name.ilike(f"%{search}%"))
    if status:
        query = query.filter(Equipment.status == status)
    if category:
        query = query.filter(Equipment.category == category)
    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return PaginatedResponse(
        items=[EquipmentOut.model_validate(e) for e in items],
        total=total, page=page, size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.post("", response_model=EquipmentOut, status_code=201)
def create_equipment(data: EquipmentCreate, db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin", "admin"))):
    equip = Equipment(**data.model_dump())
    db.add(equip)
    db.commit()
    db.refresh(equip)
    return equip


@router.put("/{equip_id}", response_model=EquipmentOut)
def update_equipment(equip_id: int, data: EquipmentUpdate, db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin", "admin"))):
    equip = db.query(Equipment).filter(Equipment.id == equip_id).first()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipment not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(equip, k, v)
    db.commit()
    db.refresh(equip)
    return equip


@router.delete("/{equip_id}")
def delete_equipment(equip_id: int, db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin", "admin"))):
    equip = db.query(Equipment).filter(Equipment.id == equip_id).first()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(equip)
    db.commit()
    return {"message": "Equipment deleted"}
