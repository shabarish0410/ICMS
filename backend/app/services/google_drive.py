import io
import os
import json
import logging
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from fastapi import HTTPException

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive"]
FOLDER_ID = "1eaDv57T3qb60LEISJcE2kByMd6VUFRwM"

BASE_DIR = Path(__file__).resolve().parents[2]   # backend/
SERVICE_ACCOUNT_FILE = BASE_DIR / "credentials" / "service-account.json"

credentials = None
drive_service = None

try:
    # 1. Try to load from Environment Variable (for Render deployment)
    if os.environ.get("GOOGLE_CREDENTIALS_JSON"):
        creds_info = json.loads(os.environ.get("GOOGLE_CREDENTIALS_JSON"))
        credentials = service_account.Credentials.from_service_account_info(
            creds_info, scopes=SCOPES
        )
    # 2. Fallback to local file (for Local development)
    elif SERVICE_ACCOUNT_FILE.exists():
        credentials = service_account.Credentials.from_service_account_file(
            str(SERVICE_ACCOUNT_FILE), scopes=SCOPES
        )
    
    if credentials:
        drive_service = build("drive", "v3", credentials=credentials)
        logger.info("Google Drive service initialized successfully.")
    else:
        logger.warning("Google Drive credentials not found. Drive uploads will fail.")
except Exception as e:
    logger.exception("Failed to initialize Google Drive service")


def upload_image_to_drive(img_bytes: bytes, filename: str) -> str:
    """
    Uploads a raw byte array directly to Google Drive (in-memory streaming)
    and makes it publicly readable.
    
    Returns the public Google Drive URL.
    Raises an Exception if the upload fails.
    """
    if not drive_service:
        logger.error("Cannot upload to Google Drive: credentials missing")
        raise HTTPException(status_code=500, detail="Storage service misconfigured")

    try:
        # Stream image directly from memory (no disk I/O)
        media = MediaIoBaseUpload(
            io.BytesIO(img_bytes),
            mimetype="image/jpeg",
            resumable=True,
        )

        file_metadata = {
            "name": filename,
            "parents": [FOLDER_ID],
        }

        # Execute the upload
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id",
        ).execute()

        file_id = file.get("id")
        if not file_id:
            raise ValueError("Google Drive did not return a file ID")

        # Make file publicly readable
        drive_service.permissions().create(
            fileId=file_id,
            body={
                "type": "anyone",
                "role": "reader",
            },
        ).execute()

        # Construct and return the public URL
        public_url = f"https://drive.google.com/uc?id={file_id}"
        return public_url

    except Exception as e:
        logger.exception(f"Google Drive upload failed for {filename}")
        raise HTTPException(status_code=500, detail="Failed to upload image to Google Drive")
