from fastapi import APIRouter, Depends, UploadFile, File, Form
from app.core.security import get_current_user, require_roles
from app.schemas import UniformCreate, UniformUpdate
from app.services import uniform_service

router = APIRouter(prefix="/api/uniforms", tags=["Uniforms"])

@router.get("", status_code=200)
def list_uniforms(
    department: str = "",
    gender: str = "",
    season: str = "",
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """List all uniform entries with optional filters."""
    return uniform_service.list_uniforms(department, gender, season, current_user)


@router.get("/active", status_code=200)
def get_active_uniforms(current_user: dict = Depends(get_current_user)):
    """Get all active uniforms for detection. Available to all authenticated users."""
    return uniform_service.get_active_uniforms(current_user)


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
    file_bytes = await file.read()
    return uniform_service.upload_uniform_image(file_bytes, file.filename, file.content_type, image_type, current_user)


@router.post("", status_code=201)
def create_uniform(
    req: UniformCreate,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Create a new uniform reference entry."""
    return uniform_service.create_uniform(req, current_user)


@router.put("/{uniform_id}", status_code=200)
def update_uniform(
    uniform_id: int,
    req: UniformUpdate,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Update a uniform entry."""
    return uniform_service.update_uniform(uniform_id, req, current_user)


@router.delete("/{uniform_id}", status_code=200)
def delete_uniform(
    uniform_id: int,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Delete a uniform entry."""
    uniform_service.delete_uniform(uniform_id, current_user)
    return {"success": True, "message": "Uniform deleted successfully."}


@router.post("/test", status_code=200)
def test_uniform_detection(
    data: dict,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """
    Admin: Test uniform detection against a submitted image.
    """
    return uniform_service.test_uniform_detection(data, current_user)
