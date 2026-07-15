from typing import Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, ValidationError, BusinessLogicError
from app.schemas import UniformCreate, UniformUpdate
from app.services.google_drive import upload_image_to_drive

logger = logging.getLogger("icms.uniforms")


def list_uniforms(department: str, gender: str, season: str, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("uniforms").select("*")
    if department:
        query = query.eq("department", department)
    if gender:
        query = query.eq("gender", gender)
    if season:
        query = query.eq("season", season)
    res = query.order("created_at", desc=True).execute()
    return {"items": res.data, "total": len(res.data)}


def get_active_uniforms(current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("uniforms").select("*").eq("is_active", True).execute()
    return {"items": res.data, "total": len(res.data)}


def upload_uniform_image(file_bytes: bytes, filename: str, content_type: str, image_type: str, current_user: dict) -> Dict[str, Any]:
    if not content_type or not content_type.startswith("image/"):
        raise ValidationError("Only image files are allowed.")

    if len(file_bytes) > 10 * 1024 * 1024:
        raise ValidationError("Image file too large (max 10 MB).")

    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    new_filename = f"uniform_{image_type}_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        public_url = upload_image_to_drive(file_bytes, new_filename)
        return {"success": True, "url": public_url, "filename": new_filename}
    except Exception as e:
        logger.error(f"Uniform image upload failed: {e}")
        raise BusinessLogicError(f"Upload failed: {e}", status_code=500)


def create_uniform(req: UniformCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    data = {
        "department": req.department,
        "gender": req.gender,
        "season": req.season,
        "label": req.label,
        "front_image_url": req.front_image_url,
        "back_image_url": req.back_image_url,
        "side_image_url": req.side_image_url,
        "logo_image_url": req.logo_image_url,
        "is_active": req.is_active,
        "created_by": current_user.get("id"),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    res = supabase.table("uniforms").insert(data).execute()
    if not res.data:
        raise BusinessLogicError("Failed to create uniform entry.", status_code=500)
    logger.info(f"Uniform created: id={res.data[0]['id']} by admin={current_user.get('id')}")
    return res.data[0]


def update_uniform(uniform_id: int, req: UniformUpdate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("uniforms").select("id").eq("id", uniform_id).execute()
    if not existing.data:
        raise NotFoundError("Uniform not found.")

    update_data = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = supabase.table("uniforms").update(update_data).eq("id", uniform_id).execute()
    return res.data[0] if res.data else {"success": True}


def delete_uniform(uniform_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("uniforms").select("id").eq("id", uniform_id).execute()
    if not existing.data:
        raise NotFoundError("Uniform not found.")
    supabase.table("uniforms").delete().eq("id", uniform_id).execute()
    logger.info(f"Uniform {uniform_id} deleted by admin={current_user.get('id')}")


def test_uniform_detection(data: dict, current_user: dict) -> Dict[str, Any]:
    from app.services.face_service import decode_base64_image
    from app.services.ai_service import verify_uniform_with_reference

    image_b64 = data.get("image_base64")
    department = data.get("department", "all")

    if not image_b64:
        raise ValidationError("image_base64 is required.")

    try:
        img_bytes = decode_base64_image(image_b64)
    except Exception as e:
        raise ValidationError(f"Invalid image: {e}")

    result = verify_uniform_with_reference(img_bytes, department=department)
    return result
