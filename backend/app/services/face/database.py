"""face/database.py — Supabase CRUD for face registration V2 pipeline."""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError
from app.core.face_config import IDEMPOTENCY_TTL_HOURS
from app.services.face.embedding_store import build_embedding_payload, extract_embedding_from_row

logger = logging.getLogger("icms.face.database")


# ── Student Record ─────────────────────────────────────────────────────────────

def get_student_record(student_id: int) -> Dict[str, Any]:
    """
    Fetch the students row for the given student_id.
    Raises NotFoundError if student does not exist.
    """
    supabase = get_supabase()
    res = supabase.table("students").select(
        "id, face_registered, face_registered_at, face_image_url, "
        "face_drive_file_id, face_image_hash, department"
    ).eq("id", student_id).execute()

    if not res.data:
        raise NotFoundError(f"Student {student_id} not found")
    return res.data[0]


def get_existing_face_metadata(student_id: int) -> Dict[str, Any]:
    """
    Return current face metadata for a student — used before update to know
    which old Drive file to delete and what embedding version to increment.

    Returns empty dict if no registration exists.
    """
    supabase = get_supabase()
    res = supabase.table("student_faces").select(
        "drive_file_id, image_hash, embedding_version, face_embedding"
    ).eq("student_id", student_id).execute()
    return res.data[0] if res.data else {}


# ── Registered Embedding ───────────────────────────────────────────────────────

def get_registered_embedding(student_id: int) -> Optional[List[float]]:
    """
    Return the stored face embedding for a student, or None if absent.
    Uses embedding_store for backend-agnostic deserialisation.
    """
    supabase = get_supabase()

    res = supabase.table("student_faces").select(
        "face_embedding, face_embedding_vec"
    ).eq("student_id", student_id).execute()

    if res.data:
        return extract_embedding_from_row(res.data[0])

    # Fallback: legacy column on students table
    stu = supabase.table("students").select("face_embedding").eq("id", student_id).execute()
    if stu.data and stu.data[0].get("face_embedding"):
        logger.debug(f"[Database] Loaded embedding from legacy students.face_embedding for {student_id}")
        return extract_embedding_from_row(stu.data[0])

    return None


# ── Registration Save (Saga) ───────────────────────────────────────────────────

def save_face_registration(
    student_id: int,
    embedding: List[float],
    drive_meta: dict,
    quality_meta: dict,
    request_id: str,
    now_iso: str,
    is_new_registration: bool,
) -> int:
    """
    Persist a successful face registration using a saga pattern:
        Step A: Upsert student_faces (embedding + Drive metadata + quality)
        Step B: Update students (face_registered = True + denormalised Drive fields)
        Step C: Insert face_registration_history (non-critical)

    Rollback on Step A failure: delete Drive file (caller responsible).
    Rollback on Step B failure: delete student_faces only if is_new_registration=True,
        then delete Drive file.

    Args:
        student_id:         Target student.
        embedding:          ArcFace embedding vector.
        drive_meta:         Dict from storage.upload_face_image().
        quality_meta:       Dict with quality_score, face_confidence, challenge_type, image_hash.
        request_id:         Structured request ID (REG-YYYYMMDD-HHMMSS-XXXX).
        now_iso:            ISO 8601 timestamp string for all writes.
        is_new_registration: True for first registration, False for update.

    Returns:
        New embedding_version integer.

    Raises:
        RuntimeError: on Step A or Step B failure (Step C is non-critical).
    """
    supabase = get_supabase()

    # Determine next embedding version
    existing = get_existing_face_metadata(student_id)
    embedding_version = int(existing.get("embedding_version") or 0) + 1

    import mediapipe
    mediapipe_ver = getattr(mediapipe, "__version__", "unknown")

    from app.core.face_config import EMBEDDING_MODEL, EMBEDDING_MODEL_VERSION

    # ── Step A: Upsert student_faces ──────────────────────────────────────────
    embedding_payload = build_embedding_payload(embedding)
    face_data = {
        "student_id":              student_id,
        "face_image_url":          drive_meta["web_view_link"],
        "drive_file_id":           drive_meta["file_id"],
        "web_view_link":           drive_meta["web_view_link"],
        "direct_download_link":    drive_meta["direct_download_link"],
        "image_hash":              quality_meta.get("image_hash"),
        "embedding_version":       embedding_version,
        "embedding_model":         EMBEDDING_MODEL,
        "embedding_model_version": EMBEDDING_MODEL_VERSION,
        "mediapipe_version":       mediapipe_ver,
        "face_confidence":         quality_meta.get("face_confidence"),
        "quality_score":           quality_meta.get("quality_score"),
        "request_id":              request_id,
        "upload_timestamp":        drive_meta.get("upload_timestamp"),
        "updated_at":              now_iso,
        **embedding_payload,
    }
    try:
        supabase.table("student_faces").upsert(
            face_data, on_conflict="student_id"
        ).execute()
        logger.debug(f"[Database] Step A: student_faces upserted for student {student_id}")
    except Exception as e:
        raise RuntimeError(f"[Database] Step A failed (student_faces upsert): {e}") from e

    # ── Step B: Update students table ────────────────────────────────────────
    update_payload = {
        "face_registered":     True,
        "face_registered_at":  now_iso,
        "face_image_url":      drive_meta["web_view_link"],
        "face_drive_file_id":  drive_meta["file_id"],
        "face_web_view_link":  drive_meta["web_view_link"],
        "face_direct_link":    drive_meta["direct_download_link"],
        "face_image_hash":     quality_meta.get("image_hash"),
    }
    try:
        res = supabase.table("students").update(update_payload).eq("id", student_id).execute()
        if not res.data:
            raise NotFoundError(f"Student {student_id} not found during registration save")
        logger.debug(f"[Database] Step B: students updated for student {student_id}")
    except NotFoundError:
        # B7 FIX: only rollback student_faces if this was a fresh insert
        if is_new_registration:
            _rollback_student_faces(supabase, student_id)
        raise
    except Exception as e:
        if is_new_registration:
            _rollback_student_faces(supabase, student_id)
        raise RuntimeError(f"[Database] Step B failed (students update): {e}") from e

    # ── Step C: Append history row (non-critical) ─────────────────────────────
    try:
        history_row = {
            "student_id":              student_id,
            "face_embedding":          embedding,   # Always jsonb in history
            "face_image_url":          drive_meta["web_view_link"],
            "web_view_link":           drive_meta["web_view_link"],
            "direct_download_link":    drive_meta["direct_download_link"],
            "drive_file_id":           drive_meta["file_id"],
            "image_hash":              quality_meta.get("image_hash"),
            "embedding_model":         EMBEDDING_MODEL,
            "embedding_model_version": EMBEDDING_MODEL_VERSION,
            "mediapipe_version":       mediapipe_ver,
            "embedding_version":       embedding_version,
            "quality_score":           quality_meta.get("quality_score"),
            "face_confidence":         quality_meta.get("face_confidence"),
            "challenge_type":          quality_meta.get("challenge_type"),
            "request_id":              request_id,
        }
        supabase.table("face_registration_history").insert(history_row).execute()
        logger.debug(f"[Database] Step C: history row inserted for student {student_id}")
    except Exception as e:
        logger.warning(f"[Database] Step C failed (history insert, non-critical): {e}")

    return embedding_version


def _rollback_student_faces(supabase, student_id: int) -> None:
    """Compensating action for Step B failure on NEW registrations only."""
    try:
        supabase.table("student_faces").delete().eq("student_id", student_id).execute()
        logger.warning(f"[Database] Rolled back student_faces insert for student {student_id}")
    except Exception as e:
        logger.error(f"[Database] Rollback of student_faces failed for student {student_id}: {e}")


# ── Database Write Verification ────────────────────────────────────────────────

def verify_face_registration(student_id: int) -> bool:
    """
    Re-read from Supabase to confirm the registration was persisted correctly.
    Checks:
        - students.face_registered == True
        - student_faces.face_embedding is not null

    Returns True on success, False if the read fails or data is inconsistent.
    """
    supabase = get_supabase()
    try:
        sf_res = supabase.table("student_faces").select(
            "face_embedding, face_embedding_vec"
        ).eq("student_id", student_id).execute()

        if not sf_res.data:
            logger.error(f"[Database] Verify: student_faces row missing for student {student_id}")
            return False

        embedding = extract_embedding_from_row(sf_res.data[0])
        if not embedding:
            logger.error(f"[Database] Verify: face_embedding is null for student {student_id}")
            return False

        st_res = supabase.table("students").select(
            "face_registered"
        ).eq("id", student_id).execute()

        if not st_res.data or not st_res.data[0].get("face_registered"):
            logger.error(f"[Database] Verify: students.face_registered is False for student {student_id}")
            return False

        logger.debug(f"[Database] Verify: registration confirmed for student {student_id} ✓")
        return True

    except Exception as e:
        logger.error(f"[Database] Verify: exception during verification for student {student_id}: {e}")
        return False


# ── Idempotency Cache ──────────────────────────────────────────────────────────

def check_idempotency(key: str) -> Optional[Dict[str, Any]]:
    """
    Look up the idempotency cache for a given key.
    Returns the cached result dict if key exists and not expired, else None.
    """
    if not key:
        return None
    try:
        supabase = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        res = supabase.table("face_idempotency_cache").select(
            "status, result_json"
        ).eq("idempotency_key", key).gt("expires_at", now).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.warning(f"[Database] Idempotency check failed (non-fatal): {e}")
        return None


def set_idempotency(
    key: str,
    student_id: Optional[int],
    status: str,
    result: Optional[dict] = None,
) -> None:
    """
    Write or update an idempotency cache entry.
    status: 'processing' | 'completed' | 'failed'
    """
    if not key:
        return
    try:
        supabase = get_supabase()
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=IDEMPOTENCY_TTL_HOURS)).isoformat()
        supabase.table("face_idempotency_cache").upsert({
            "idempotency_key": key,
            "student_id":      student_id,
            "status":          status,
            "result_json":     result,
            "expires_at":      expires_at,
        }, on_conflict="idempotency_key").execute()
    except Exception as e:
        logger.warning(f"[Database] set_idempotency failed (non-fatal): {e}")


def cleanup_expired_idempotency_keys() -> int:
    """Delete expired idempotency cache rows. Returns count deleted."""
    try:
        supabase = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        res = supabase.table("face_idempotency_cache").delete().lt("expires_at", now).execute()
        count = len(res.data) if res.data else 0
        if count > 0:
            logger.info(f"[Database] Cleaned up {count} expired idempotency keys")
        return count
    except Exception as e:
        logger.warning(f"[Database] cleanup_expired_idempotency_keys failed: {e}")
        return 0


# ── Audit Logging ──────────────────────────────────────────────────────────────

def write_face_audit_log(
    student_id: Optional[int],
    request_id: str,
    ip_address: str,
    user_agent: str,
    challenge_type: str,
    stage: str,
    result: str,
    failure_reason: Optional[str],
    duration_ms: int,
) -> None:
    """
    Write a registration event to face_audit_logs.
    Non-fatal — swallows all exceptions to avoid disrupting the main pipeline.
    """
    try:
        supabase = get_supabase()
        supabase.table("face_audit_logs").insert({
            "student_id":     student_id,
            "request_id":     request_id,
            "ip_address":     ip_address,
            "user_agent":     user_agent[:500] if user_agent else "",
            "challenge_type": challenge_type,
            "stage":          stage,
            "result":         result,
            "failure_reason": failure_reason,
            "duration_ms":    duration_ms,
            "timestamp":      datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"[Database] face_audit_log write failed (non-fatal): {e}")


# ── Legacy helpers (unchanged) ─────────────────────────────────────────────────

def reset_face_registration(student_id: int) -> None:
    """Clear all face registration data for a student (admin reset)."""
    supabase = get_supabase()
    supabase.table("students").update({
        "face_registered":    False,
        "face_registered_at": None,
        "face_image_url":     None,
        "face_drive_file_id": None,
        "face_web_view_link": None,
        "face_direct_link":   None,
        "face_image_hash":    None,
    }).eq("id", student_id).execute()
    supabase.table("student_faces").delete().eq("student_id", student_id).execute()
    logger.info(f"[Database] Face registration reset for student {student_id}")


def get_face_status_record(student_id: int) -> Dict[str, Any]:
    """Return the face registration status fields for a student."""
    supabase = get_supabase()
    res = supabase.table("students").select(
        "id, face_registered, face_registered_at, face_image_url, face_drive_file_id"
    ).eq("id", student_id).execute()
    if not res.data:
        raise NotFoundError(f"Student {student_id} not found")
    return res.data[0]


def admin_face_list(department: str, page: int, size: int) -> Dict[str, Any]:
    """Paginated face registration status list for admin view."""
    supabase = get_supabase()
    query = supabase.table("students").select(
        "id, face_registered, face_registered_at, department, "
        "user:users(id, ic_number, full_name, email)",
        count="exact",
    )
    if department:
        query = query.eq("department", department)
    res = query.order("face_registered", desc=False).range(
        (page - 1) * size, page * size - 1
    ).execute()
    return {"items": res.data, "total": res.count or 0, "page": page, "size": size}


def write_audit_log(student_id: int, step: str, result: str, message: str) -> None:
    """Legacy audit log writer (attendance_logs). Kept for backward compatibility."""
    try:
        supabase = get_supabase()
        supabase.table("attendance_logs").insert({
            "student_id":      student_id,
            "validation_step": step,
            "result":          result,
            "message":         message,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"[Database] attendance_log write failed (non-fatal): {e}")
