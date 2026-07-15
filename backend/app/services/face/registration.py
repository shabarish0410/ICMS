"""face/registration.py — Orchestrates the full face register/update pipeline with structured logging."""

import logging
import time
import uuid
from datetime import datetime, timezone

from passlib.context import CryptContext

from app.core.exceptions import (
    NotFoundError, ValidationError, PermissionDeniedError, BusinessLogicError
)
from app.core.supabase import get_supabase
from app.schemas import FaceRegisterRequest, FaceUpdateRequest

from app.services.face.utils import decode_base64_image
from app.services.face.validation import detect_and_validate_face
from app.services.face.embedding import generate_face_embedding
from app.services.face.storage import upload_face_image
from app.services.face.database import (
    save_face_registration, reset_face_registration,
    get_face_status_record, admin_face_list, write_audit_log, get_student_record
)

logger = logging.getLogger("icms.face.registration")

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_student_id(current_user: dict) -> int:
    student_data = current_user.get("student")
    if isinstance(student_data, list) and len(student_data) > 0:
        return student_data[0]["id"]
    if isinstance(student_data, dict):
        return student_data["id"]
    raise PermissionDeniedError("Student profile not found in token")


def _assert_student_role(current_user: dict) -> None:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise PermissionDeniedError("Only students can register their face")


def _run_pipeline(
    image_b64: str,
    student_id: int,
    request_id: str,
    operation: str,
) -> tuple[bytes, list, str, str]:
    """
    Shared pipeline: decode → validate → embed → upload.

    Returns:
        (img_bytes, embedding, drive_file_id, public_url)
    """
    t0 = time.monotonic()

    def elapsed() -> str:
        return f"{(time.monotonic() - t0) * 1000:.0f}ms"

    logger.info(
        f"[Registration] [{request_id}] {operation} pipeline started "
        f"for student_id={student_id}"
    )
    write_audit_log(student_id, f"{operation}_started", "INFO", f"request_id={request_id}")

    # ── Stage 1: Decode ───────────────────────────────────────────────────────
    logger.debug(f"[Registration] [{request_id}] Stage 1/5: Decode image")
    try:
        img_bytes = decode_base64_image(image_b64)
    except ValueError as e:
        write_audit_log(student_id, "image_decode", "FAIL", str(e))
        raise ValidationError(f"Image Decode Failed: {e}")
    logger.debug(f"[Registration] [{request_id}] Image decoded ({len(img_bytes)} bytes) | {elapsed()}")

    # ── Stage 2: Validate (face detection + quality) ──────────────────────────
    logger.debug(f"[Registration] [{request_id}] Stage 2/5: Validate & detect face")
    validation = detect_and_validate_face(img_bytes)
    if not validation["valid"]:
        write_audit_log(student_id, "face_validation", "FAIL", validation["reason"])
        raise ValidationError(validation["reason"])
    write_audit_log(
        student_id, "face_validation", "PASS",
        f"quality_score={validation.get('quality_score', 'N/A')}%"
    )
    logger.info(
        f"[Registration] [{request_id}] Validation Passed ✓ "
        f"quality_score={validation.get('quality_score', 'N/A')}% | {elapsed()}"
    )

    # ── Stage 3: Generate embedding ───────────────────────────────────────────
    logger.debug(f"[Registration] [{request_id}] Stage 3/5: Generate embedding")
    embedding = generate_face_embedding(img_bytes)
    if embedding is None:
        write_audit_log(student_id, "embedding_generate", "FAIL", "Embedding generation returned None")
        raise ValidationError(
            "Embedding Generation Failed: Could not extract face features. "
            "Ensure clear lighting and a frontal face position."
        )
    write_audit_log(student_id, "embedding_generate", "PASS", f"dim={len(embedding)}")
    logger.info(f"[Registration] [{request_id}] Embedding Generated ✓ dim={len(embedding)} | {elapsed()}")

    # ── Stage 4: Upload to Google Drive ───────────────────────────────────────
    logger.debug(f"[Registration] [{request_id}] Stage 4/5: Upload to Google Drive")
    filename = f"face_{operation}_{student_id}_{request_id}.jpg"
    try:
        drive_file_id, public_url = upload_face_image(img_bytes, filename)
    except RuntimeError as e:
        write_audit_log(student_id, "drive_upload", "FAIL", str(e))
        raise BusinessLogicError(
            f"Google Drive Upload Failed: {e}. Please try again.",
            status_code=500,
        )
    write_audit_log(student_id, "drive_upload", "PASS", f"file_id={drive_file_id}")
    logger.info(
        f"[Registration] [{request_id}] Google Drive Upload Verified ✓ "
        f"file_id={drive_file_id} | {elapsed()}"
    )

    return img_bytes, embedding, drive_file_id, public_url


# ── Public API ─────────────────────────────────────────────────────────────────

def register_face(req: FaceRegisterRequest, current_user: dict) -> dict:
    """POST /api/face/register"""
    _assert_student_role(current_user)
    student_id = _get_student_id(current_user)
    request_id = uuid.uuid4().hex[:8]
    now_iso    = datetime.now(timezone.utc).isoformat()

    _, embedding, drive_file_id, public_url = _run_pipeline(
        req.image_base64, student_id, request_id, "register"
    )

    # ── Stage 5: Persist ──────────────────────────────────────────────────────
    logger.debug(f"[Registration] [{request_id}] Stage 5/5: Persist to Supabase")
    try:
        save_face_registration(student_id, embedding, public_url, drive_file_id, now_iso)
    except NotFoundError as e:
        write_audit_log(student_id, "supabase_update", "FAIL", str(e))
        raise
    except RuntimeError as e:
        write_audit_log(student_id, "supabase_update", "FAIL", str(e))
        raise BusinessLogicError(
            f"Supabase Update Failed: {e}. Registration could not be saved.",
            status_code=500,
        )

    write_audit_log(student_id, "face_registration", "PASS", "Registration complete")
    logger.info(
        f"[Registration] [{request_id}] Registration Completed ✓ "
        f"student_id={student_id} at {now_iso}"
    )

    return {
        "success":       True,
        "message":       "Face registered successfully!",
        "registered_at": now_iso,
    }


def update_face(req: FaceUpdateRequest, current_user: dict) -> dict:
    """PUT /api/face/update"""
    _assert_student_role(current_user)
    student_id = _get_student_id(current_user)
    request_id = uuid.uuid4().hex[:8]
    now_iso    = datetime.now(timezone.utc).isoformat()

    # ── Password verification (only for update, not initial register) ─────────
    user_id = current_user.get("id")
    if not user_id:
        raise PermissionDeniedError("User not authenticated")

    supabase = get_supabase()
    user_res = supabase.table("users").select("password_hash").eq("id", user_id).execute()
    if not user_res.data:
        raise NotFoundError("User not found")

    password_hash = user_res.data[0]["password_hash"]
    if not _pwd_context.verify(req.password, password_hash):
        write_audit_log(student_id, "password_verify", "FAIL", "Invalid password on face update")
        raise PermissionDeniedError("Invalid password. Please try again.")

    write_audit_log(student_id, "password_verify", "PASS", "Password verified for face update")
    logger.debug(f"[Registration] [{request_id}] Password verified ✓ for student_id={student_id}")

    _, embedding, drive_file_id, public_url = _run_pipeline(
        req.image_base64, student_id, request_id, "update"
    )

    # ── Persist ───────────────────────────────────────────────────────────────
    try:
        save_face_registration(student_id, embedding, public_url, drive_file_id, now_iso)
    except NotFoundError as e:
        write_audit_log(student_id, "supabase_update", "FAIL", str(e))
        raise
    except RuntimeError as e:
        write_audit_log(student_id, "supabase_update", "FAIL", str(e))
        raise BusinessLogicError(
            f"Supabase Update Failed: {e}. Face update could not be saved.",
            status_code=500,
        )

    write_audit_log(student_id, "face_update", "PASS", "Face update complete")
    logger.info(
        f"[Registration] [{request_id}] Face Update Completed ✓ "
        f"student_id={student_id} at {now_iso}"
    )

    return {
        "success":    True,
        "message":    "Face registration updated successfully!",
        "updated_at": now_iso,
    }


def get_face_status(student_id: int, current_user: dict) -> dict:
    """GET /api/face/status/{student_id}"""
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name == "student":
        my_id = _get_student_id(current_user)
        if my_id != student_id:
            raise PermissionDeniedError("Access denied")

    record = get_face_status_record(student_id)
    return {
        "student_id":    student_id,
        "face_registered": bool(record.get("face_registered", False)),
        "registered_at": record.get("face_registered_at"),
        "face_image_url": record.get("face_image_url"),
    }


def get_my_face_status(current_user: dict) -> dict:
    """GET /api/face/my-status"""
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise PermissionDeniedError("Only students can check face status")

    student_id = _get_student_id(current_user)
    record = get_face_status_record(student_id)
    return {
        "student_id":    student_id,
        "face_registered": bool(record.get("face_registered", False)),
        "registered_at": record.get("face_registered_at"),
        "face_image_url": record.get("face_image_url"),
    }


def reset_face(student_id: int, current_user: dict) -> dict:
    """DELETE /api/face/reset/{student_id}"""
    get_student_record(student_id)  # raises NotFoundError if missing
    reset_face_registration(student_id)
    write_audit_log(
        student_id, "face_reset", "INFO",
        f"Reset by admin user_id={current_user.get('id')}"
    )
    return {"success": True, "message": "Face registration reset successfully."}


def admin_face_status(department: str, page: int, size: int, current_user: dict) -> dict:
    """GET /api/face/admin/all-status"""
    return admin_face_list(department, page, size)
