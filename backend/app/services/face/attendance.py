"""
face/attendance.py
─────────────────────────────────────────────────
Responsibility: Attendance-specific face verification helpers.
  - Verify a probe image against a student's registered face
  - Return structured result for use by attendance_service.py

This is a thin adapter that wires recognition.py + database.py
so that attendance_service.py has a single clean call.
"""
import logging
from typing import Dict, Any, List, Optional

from app.services.face.validation import detect_and_validate_face, perform_liveness_check
from app.services.face.embedding import generate_face_embedding, compare_embeddings
from app.services.face.utils import decode_base64_image

logger = logging.getLogger("icms.face.attendance")


def verify_for_attendance(
    image_b64: str,
    registered_embedding: Any,
    liveness_frames: Optional[List[str]],
    student_id: int,
) -> Dict[str, Any]:
    """
    Full face verification pipeline for attendance:
        1. Decode image
        2. Validate (one face, quality)
        3. Liveness check
        4. Generate probe embedding
        5. Compare with registered embedding

    Returns structured result consumed by attendance_service.face_attendance().
    Raises nothing — all outcomes are returned as dict fields.
    """
    result: Dict[str, Any] = {
        "valid":            False,
        "reason":           "Unknown error",
        "liveness_passed":  False,
        "match":            False,
        "distance":         1.0,
        "confidence":       0.0,
        "quality_score":    0,
    }

    # ── 1. Decode ─────────────────────────────────────────────────────────────
    try:
        img_bytes = decode_base64_image(image_b64)
    except ValueError as e:
        result["reason"] = f"Image Decode Failed: {e}"
        logger.warning(f"[Attendance] student={student_id} decode failed: {e}")
        return result

    # ── 2. Validate ───────────────────────────────────────────────────────────
    validation = detect_and_validate_face(img_bytes)
    result["quality_score"] = validation.get("quality_score", 0)
    if not validation["valid"]:
        result["reason"] = validation["reason"]
        logger.warning(f"[Attendance] student={student_id} validation failed: {validation['reason']}")
        return result

    # ── 3. Liveness ───────────────────────────────────────────────────────────
    frames = liveness_frames or [image_b64]
    liveness = perform_liveness_check(frames)
    result["liveness_passed"] = liveness["passed"]
    if not liveness["passed"]:
        result["reason"] = f"Liveness Failed: {liveness['reason']}"
        logger.warning(f"[Attendance] student={student_id} liveness failed: {liveness['reason']}")
        return result

    # ── 4. Embedding ──────────────────────────────────────────────────────────
    probe = generate_face_embedding(img_bytes)
    if probe is None:
        result["reason"] = "Embedding Generation Failed"
        logger.error(f"[Attendance] student={student_id} embedding failed")
        return result

    # ── 5. Compare ────────────────────────────────────────────────────────────
    comparison = compare_embeddings(probe, registered_embedding)
    result.update({
        "valid":      comparison["match"],
        "match":      comparison["match"],
        "distance":   comparison["distance"],
        "confidence": comparison["confidence"],
        "reason":     "OK" if comparison["match"] else (
            f"Face does not match registered profile "
            f"(confidence={comparison['confidence']}%)"
        ),
    })

    if comparison["match"]:
        logger.info(
            f"[Attendance] student={student_id} VERIFIED ✓ "
            f"confidence={comparison['confidence']}%"
        )
    else:
        logger.warning(
            f"[Attendance] student={student_id} MISMATCH "
            f"confidence={comparison['confidence']}%"
        )

    return result
