import os
import uuid
import logging
import traceback
from typing import Dict, Any

from app.core.config import settings
from app.core.exceptions import BusinessLogicError

logger = logging.getLogger("icms.uploads")


def upload_file(file_bytes: bytes, filename: str, current_user: dict) -> Dict[str, Any]:
    ext = os.path.splitext(filename or "file.jpg")[1] or ".jpg"
    new_filename = f"{uuid.uuid4().hex}{ext}"
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, new_filename)
    
    try:
        with open(filepath, "wb") as buffer:
            buffer.write(file_bytes)
    except Exception as e:
        raise BusinessLogicError(f"Could not save file locally: {str(e)}", status_code=500)

    try:
        from app.services.google_drive import upload_image_to_drive
        public_url = upload_image_to_drive(file_bytes, new_filename)
        
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            logger.warning(f"Could not delete temp file {filepath}: {e}")
            
        return {
            "file_url": public_url,
            "filename": new_filename,
            "storage": "google_drive",
        }
        
    except Exception as drive_err:
        with open("upload_error.txt", "w") as f:
            f.write(traceback.format_exc())
            
        logger.warning(f"Google Drive upload failed, keeping local file: {drive_err}")
        return {
            "file_url": f"/uploads/{new_filename}",
            "filename": new_filename,
            "storage": "local",
        }
