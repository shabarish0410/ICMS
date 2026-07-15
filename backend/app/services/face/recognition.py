"""face/recognition.py — Face recognition (probe → compare): no DB writes, no uploads."""

import logging
from typing import Optional, Dict, Any

from app.services.face.utils import decode_base64_image
from app.services.face.validation import detect_and_validate_face
from app.services.face.embedding import generate_face_embedding, compare_embeddings

logger = logging.getLogger("icms.face.recognition")


def recognize_face(
    image_b64: str,
    registered_embedding: Any,
    student_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Verify a probe image against a stored embedding.

    Pipeline:
        1. Decode image
        2. Validate (one face, quality check)
        3. Generate probe embedding
        4. Compare against registered embedding

    Args:
        image_b64:            Base64-encoded probe image.
        registered_embedding: The student's stored embedding (list[float] or str).
        student_id:           Optional, used for structured logging only.

    Returns:
        {
            'match':            bool,
            'distance':         float,
            'confidence':       float,   # 0–100%
            'threshold':        float,
            'validation_passed': bool,
            'quality_score':    float,
        }
    """
    prefix = f"[student_id={student_id}]" if student_id else "[anonymous]"

    # Step 1: Decode
    try:
        img_bytes = decode_base64_image(image_b64)
    except ValueError as e:
        logger.warning(f"[Recognition] {prefix} Image decode failed: {e}")
        return {
            "match": False, "distance": 1.0, "confidence": 0.0,
            "threshold": 0.40, "validation_passed": False, "quality_score": 0,
            "reason": f"Image Decode Failed: {e}",
        }

    # Step 2: Validate
    validation = detect_and_validate_face(img_bytes)
    if not validation["valid"]:
        logger.warning(f"[Recognition] {prefix} Validation failed: {validation['reason']}")
        return {
            "match": False, "distance": 1.0, "confidence": 0.0,
            "threshold": 0.40, "validation_passed": False,
            "quality_score": validation.get("quality_score", 0),
            "reason": validation["reason"],
        }

    # Step 3: Generate probe embedding
    probe_embedding = generate_face_embedding(img_bytes)
    if probe_embedding is None:
        logger.error(f"[Recognition] {prefix} Probe embedding generation failed")
        return {
            "match": False, "distance": 1.0, "confidence": 0.0,
            "threshold": 0.40, "validation_passed": True,
            "quality_score": validation.get("quality_score", 0),
            "reason": "Embedding Generation Failed",
        }

    # Step 4: Compare
    result = compare_embeddings(probe_embedding, registered_embedding)
    result["validation_passed"] = True
    result["quality_score"] = validation.get("quality_score", 0)

    if result["match"]:
        logger.info(
            f"[Recognition] {prefix} MATCH ✓ "
            f"confidence={result['confidence']}% distance={result['distance']}"
        )
    else:
        logger.warning(
            f"[Recognition] {prefix} NO MATCH "
            f"confidence={result['confidence']}% distance={result['distance']}"
        )

    return result
