from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_roles
from app.schemas import EquipmentCreate, EquipmentUpdate, EquipmentOut, PaginatedResponse
from app.services import equipment_service
import math

router = APIRouter(prefix="/api/equipment", tags=["Equipment"])

@router.get("", response_model=PaginatedResponse)
def list_equipment(
    page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=100),
    search: str = Query(""), status: str = Query(""), category: str = Query(""),
    current_user: dict = Depends(get_current_user),
):
    result = equipment_service.list_equipment(page, size, search, status, category, current_user)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=math.ceil(result["total"] / result["size"]) if result["total"] > 0 else 0,
    )

@router.post("", response_model=EquipmentOut, status_code=201)
def create_equipment(data: EquipmentCreate,
    current_user: dict = Depends(require_roles("super_admin", "admin"))):
    return equipment_service.create_equipment(data, current_user)

@router.put("/{equip_id}", response_model=EquipmentOut)
def update_equipment(equip_id: int, data: EquipmentUpdate,
    current_user: dict = Depends(require_roles("super_admin", "admin"))):
    return equipment_service.update_equipment(equip_id, data, current_user)

@router.delete("/{equip_id}")
def delete_equipment(equip_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin"))):
    equipment_service.delete_equipment(equip_id, current_user)
    return {"message": "Equipment deleted"}
