"""face/database.py — Supabase CRUD for student_faces, students, and audit logs."""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError

logger = logging.getLogger("icms.face.database")


def get_student_record(student_id: int) -> Dict[str, Any]:
    """
    Fetch the students row for the given student_id.

    Raises:
        NotFoundError: if student does not exist.
    """
    supabase = get_supabase()
    res = supabase.table("students").select(
        "id, face_registered, face_registered_at, face_image_url, department"
    ).eq("id", student_id).execute()

    if not res.data:
        raise NotFoundError(f"Student {student_id} not found")
    return res.data[0]


def get_registered_embedding(student_id: int) -> Optional[List[float]]:
    """
    Return the stored face embedding for a student, or None if absent.
    First tries student_faces table; falls back to students.face_embedding column.
    """
    supabase = get_supabase()

    # Primary source: student_faces table
    res = supabase.table("student_faces").select(
        "face_embedding"
    ).eq("student_id", student_id).execute()

    if res.data and res.data[0].get("face_embedding"):
        return res.data[0]["face_embedding"]

    # Fallback: legacy column on students
    stu = supabase.table("students").select(
        "face_embedding"
    ).eq("id", student_id).execute()

    if stu.data and stu.data[0].get("face_embedding"):
        logger.debug(f"[Database] Loaded embedding from legacy students.face_embedding for student {student_id}")
        return stu.data[0]["face_embedding"]

    return None


def save_face_registration(
    student_id: int,
    embedding: List[float],
    face_image_url: str,
    drive_file_id: str,
    now_iso: str,
) -> None:
    """
    Persist a successful face registration atomically:
        1. Upsert student_faces (embedding + photo URL)
        2. Update students.face_registered = True

    Both writes happen sequentially. If the second write fails, raises RuntimeError
    with the first write result included, so callers can clean up.

    Raises:
        RuntimeError: on any Supabase failure.
        NotFoundError: if the students row is missing.
    """
    supabase = get_supabase()

    # Step 1: Upsert embedding record
    face_data = {
        "student_id":      student_id,
        "face_embedding":  embedding,
        "face_image_url":  face_image_url,
        "drive_file_id":   drive_file_id,
        "updated_at":      now_iso,
    }
    try:
        supabase.table("student_faces").upsert(
            face_data, on_conflict="student_id"
        ).execute()
        logger.debug(f"[Database] student_faces upserted for student {student_id}")
    except Exception as e:
        raise RuntimeError(f"[Database] Supabase student_faces upsert failed: {e}") from e

    # Step 2: Update registration flag + photo_url on students
    update_payload = {
        "face_registered":    True,
        "face_registered_at": now_iso,
        "face_image_url":     face_image_url,
        "face_drive_file_id": drive_file_id,
    }
    try:
        res = supabase.table("students").update(update_payload).eq("id", student_id).execute()
        if not res.data:
            raise NotFoundError(f"Student {student_id} not found during registration save")
        logger.debug(f"[Database] students.face_registered updated for student {student_id}")
    except NotFoundError:
        _rollback_student_faces(supabase, student_id)
        raise
    except Exception as e:
        _rollback_student_faces(supabase, student_id)
        raise RuntimeError(f"[Database] Supabase students update failed: {e}") from e

def _rollback_student_faces(supabase, student_id: int) -> None:
    try:
        supabase.table("student_faces").delete().eq("student_id", student_id).execute()
        logger.warning(f"[Database] Rolled back student_faces for student {student_id} due to partial failure")
    except Exception as e:
        logger.error(f"[Database] Failed to rollback student_faces for student {student_id}: {e}")


def reset_face_registration(student_id: int) -> None:
    """
    Clear all face registration data for a student.
    """
    supabase = get_supabase()
    supabase.table("students").update({
        "face_registered":    False,
        "face_registered_at": None,
        "face_embedding":     None,
        "face_image_url":     None,
        "face_drive_file_id": None,
    }).eq("id", student_id).execute()

    # Also clear the student_faces record if it exists
    supabase.table("student_faces").delete().eq("student_id", student_id).execute()
    logger.info(f"[Database] Face registration reset for student {student_id}")


def get_face_status_record(student_id: int) -> Dict[str, Any]:
    """Return the face registration status fields for a student."""
    supabase = get_supabase()
    res = supabase.table("students").select(
        "id, face_registered, face_registered_at, face_image_url"
    ).eq("id", student_id).execute()
    if not res.data:
        raise NotFoundError(f"Student {student_id} not found")
    return res.data[0]


def admin_face_list(
    department: str,
    page: int,
    size: int,
) -> Dict[str, Any]:
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

    return {
        "items": res.data,
        "total": res.count or 0,
        "page":  page,
        "size":  size,
    }


def write_audit_log(
    student_id: int,
    step: str,
    result: str,
    message: str,
) -> None:
    """
    Write an audit log entry to attendance_logs.
    Swallows errors silently to avoid disrupting the main pipeline.
    """
    try:
        supabase = get_supabase()
        supabase.table("attendance_logs").insert({
            "student_id":       student_id,
            "validation_step":  step,
            "result":           result,
            "message":          message,
            "timestamp":        datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"[Database] audit_log write failed (non-fatal): {e}")
