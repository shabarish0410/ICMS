from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import uuid
from app.core.security import get_current_user
from app.models import User
from app.core.config import settings

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

@router.post("", status_code=201)
def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Generic endpoint to upload any file (image, PDF, DOCX, PPTX)."""
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Generate a unique, safe filename using UUID
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    
    try:
        # Save file locally
        with open(filepath, "wb") as buffer:
            buffer.write(file.file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
        
    return {
        "file_url": f"/uploads/{filename}",
        "filename": file.filename
    }
