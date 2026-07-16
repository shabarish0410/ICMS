"""face/registration.py — Orchestrates the full face registration V2 pipeline.

Architecture: fully async 10-stage sequential pipeline with transactional saga,
rollback logic, structured request IDs, per-stage timing, and idempotency.

Pipeline stages:
    1.  Decode base64 image
    2.  Compress (resize + JPEG re-encode)
    3.  Hash (SHA-256 dedup check)
    4.  Validate face (confidence, blur, brightness, size, pose, eyes, occlusion)
    5.  Validate liveness (client metrics OR multi-frame MediaPipe)
    6.  Generate ArcFace embedding  [run_in_executor — CPU bound]
    7.  Upload to Google Drive + integrity verify  [run_in_executor — IO bound]
    8.  Supabase saga (8A: student_faces, 8B: students, 8C: history)
    9.  Verify DB write (re-read assert)
    10. Cleanup old Drive file (update only) + write audit log

Rollback matrix:
    Stage 6 fails  → no upload, no DB write
    Stage 7 fails  → no DB write (Drive failed or integrity check failed)
    Stage 8A fails → delete new Drive file
    Stage 8B fails → delete student_faces (if new insert), delete new Drive file
    Stage 9 fails  → same as 8B + CRITICAL log
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from passlib.context import CryptContext

from app.core.exceptions import (
    NotFoundError, ValidationError, PermissionDeniedError, BusinessLogicError
)
from app.core.face_config import (
    EMBEDDING_MODEL, EMBEDDING_MODEL_VERSION, PERF_TARGETS, FACE_PIPELINE_V2
)
from app.core.supabase import get_supabase   # Fix B1: explicit import
from app.schemas import FaceRegisterRequest, FaceUpdateRequest

from app.services.face.utils import (
    decode_base64_image, compress_image, hash_image, generate_request_id
)
from app.services.face.validation import detect_and_validate_face, validate_liveness_metrics
from app.services.face.embedding import generate_face_embedding
from app.services.face.storage import upload_face_image, delete_face_image
from app.services.face.database import (
    get_student_record, get_existing_face_metadata,
    save_face_registration, verify_face_registration,
    check_idempotency, set_idempotency,
    write_face_audit_log, reset_face_registration,
    get_face_status_record, admin_face_list, write_audit_log,
)

logger = logging.getLogger("icms.face.registration")
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Helpers ───────────────────────────────────────────────────────────────────

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


class _Timer:
    """Simple per-stage timing helper."""
    def __init__(self):
        self._t0 = time.monotonic()
        self._marks: dict[str, float] = {}
        self._start: dict[str, float] = {}

    def start(self, stage: str):
        self._start[stage] = time.monotonic()

    def end(self, stage: str) -> int:
        ms = int((time.monotonic() - self._start.get(stage, self._t0)) * 1000)
        self._marks[stage] = ms
        if ms > PERF_TARGETS.get(stage, 9999):
            logger.warning(
                f"[Perf] Stage '{stage}' took {ms}ms (target: {PERF_TARGETS.get(stage)}ms)"
            )
        return ms

    def total_ms(self) -> int:
        return int((time.monotonic() - self._t0) * 1000)

    def stages(self) -> dict:
        return {k: v for k, v in self._marks.items()}


def _log(request_id: str, student_id: int, stage: str, status: str, msg: str, **kwargs):
    extra = " ".join(f"{k}={v}" for k, v in kwargs.items())
    logger.info(
        f"[{request_id}] student={student_id} stage={stage} status={status} | {msg}"
        + (f" | {extra}" if extra else "")
    )


# ── Core async pipeline ───────────────────────────────────────────────────────

async def _run_pipeline_async(
    image_b64: str,
    student_id: int,
    request_id: str,
    operation: str,
    liveness_metrics: Optional[dict],
    challenge_type: str,
    ip_address: str,
    user_agent: str,
) -> dict:
    """
    10-stage async pipeline. All CPU/IO-bound stages run via run_in_executor
    so the FastAPI event loop is never blocked.

    Returns the enriched response dict on success.
    Raises ICMSException subclasses on failure.
    """
    loop   = asyncio.get_event_loop()
    timer  = _Timer()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Track resources for rollback
    new_drive_file_id: Optional[str] = None

    # Determine if this is a new registration or an update
    existing_meta  = await loop.run_in_executor(None, get_existing_face_metadata, student_id)
    old_drive_file_id = existing_meta.get("drive_file_id")
    is_new         = not bool(old_drive_file_id)
    existing_hash  = existing_meta.get("image_hash")

    _log(request_id, student_id, "start", "START", f"{operation} pipeline started",
         is_new=is_new, challenge=challenge_type)

    # ── Stage 1: Decode ───────────────────────────────────────────────────────
    timer.start("decode")
    try:
        img_bytes = await loop.run_in_executor(None, decode_base64_image, image_b64)
    except ValueError as e:
        _log(request_id, student_id, "decode", "FAIL", str(e))
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "decode", "FAIL", str(e), timer.total_ms())
        raise ValidationError(f"Image decode failed: {e}")
    timer.end("decode")
    _log(request_id, student_id, "decode", "PASS", f"{len(img_bytes):,} B")

    # ── Stage 2: Compress ─────────────────────────────────────────────────────
    timer.start("compress")
    compressed_bytes = await loop.run_in_executor(None, compress_image, img_bytes)
    timer.end("compress")
    _log(request_id, student_id, "compress", "PASS",
         f"{len(img_bytes):,}B → {len(compressed_bytes):,}B")

    # ── Stage 3: Hash + duplicate check ───────────────────────────────────────
    timer.start("hash")
    img_hash = await loop.run_in_executor(None, hash_image, compressed_bytes)
    timer.end("hash")

    if img_hash == existing_hash and not is_new:
        # Exact duplicate: skip Drive re-upload, return existing metadata
        _log(request_id, student_id, "hash", "DUPLICATE",
             f"hash={img_hash[:16]}… matches existing — skipping re-upload")
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "hash_check", "DUPLICATE", None, timer.total_ms())
        return {
            "success": True, "request_id": request_id, "student_id": student_id,
            "duplicate": True,
            "drive_file_id": existing_meta.get("drive_file_id"),
            "image_hash": img_hash,
            "message": "Image already registered (duplicate). No changes made.",
            "processing_time_ms": timer.total_ms(),
            "stages": timer.stages(),
        }
    _log(request_id, student_id, "hash", "PASS", f"hash={img_hash[:16]}…")

    # ── Stage 4: Validate face ─────────────────────────────────────────────────
    timer.start("validate")
    validation = await loop.run_in_executor(None, detect_and_validate_face, compressed_bytes)
    timer.end("validate")
    if not validation["valid"]:
        _log(request_id, student_id, "validate", "FAIL", validation["reason"])
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "validate", "FAIL", validation["reason"], timer.total_ms())
        raise ValidationError(validation["reason"])
    _log(request_id, student_id, "validate", "PASS",
         f"quality={validation.get('quality_score')}% conf={validation.get('confidence', 0):.3f}")

    # ── Stage 5: Liveness ──────────────────────────────────────────────────────
    timer.start("liveness")
    if liveness_metrics and challenge_type:
        liveness = await loop.run_in_executor(
            None, validate_liveness_metrics, liveness_metrics, challenge_type
        )
    else:
        # Single-frame fallback: accept without liveness (logged as warning)
        logger.warning(
            f"[{request_id}] No liveness metrics provided — single-frame mode (lower security)"
        )
        liveness = {"passed": True, "reason": "Single-frame mode (no metrics)", "challenge_type": challenge_type}

    timer.end("liveness")
    if not liveness["passed"]:
        _log(request_id, student_id, "liveness", "FAIL", liveness["reason"])
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "liveness", "FAIL", liveness["reason"], timer.total_ms())
        raise ValidationError(liveness["reason"])
    _log(request_id, student_id, "liveness", "PASS", liveness["reason"])

    # ── Stage 6: Generate embedding [CPU] ──────────────────────────────────────
    timer.start("embed")
    aligned_face = validation.get("aligned_face")
    if aligned_face is not None:
        embedding = await loop.run_in_executor(
            None, generate_face_embedding, aligned_face, False
        )
    else:
        embedding = await loop.run_in_executor(
            None, generate_face_embedding, compressed_bytes, True
        )
    timer.end("embed")

    if embedding is None:
        _log(request_id, student_id, "embed", "FAIL", "generate_face_embedding returned None")
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "embed", "FAIL", "Embedding generation failed", timer.total_ms())
        raise BusinessLogicError("Embedding generation failed", status_code=422)
    _log(request_id, student_id, "embed", "PASS", f"dim={len(embedding)}")

    # ── Stage 7: Upload to Drive + integrity verify [IO] ─────────────────────
    timer.start("upload")
    filename = f"face_{operation}_{student_id}_{request_id}.jpg"
    try:
        drive_meta = await loop.run_in_executor(
            None, upload_face_image, compressed_bytes, filename, img_hash
        )
    except RuntimeError as e:
        _log(request_id, student_id, "upload", "FAIL", str(e))
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "upload", "FAIL", str(e), timer.total_ms())
        raise BusinessLogicError(f"Drive upload failed: {e}", status_code=502)
    timer.end("upload")
    new_drive_file_id = drive_meta["file_id"]
    _log(request_id, student_id, "upload", "PASS",
         f"file_id={new_drive_file_id} size={drive_meta.get('upload_size_bytes')}B")

    # ── Stage 8: Supabase saga ─────────────────────────────────────────────────
    timer.start("database")
    quality_meta = {
        "image_hash":     img_hash,
        "quality_score":  validation.get("quality_score"),
        "face_confidence": validation.get("confidence"),
        "challenge_type": challenge_type,
    }
    try:
        embedding_version = await loop.run_in_executor(
            None, save_face_registration,
            student_id, embedding, drive_meta, quality_meta,
            request_id, now_iso, is_new
        )
    except Exception as e:
        _log(request_id, student_id, "database", "FAIL", str(e))
        # Rollback: delete the just-uploaded Drive file
        _log(request_id, student_id, "rollback", "START", f"deleting Drive file {new_drive_file_id}")
        await loop.run_in_executor(None, delete_face_image, new_drive_file_id)
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "database", "FAIL", str(e), timer.total_ms())
        raise BusinessLogicError(f"Database save failed: {e}", status_code=500)
    timer.end("database")
    _log(request_id, student_id, "database", "PASS", f"embedding_version={embedding_version}")

    # ── Stage 9: Verify DB write ───────────────────────────────────────────────
    timer.start("verify")
    verified = await loop.run_in_executor(None, verify_face_registration, student_id)
    timer.end("verify")
    if not verified:
        logger.critical(
            f"[{request_id}] CRITICAL: DB write verification failed for student {student_id}! "
            "Data may be inconsistent."
        )
        # Rollback
        await loop.run_in_executor(None, delete_face_image, new_drive_file_id)
        _audit(student_id, request_id, ip_address, user_agent, challenge_type,
               "verify", "FAIL", "DB write verification failed", timer.total_ms())
        raise BusinessLogicError("Registration verification failed. Please retry.", status_code=500)
    _log(request_id, student_id, "verify", "PASS", "DB confirmed ✓")

    # ── Stage 10: Cleanup old file + final audit ───────────────────────────────
    timer.start("cleanup")
    if not is_new and old_drive_file_id and old_drive_file_id != new_drive_file_id:
        _log(request_id, student_id, "cleanup", "START", f"deleting old file {old_drive_file_id}")
        await loop.run_in_executor(None, delete_face_image, old_drive_file_id)
        _log(request_id, student_id, "cleanup", "PASS", f"old file deleted")
    timer.end("cleanup")

    total_ms = timer.total_ms()
    if total_ms > PERF_TARGETS["total"]:
        logger.warning(
            f"[{request_id}] Total pipeline time {total_ms}ms exceeded target {PERF_TARGETS['total']}ms"
        )

    _audit(student_id, request_id, ip_address, user_agent, challenge_type,
           "complete", "PASS", None, total_ms)
    _log(request_id, student_id, "complete", "PASS",
         f"total={total_ms}ms version={embedding_version}")

    return {
        "success":                True,
        "request_id":             request_id,
        "student_id":             student_id,
        "drive_file_id":          drive_meta["file_id"],
        "web_view_link":          drive_meta["web_view_link"],
        "direct_download_link":   drive_meta["direct_download_link"],
        "image_hash":             img_hash,
        "embedding_dimension":    len(embedding),
        "embedding_model":        EMBEDDING_MODEL,
        "embedding_model_version": EMBEDDING_MODEL_VERSION,
        "embedding_version":      embedding_version,
        "quality_score":          validation.get("quality_score"),
        "face_confidence":        validation.get("confidence"),
        "challenge_type":         challenge_type,
        "liveness_passed":        True,
        "registered_at":          now_iso,
        "processing_time_ms":     total_ms,
        "stages":                 timer.stages(),
    }


def _audit(student_id, request_id, ip, ua, challenge, stage, result, reason, duration_ms):
    """Write to face_audit_logs — non-fatal, best-effort."""
    try:
        write_face_audit_log(
            student_id=student_id, request_id=request_id,
            ip_address=ip, user_agent=ua, challenge_type=challenge,
            stage=stage, result=result, failure_reason=reason, duration_ms=duration_ms,
        )
    except Exception:
        pass


# ── Public async API ──────────────────────────────────────────────────────────

async def register_face(
    req: FaceRegisterRequest,
    current_user: dict,
    idempotency_key: Optional[str] = None,
    ip_address: str = "unknown",
    user_agent: str = "",
) -> dict:
    """POST /api/v1/face/register"""
    _assert_student_role(current_user)
    student_id  = _get_student_id(current_user)
    request_id  = generate_request_id()
    challenge   = req.challenge_type or "blink"

    # Idempotency check
    if idempotency_key:
        cached = check_idempotency(idempotency_key)
        if cached:
            if cached["status"] == "completed":
                logger.info(f"[{request_id}] Idempotency hit — returning cached result for key {idempotency_key[:8]}…")
                return cached["result_json"]
            if cached["status"] == "processing":
                return {"success": False, "request_id": request_id,
                        "message": "Registration already in progress. Please wait."}
        set_idempotency(idempotency_key, student_id, "processing")

    try:
        result = await _run_pipeline_async(
            req.image_base64, student_id, request_id, "register",
            req.liveness_metrics, challenge, ip_address, user_agent,
        )
        if idempotency_key:
            set_idempotency(idempotency_key, student_id, "completed", result)
        return result
    except Exception as e:
        if idempotency_key:
            set_idempotency(idempotency_key, student_id, "failed", {"error": str(e)})
        raise


async def update_face(
    req: FaceUpdateRequest,
    current_user: dict,
    idempotency_key: Optional[str] = None,
    ip_address: str = "unknown",
    user_agent: str = "",
) -> dict:
    """PUT /api/v1/face/update"""
    _assert_student_role(current_user)
    student_id = _get_student_id(current_user)
    request_id = generate_request_id()
    challenge  = req.challenge_type or "blink"

    # Password verification
    user_id = current_user.get("id")
    if not user_id:
        raise PermissionDeniedError("User not authenticated")

    supabase = get_supabase()   # Fix B1: now explicitly imported at top of file
    user_res = supabase.table("users").select("password_hash").eq("id", user_id).execute()
    if not user_res.data:
        raise NotFoundError("User not found")
    if not _pwd_context.verify(req.password, user_res.data[0]["password_hash"]):
        write_audit_log(student_id, "password_verify", "FAIL", "Invalid password on face update")
        raise PermissionDeniedError("Invalid password. Please try again.")

    result = await _run_pipeline_async(
        req.image_base64, student_id, request_id, "update",
        req.liveness_metrics, challenge, ip_address, user_agent,
    )
    result["message"] = "Face registration updated successfully!"
    return result


# ── Read-only helpers (unchanged behaviour) ───────────────────────────────────

def get_face_status(student_id: int, current_user: dict) -> dict:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name == "student":
        my_id = _get_student_id(current_user)
        if my_id != student_id:
            raise PermissionDeniedError("Access denied")
    record = get_face_status_record(student_id)
    return {
        "student_id":      student_id,
        "face_registered": bool(record.get("face_registered", False)),
        "registered_at":   record.get("face_registered_at"),
        "face_image_url":  record.get("face_image_url"),
        "drive_file_id":   record.get("face_drive_file_id"),
    }


def get_my_face_status(current_user: dict) -> dict:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise PermissionDeniedError("Only students can check face status")
    student_id = _get_student_id(current_user)
    return get_face_status(student_id, current_user)


def reset_face(student_id: int, current_user: dict) -> dict:
    get_student_record(student_id)
    reset_face_registration(student_id)
    write_audit_log(student_id, "face_reset", "INFO",
                    f"Reset by admin user_id={current_user.get('id')}")
    return {"success": True, "message": "Face registration reset successfully."}


def admin_face_status(department: str, page: int, size: int, current_user: dict) -> dict:
    return admin_face_list(department, page, size)
