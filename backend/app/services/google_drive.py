from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

import io
import os
from datetime import datetime

SCOPES = ["https://www.googleapis.com/auth/drive"]

SERVICE_ACCOUNT_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "credentials",
    "service-account.json",
)

# Replace this with your Google Drive folder ID
FOLDER_ID = "1iIe2I0XwY6_w7JMN_Dg_DaDDkY1jqPza"

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=SCOPES,
)

drive_service = build("drive", "v3", credentials=credentials)


def upload_attendance_image(img_bytes, filename):
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
