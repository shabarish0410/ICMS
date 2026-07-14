"""
Uniform Management API Routes
Admin-only: Upload, manage, and test institutional uniform reference images.
GET    /api/uniforms             — List all uniforms
POST   /api/uniforms             — Create uniform entry (with image URLs)
PUT    /api/uniforms/{id}        — Update uniform entry
DELETE /api/uniforms/{id}        — Delete uniform entry
GET    /api/uniforms/active      — List active uniforms (for detection)
POST   /api/uniforms/test        — Test uniform detection against a live image
POST   /api/uniforms/upload-image — Upload an image to Supabase Storage, get URL back
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional, List
from datetime import datetime, timezone
import logging
import uuid

from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import UniformCreate, UniformUpdate, UniformOut

logger = logging.getLogger("icms.uniforms")
router = APIRouter(prefix="/api/uniforms", tags=["Uniforms"])


# ─── GET /api/uniforms ────────────────────────────────────────────────────────

@router.get("", status_code=200)
def list_uniforms(
    department: str = "",
    gender: str = "",
    season: str = "",
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """List all uniform entries with optional filters."""
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


# ─── GET /api/uniforms/active ─────────────────────────────────────────────────

@router.get("/active", status_code=200)
def get_active_uniforms(current_user: dict = Depends(get_current_user)):
    """Get all active uniforms for detection. Available to all authenticated users."""
    supabase = get_supabase()
    res = supabase.table("uniforms").select("*").eq("is_active", True).execute()
    return {"items": res.data, "total": len(res.data)}


# ─── POST /api/uniforms/upload-image ─────────────────────────────────────────

@router.post("/upload-image", status_code=201)
async def upload_uniform_image(
    file: UploadFile = File(...),
    image_type: str = Form("front"),  # front | back | side | logo
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """
    Upload a uniform reference image to Supabase Storage.
    Returns the public URL to use in create/update uniform endpoints.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="Image file too large (max 10 MB).")

    supabase = get_supabase()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"uniform_{image_type}_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        from app.services.google_drive import upload_image_to_drive
        public_url = upload_image_to_drive(file_bytes, filename)
        return {"success": True, "url": public_url, "filename": filename}
    except Exception as e:
        logger.error(f"Uniform image upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


# ─── POST /api/uniforms ───────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_uniform(
    req: UniformCreate,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Create a new uniform reference entry."""
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
        raise HTTPException(status_code=500, detail="Failed to create uniform entry.")
    logger.info(f"Uniform created: id={res.data[0]['id']} by admin={current_user.get('id')}")
    return res.data[0]


# ─── PUT /api/uniforms/{uniform_id} ──────────────────────────────────────────

@router.put("/{uniform_id}", status_code=200)
def update_uniform(
    uniform_id: int,
    req: UniformUpdate,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Update a uniform entry."""
    supabase = get_supabase()
    existing = supabase.table("uniforms").select("id").eq("id", uniform_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Uniform not found.")

    update_data = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = supabase.table("uniforms").update(update_data).eq("id", uniform_id).execute()
    return res.data[0] if res.data else {"success": True}


# ─── DELETE /api/uniforms/{uniform_id} ───────────────────────────────────────

@router.delete("/{uniform_id}", status_code=200)
def delete_uniform(
    uniform_id: int,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Delete a uniform entry."""
    supabase = get_supabase()
    existing = supabase.table("uniforms").select("id").eq("id", uniform_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Uniform not found.")
    supabase.table("uniforms").delete().eq("id", uniform_id).execute()
    logger.info(f"Uniform {uniform_id} deleted by admin={current_user.get('id')}")
    return {"success": True, "message": "Uniform deleted successfully."}


# ─── POST /api/uniforms/test ──────────────────────────────────────────────────

@router.post("/test", status_code=200)
def test_uniform_detection(
    data: dict,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """
    Admin: Test uniform detection against a submitted image.
    Body: { "image_base64": "...", "department": "all" }
    """
    from app.services.face_service import decode_base64_image
    from app.services.ai_service import verify_uniform_with_reference

    image_b64 = data.get("image_base64")
    department = data.get("department", "all")

    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 is required.")

    try:
        img_bytes = decode_base64_image(image_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    result = verify_uniform_with_reference(img_bytes, department=department)
    return result
