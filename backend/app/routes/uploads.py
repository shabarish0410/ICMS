from fastapi import APIRouter, Depends, UploadFile, File
from app.core.security import get_current_user
from app.services import upload_service

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

@router.post("", status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file, saving locally first, then pushing to Google Drive Storage."""
    file_bytes = await file.read()
    return upload_service.upload_file(file_bytes, file.filename, current_user)
