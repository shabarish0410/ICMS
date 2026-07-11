from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

import io
import os
from datetime import datetime

import json
import logging

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive"]

SERVICE_ACCOUNT_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "credentials",
    "service-account.json",
)

# Replace this with your Google Drive folder ID
FOLDER_ID = "1iIe2I0XwY6_w7JMN_Dg_DaDDkY1jqPza"

credentials = None
drive_service = None

try:
    # 1. Try to load from Environment Variable (for Render)
    if os.environ.get("GOOGLE_CREDENTIALS_JSON"):
        creds_info = json.loads(os.environ.get("GOOGLE_CREDENTIALS_JSON"))
        credentials = service_account.Credentials.from_service_account_info(
            creds_info, scopes=SCOPES
        )
    # 2. Fallback to local file
    elif os.path.exists(SERVICE_ACCOUNT_FILE):
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES
        )
    
    if credentials:
        drive_service = build("drive", "v3", credentials=credentials)
    else:
        logger.warning("Google Drive credentials not found. Drive uploads will be disabled.")
except Exception as e:
    logger.error(f"Failed to initialize Google Drive service: {e}")


def upload_attendance_image(img_bytes, filename):
    if not drive_service:
        logger.error("Cannot upload to Google Drive: credentials missing")
        return None, None

    media = MediaIoBaseUpload(
        io.BytesIO(img_bytes),
        mimetype="image/jpeg",
        resumable=True,
    )

    file_metadata = {
        "name": filename,
        "parents": [FOLDER_ID],
    }

    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id",
    ).execute()

    file_id = file["id"]

    # Make file public
    drive_service.permissions().create(
        fileId=file_id,
        body={
            "type": "anyone",
            "role": "reader",
        },
    ).execute()

    public_url = f"https://drive.google.com/uc?id={file_id}"

    return file_id, public_url
