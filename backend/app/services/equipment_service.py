from typing import Dict, Any

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, BusinessLogicError
from app.schemas import EquipmentCreate, EquipmentUpdate


def list_equipment(page: int, size: int, search: str, status: str, category: str, current_user: dict) -> Dict[str, Any]:
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

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
    }


def create_equipment(data: EquipmentCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("equipment").insert(data.model_dump()).execute()
    if not res.data:
        raise BusinessLogicError("Failed to create equipment", status_code=500)
    return res.data[0]


def update_equipment(equip_id: int, data: EquipmentUpdate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("equipment").select("id").eq("id", equip_id).execute()
    if not existing.data:
        raise NotFoundError("Equipment not found")
        
    update_data = data.model_dump(exclude_unset=True)
    res = supabase.table("equipment").update(update_data).eq("id", equip_id).execute()
    return res.data[0]


def delete_equipment(equip_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("equipment").select("id").eq("id", equip_id).execute()
    if not existing.data:
        raise NotFoundError("Equipment not found")
        
    supabase.table("equipment").delete().eq("id", equip_id).execute()
