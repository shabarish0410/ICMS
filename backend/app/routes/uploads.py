from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import uuid
from app.core.security import get_current_user
from app.core.config import settings
from app.core.supabase import get_supabase

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

# Supabase Storage bucket name for attendance snapshots
SNAPSHOT_BUCKET = "attendance-photos"

@router.post("", status_code=201)
def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file to Supabase Storage and return the public URL."""
    # Generate a unique, safe filename using UUID
    ext = os.path.splitext(file.filename or "file.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    
    file_bytes = file.file.read()
    
    # ── Try Supabase Storage first ────────────────────────────────────────────
    try:
        supabase = get_supabase()
        
        # Upload to Supabase Storage
        res = supabase.storage.from_(SNAPSHOT_BUCKET).upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": file.content_type or "image/jpeg", "upsert": "false"},
        )
        
        # Get public URL
        public_url = supabase.storage.from_(SNAPSHOT_BUCKET).get_public_url(filename)
        
        return {
            "file_url": public_url,
            "filename": filename,
            "storage": "supabase",
        }
        
    except Exception as supabase_err:
        print(f"⚠️ Supabase Storage upload failed, falling back to local: {supabase_err}")
    
    # ── Fallback: save locally ────────────────────────────────────────────────
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    
    try:
        with open(filepath, "wb") as buffer:
            buffer.write(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
        
    return {
        "file_url": f"/uploads/{filename}",
        "filename": filename,
        "storage": "local",
    }
