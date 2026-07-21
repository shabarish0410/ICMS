from typing import Dict, Any, List
from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError
from app.schemas import UniformCreate, UniformUpdate
import uuid

def list_uniforms(department: str, gender: str, season: str, current_user: dict) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    query = supabase.table("uniforms").select("*")
    
    if department:
        query = query.eq("department", department)
    if gender:
        query = query.eq("gender", gender)
    if season:
        query = query.eq("season", season)
        
    res = query.order("id", desc=True).execute()
    return res.data

def get_active_uniforms(current_user: dict) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    res = supabase.table("uniforms").select("*").eq("is_active", True).execute()
    return res.data

def upload_uniform_image(file_bytes: bytes, filename: str, content_type: str, image_type: str, current_user: dict) -> Dict[str, str]:
    supabase = get_supabase()
    ext = filename.split(".")[-1]
    safe_name = f"{uuid.uuid4()}.{ext}"
    path = f"uniforms/{image_type}/{safe_name}"
    
    # Upload to Supabase storage bucket 'uniforms'
    supabase.storage.from_("uniforms").upload(path, file_bytes, {"content-type": content_type})
    url = supabase.storage.from_("uniforms").get_public_url(path)
    
    return {"url": url}

def create_uniform(req: UniformCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    data = req.model_dump()
    data["created_by"] = current_user.get("id")
    
    res = supabase.table("uniforms").insert(data).execute()
    return res.data[0] if res.data else {}

def update_uniform(uniform_id: int, req: UniformUpdate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("uniforms").select("id").eq("id", uniform_id).execute()
    if not existing.data:
        raise NotFoundError("Uniform entry not found")
        
    update_data = req.model_dump(exclude_unset=True)
    res = supabase.table("uniforms").update(update_data).eq("id", uniform_id).execute()
    return res.data[0] if res.data else {}

def delete_uniform(uniform_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("uniforms").select("id").eq("id", uniform_id).execute()
    if not existing.data:
        raise NotFoundError("Uniform entry not found")
        
    supabase.table("uniforms").delete().eq("id", uniform_id).execute()

def test_uniform_detection(data: dict, current_user: dict) -> Dict[str, Any]:
    """
    Test uniform detection endpoint.
    Placeholder for ML integration.
    """
    return {
        "valid": True,
        "confidence": 0.95,
        "reason": "Simulated successful detection (Service placeholder)",
        "details": {}
    }
