from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import uuid
from app.core.security import get_current_user
from app.core.config import settings
from app.core.supabase import get_supabase
import io
import logging

logger = logging.getLogger("icms.uploads")

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

# Supabase Storage bucket name for attendance snapshots
SNAPSHOT_BUCKET = "attendance-photos"

@router.post("", status_code=201)
def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file, saving locally first, then pushing to Supabase Storage."""
    ext = os.path.splitext(file.filename or "file.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    
    file_bytes = file.file.read()
    
    # 1. ALWAYS save locally first to guarantee we have a file path
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    
    try:
        with open(filepath, "wb") as buffer:
            buffer.write(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file locally: {str(e)}")

    # 2. Upload to Google Drive using in-memory file_bytes
    try:
        from app.services.google_drive import upload_image_to_drive
        public_url = upload_image_to_drive(file_bytes, filename)
        
        # Cleanup local file since upload was successful
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            logger.warning(f"Could not delete temp file {filepath}: {e}")
            
        return {
            "file_url": public_url,
            "filename": filename,
            "storage": "google_drive",
        }
        
    except Exception as drive_err:
        import traceback
        with open("upload_error.txt", "w") as f:
            f.write(traceback.format_exc())
            
        print(f"⚠️ Google Drive upload failed, keeping local file: {drive_err}")
        return {
            "file_url": f"/uploads/{filename}",
            "filename": filename,
            "storage": "local",
        }

