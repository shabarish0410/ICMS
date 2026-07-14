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


import time
from googleapiclient.errors import HttpError

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def upload_image_to_drive(img_bytes: bytes, filename: str) -> tuple[str, str]:
    """
    Uploads a raw byte array directly to Google Drive (in-memory streaming)
    and makes it publicly readable.
    
    Validations:
    - Size <= 5MB
    
    Retries:
    - 3 attempts with exponential backoff for transient errors (429, 5xx)
    
    Returns:
        tuple: (drive_file_id, public_url)
    Raises:
        HTTPException on permanent errors or exhaustive failures.
    """
    if not drive_service:
        logger.error("Cannot upload to Google Drive: credentials missing")
        raise HTTPException(status_code=500, detail="Google Drive service misconfigured")

    if len(img_bytes) > MAX_FILE_SIZE:
        logger.warning(f"File {filename} exceeds size limit: {len(img_bytes)} bytes")
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")

    # Retry configuration
    max_attempts = 3
    delays = [0, 1, 2]  # wait times for attempt 1, 2, 3

    for attempt in range(max_attempts):
        if attempt > 0:
            time.sleep(delays[attempt])

        try:
            # Stream image directly from memory
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

            public_url = f"https://drive.google.com/uc?id={file_id}"
            logger.info(f"Successfully uploaded {filename} to Google Drive (Attempt {attempt + 1})")
            return file_id, public_url

        except HttpError as e:
            status_code = e.resp.status
            logger.warning(f"Google Drive HTTP Error {status_code} during upload (Attempt {attempt + 1}): {e}")
            
            # Permanent errors (400, 401, 403, 404) should not be retried
            if status_code in (400, 401, 403, 404):
                logger.error(f"Permanent Google Drive error {status_code}: {e.reason}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Google Drive API rejected the request: {e.reason}"
                )
            
            # Transient errors (429, 500, 502, 503, 504) get retried
            if attempt == max_attempts - 1:
                logger.error(f"Exhausted all retries for Google Drive upload of {filename}")
                raise HTTPException(status_code=500, detail="Failed to upload image after multiple retries due to network issues.")

        except Exception as e:
            logger.warning(f"Unexpected error during Google Drive upload (Attempt {attempt + 1}): {e}")
            if attempt == max_attempts - 1:
                logger.exception(f"Exhausted all retries for Google Drive upload of {filename}")
                raise HTTPException(status_code=500, detail="Failed to upload image due to an internal server error.")
