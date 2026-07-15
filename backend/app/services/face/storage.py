"""
face/storage.py
─────────────────────────────────────────────────
Responsibility: Image storage on Google Drive.
  - Upload image bytes to Google Drive
  - Verify the file exists after upload
  - Confirm public permissions are set
  - Return (drive_file_id, public_url)

No database access. No face logic.
"""
import io
import logging
import time

logger = logging.getLogger("icms.face.storage")

MAX_FILE_SIZE   = 5 * 1024 * 1024  # 5 MB
MAX_ATTEMPTS    = 3
RETRY_DELAYS    = [0, 1, 2]        # seconds between retries


def upload_face_image(img_bytes: bytes, filename: str) -> tuple[str, str]:
    """
    Upload face image bytes to Google Drive and return (drive_file_id, public_url).

    Pipeline:
        1. Validate file size
        2. Upload with retry on transient errors
        3. Set public read permission
        4. Verify file exists (metadata check)
        5. Build and return public URL

    Raises:
        RuntimeError: on any unrecoverable failure — caller maps to HTTPException.
    """
    # Import here to avoid circular initialisation issues at module load
    from app.services.google_drive import drive_service

    if not drive_service:
        raise RuntimeError(
            "[Storage] Google Drive service not initialised. "
            "Check GOOGLE_CREDENTIALS_JSON environment variable."
        )

    if len(img_bytes) > MAX_FILE_SIZE:
        raise RuntimeError(
            f"[Storage] Image too large: {len(img_bytes)} bytes "
            f"(max {MAX_FILE_SIZE // (1024 * 1024)} MB)"
        )

    from googleapiclient.http import MediaIoBaseUpload
    from googleapiclient.errors import HttpError
    from app.services.google_drive import FOLDER_ID

    logger.info(f"[Storage] Uploading '{filename}' ({len(img_bytes)} bytes) to Google Drive …")

    for attempt in range(MAX_ATTEMPTS):
        if attempt > 0:
            time.sleep(RETRY_DELAYS[attempt])
            logger.debug(f"[Storage] Retry attempt {attempt + 1}/{MAX_ATTEMPTS}")

        try:
            media = MediaIoBaseUpload(
                io.BytesIO(img_bytes),
                mimetype="image/jpeg",
                resumable=True,
            )
            file_metadata = {"name": filename, "parents": [FOLDER_ID]}

            file = (
                drive_service.files()
                .create(body=file_metadata, media_body=media, fields="id")
                .execute()
            )
            file_id = file.get("id")
            if not file_id:
                raise RuntimeError("[Storage] Google Drive returned no file ID after upload")

            logger.debug(f"[Storage] File uploaded with ID={file_id}; setting public permission …")

            # Set public read permission
            drive_service.permissions().create(
                fileId=file_id,
                body={"type": "anyone", "role": "reader"},
            ).execute()

            # Verify the file exists
            meta = (
                drive_service.files()
                .get(fileId=file_id, fields="id,name,size")
                .execute()
            )
            if not meta.get("id"):
                raise RuntimeError("[Storage] Post-upload verification failed: file not found on Drive")

            public_url = f"https://drive.google.com/uc?id={file_id}"
            logger.info(
                f"[Storage] Upload verified ✓  file_id={file_id}  "
                f"url={public_url}  attempt={attempt + 1}"
            )
            return file_id, public_url

        except HttpError as e:
            status = e.resp.status
            logger.warning(f"[Storage] HttpError {status} on attempt {attempt + 1}: {e}")
            if status in (400, 401, 403, 404):
                raise RuntimeError(
                    f"[Storage] Permanent Google Drive error {status}: {e.reason}"
                ) from e
            if attempt == MAX_ATTEMPTS - 1:
                raise RuntimeError(
                    "[Storage] Exhausted all retries for Google Drive upload"
                ) from e

        except RuntimeError:
            raise

        except Exception as e:
            logger.warning(f"[Storage] Unexpected error on attempt {attempt + 1}: {e}", exc_info=True)
            if attempt == MAX_ATTEMPTS - 1:
                raise RuntimeError(
                    f"[Storage] Failed to upload image after {MAX_ATTEMPTS} attempts: {e}"
                ) from e

    raise RuntimeError("[Storage] Upload loop exhausted without success or explicit error")
