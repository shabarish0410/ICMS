from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import EquipmentCreate, EquipmentUpdate, EquipmentOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/equipment", tags=["Equipment"])


@router.get("", response_model=PaginatedResponse)
def list_equipment(
    page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=100),
    search: str = Query(""), status: str = Query(""), category: str = Query(""),
    current_user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    query = supabase.table("equipment").select("*", count="exact")

    if search:
        query = query.ilike("name", f"%{search}%")
    if status:
        query = query.eq("status", status)
    if category:
        query = query.eq("category", category)
        
    res = query.range((page - 1) * size, page * size - 1).execute()
    
    items = res.data
    total = res.count if res.count is not None else 0

    return PaginatedResponse(
        items=items,
        total=total, page=page, size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.post("", response_model=EquipmentOut, status_code=201)
def create_equipment(data: EquipmentCreate,
    current_user: dict = Depends(require_roles("super_admin", "admin"))):
    supabase = get_supabase()
    res = supabase.table("equipment").insert(data.model_dump()).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create equipment")
    return res.data[0]


@router.put("/{equip_id}", response_model=EquipmentOut)
def update_equipment(equip_id: int, data: EquipmentUpdate,
    current_user: dict = Depends(require_roles("super_admin", "admin"))):
    supabase = get_supabase()
    existing = supabase.table("equipment").select("id").eq("id", equip_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Equipment not found")
        
    update_data = data.model_dump(exclude_unset=True)
    res = supabase.table("equipment").update(update_data).eq("id", equip_id).execute()
    return res.data[0]


@router.delete("/{equip_id}")
def delete_equipment(equip_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin"))):
    supabase = get_supabase()
    existing = supabase.table("equipment").select("id").eq("id", equip_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Equipment not found")
        
    supabase.table("equipment").delete().eq("id", equip_id).execute()
    return {"message": "Equipment deleted"}
