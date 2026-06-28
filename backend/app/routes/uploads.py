from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import uuid
from app.core.security import get_current_user
from app.core.config import settings
from app.core.supabase import get_supabase
import io

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

    # 2. Try to upload the local file to Supabase
    try:
        supabase = get_supabase()
        
        # Pass the string filepath instead of BytesIO
        res = supabase.storage.from_(SNAPSHOT_BUCKET).upload(
            path=filename,
            file=filepath,
            file_options={"content-type": file.content_type or "image/jpeg", "upsert": "false"},
        )
        
        public_url = supabase.storage.from_(SNAPSHOT_BUCKET).get_public_url(filename)
        
        return {
            "file_url": public_url,
            "filename": filename,
            "storage": "supabase",
        }
        
    except Exception as supabase_err:
        import traceback
        with open("upload_error.txt", "w") as f:
            f.write(traceback.format_exc())
            
        print(f"⚠️ Supabase Storage upload failed, using local: {supabase_err}")
        return {
            "file_url": f"/uploads/{filename}",
            "filename": filename,
            "storage": "local",
        }

