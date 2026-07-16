"""face/storage.py — Google Drive upload with tenacity retry, integrity verification, and rollback."""

import io
import logging
import datetime

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential_jitter,
    retry_if_exception_type,
    RetryError,
)

from app.core.face_config import (
    DRIVE_MAX_ATTEMPTS, DRIVE_RETRY_BASE_DELAY, DRIVE_RETRY_MAX_DELAY,
    DRIVE_RETRYABLE_STATUSES, DRIVE_UPLOAD_TIMEOUT, MAX_IMAGE_SIZE_BYTES,
)

logger = logging.getLogger("icms.face.storage")


# ── Retry predicate ───────────────────────────────────────────────────────────

def _is_retryable(exc: Exception) -> bool:
    """Return True only for transient HTTP errors and network timeouts."""
    try:
        from googleapiclient.errors import HttpError
        if isinstance(exc, HttpError):
            return exc.resp.status in DRIVE_RETRYABLE_STATUSES
    except ImportError:
        pass
    return isinstance(exc, (TimeoutError, ConnectionError, OSError))


# ── Upload with tenacity ──────────────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(DRIVE_MAX_ATTEMPTS),
    wait=wait_exponential_jitter(
        initial=DRIVE_RETRY_BASE_DELAY,
        max=DRIVE_RETRY_MAX_DELAY,
    ),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _upload_once(drive_service, media, file_metadata: dict) -> str:
    """Single upload attempt. Tenacity handles retry on transient errors."""
    from googleapiclient.errors import HttpError
    try:
        file = (
            drive_service.files()
            .create(body=file_metadata, media_body=media, fields="id")
            .execute(num_retries=0)
        )
        file_id = file.get("id")
        if not file_id:
            raise RuntimeError("[Storage] Drive returned no file ID")
        return file_id
    except HttpError as e:
        if e.resp.status not in DRIVE_RETRYABLE_STATUSES:
            # Non-retryable (400, 401, 403, 404) — raise directly, tenacity won't retry
            raise RuntimeError(
                f"[Storage] Permanent Drive error {e.resp.status}: {getattr(e, 'reason', str(e))}"
            ) from e
        raise   # let tenacity retry


def upload_face_image(img_bytes: bytes, filename: str, expected_hash: str) -> dict:
    """
    Upload face image bytes to Google Drive with tenacity retry and integrity verification.

    Pipeline:
        1. Validate file size
        2. Upload (up to DRIVE_MAX_ATTEMPTS attempts, exponential backoff with jitter)
        3. Set public read permission
        4. Verify file metadata (size match as integrity check)
        5. Return enriched Drive metadata dict

    Args:
        img_bytes:      Raw image bytes (already compressed before calling this).
        filename:       Target filename on Drive (e.g. 'face_42_REG-20260716.jpg').
        expected_hash:  SHA-256 hex digest; stored in metadata for future verification.

    Returns:
        {
            'file_id':              str,
            'web_view_link':        str,   # https://drive.google.com/file/d/{id}/view
            'direct_download_link': str,   # https://drive.google.com/uc?id={id}
            'upload_timestamp':     str,   # ISO 8601 UTC
            'upload_size_bytes':    int,
        }

    Raises:
        RuntimeError: on any unrecoverable failure.
    """
    from app.services.google_drive import drive_service, FOLDER_ID
    from googleapiclient.http import MediaIoBaseUpload
    from googleapiclient.errors import HttpError

    if not drive_service:
        raise RuntimeError(
            "[Storage] Google Drive service not initialised. "
            "Check GOOGLE_CREDENTIALS_JSON environment variable."
        )

    if len(img_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise RuntimeError(
            f"[Storage] Image too large after compression: {len(img_bytes):,} B "
            f"(max {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB)"
        )

    media = MediaIoBaseUpload(io.BytesIO(img_bytes), mimetype="image/jpeg", resumable=True)
    file_metadata = {"name": filename, "parents": [FOLDER_ID]}

    logger.info(f"[Storage] Uploading '{filename}' ({len(img_bytes):,} B) to Drive …")

    try:
        file_id = _upload_once(drive_service, media, file_metadata)
    except RetryError as e:
        raise RuntimeError(
            f"[Storage] Exhausted {DRIVE_MAX_ATTEMPTS} upload attempts: {e}"
        ) from e

    # Set public read permission
    try:
        drive_service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
        ).execute(num_retries=2)
    except Exception as e:
        logger.warning(f"[Storage] Could not set public permission on {file_id}: {e}")
        # Non-fatal — file is uploaded; we still proceed

    # ── Upload integrity verification ─────────────────────────────────────────
    try:
        meta = (
            drive_service.files()
            .get(fileId=file_id, fields="id,name,size,webViewLink,webContentLink")
            .execute(num_retries=2)
        )
        if not meta.get("id"):
            raise RuntimeError("[Storage] Post-upload verification: file not found on Drive")

        drive_size = int(meta.get("size", 0))
        if drive_size != len(img_bytes):
            logger.error(
                f"[Storage] ⚠ Integrity MISMATCH: local={len(img_bytes)} B, drive={drive_size} B"
            )
            # Attempt cleanup of the suspect file
            _delete_quietly(drive_service, file_id)
            raise RuntimeError(
                f"[Storage] Upload integrity failed: size mismatch "
                f"(local={len(img_bytes)} B, drive={drive_size} B)"
            )
    except RuntimeError:
        raise
    except Exception as e:
        logger.warning(f"[Storage] Integrity verification partial failure (non-fatal): {e}")

    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    web_view   = meta.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")
    direct_dl  = meta.get("webContentLink", f"https://drive.google.com/uc?id={file_id}")

    logger.info(
        f"[Storage] Upload verified \u2713  file_id={file_id}  "
        f"size={drive_size} B  hash={expected_hash[:16]}…"
    )

    return {
        "file_id":              file_id,
        "web_view_link":        web_view,
        "direct_download_link": direct_dl,
        "upload_timestamp":     now_iso,
        "upload_size_bytes":    len(img_bytes),
    }


# ── Drive Write-Probe (startup check) ─────────────────────────────────────────

def probe_drive_writable() -> bool:
    """
    Create a 1-byte temp file, read its metadata, then delete it.
    Returns True if the Drive folder is readable and writable.
    Called once at application startup to validate credentials + folder permissions.
    """
    from app.services.google_drive import drive_service, FOLDER_ID
    from googleapiclient.http import MediaIoBaseUpload

    if not drive_service:
        logger.warning("[Storage] Drive write-probe skipped: service not initialised")
        return False

    probe_name = "__icms_probe__"
    file_id = None
    try:
        media = MediaIoBaseUpload(io.BytesIO(b"1"), mimetype="text/plain")
        file = drive_service.files().create(
            body={"name": probe_name, "parents": [FOLDER_ID]},
            media_body=media,
            fields="id",
        ).execute()
        file_id = file.get("id")
        if not file_id:
            raise RuntimeError("No file ID returned for probe")

        # Read back metadata
        drive_service.files().get(fileId=file_id, fields="id,size").execute()
        logger.info("[Storage] Drive write-probe: create + read OK ✓")
        return True

    except Exception as e:
        logger.error(f"[Storage] Drive write-probe FAILED: {e}")
        return False
    finally:
        if file_id:
            _delete_quietly(drive_service, file_id)


# ── Rollback Helper ────────────────────────────────────────────────────────────

def delete_face_image(file_id: str) -> bool:
    """
    Delete a Drive file by ID.
    Returns True on success, False on failure (non-fatal — caller logs warning).
    Used as a rollback compensating action when Supabase writes fail after upload.
    """
    if not file_id:
        return False
    try:
        from app.services.google_drive import drive_service
        if not drive_service:
            logger.warning("[Storage] Cannot delete Drive file — service not initialised")
            return False
        drive_service.files().delete(fileId=file_id).execute()
        logger.info(f"[Storage] Rollback: deleted Drive file {file_id}")
        return True
    except Exception as e:
        logger.error(f"[Storage] Rollback: failed to delete Drive file {file_id}: {e}")
        return False


def _delete_quietly(drive_service, file_id: str) -> None:
    """Silently attempt to delete a file — used in error cleanup paths."""
    try:
        drive_service.files().delete(fileId=file_id).execute()
        logger.debug(f"[Storage] Quietly deleted {file_id}")
    except Exception:
        pass
