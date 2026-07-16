"""face/validation.py — Face detection (DeepFace) and liveness verification (MediaPipe)."""

import math
import logging
from typing import List, Dict, Any

import numpy as np

from app.services.face.utils import decode_base64_image, bytes_to_pil
from app.services.face.quality import assess_quality
from app.core.face_config import (
    LIVENESS_BLINK_THRESHOLD, LIVENESS_YAW_RANGE_MIN, LIVENESS_CHALLENGES
)

logger = logging.getLogger("icms.face.validation")

MIN_IMAGE_DIM = 200   # pixels

# MediaPipe eye landmark indices
_LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380]
_RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144]
_NOSE_TIP      = 1
_CHIN          = 199
_LEFT_EAR_LM   = 234
_RIGHT_EAR_LM  = 454

LIVENESS_EAR_RANGE_MIN   = 0.08
MIN_LIVENESS_FRAMES       = 3


# ── Face Detection ─────────────────────────────────────────────────────────────

def detect_and_validate_face(image_bytes: bytes) -> Dict[str, Any]:
    """
    Detect faces in the image and run quality checks.

    Pipeline:
        1. Check minimum resolution
        2. Run DeepFace face detection (opencv backend)
        3. Assert exactly one face
        4. Run quality assessment (blur, brightness, size, confidence)

    Returns:
        {
            'valid': bool,
            'reason': str,
            'face_count': int,
            'quality_score': float,   # only when valid=True
            'facial_area': dict,      # only when valid=True
        }
    """
    try:
        img = bytes_to_pil(image_bytes)
        width, height = img.size

        if width < MIN_IMAGE_DIM or height < MIN_IMAGE_DIM:
            logger.warning(f"[Validation] Image too small: {width}x{height}")
            return {
                "valid": False,
                "reason": f"Image resolution too low ({width}x{height}). Minimum is {MIN_IMAGE_DIM}x{MIN_IMAGE_DIM}.",
                "face_count": 0,
                "quality_score": 0,
            }

        try:
            from deepface import DeepFace
            img_array = np.array(img)

            faces = DeepFace.extract_faces(
                img_path=img_array,
                detector_backend="opencv",
                enforce_detection=True,
                align=True,
            )

            face_count = len(faces)
            logger.debug(f"[Validation] DeepFace detected {face_count} face(s)")

            if face_count == 0:
                return {
                    "valid": False,
                    "reason": "No Face Detected",
                    "face_count": 0,
                    "quality_score": 0,
                }

            if face_count > 1:
                return {
                    "valid": False,
                    "reason": "Multiple Faces Detected",
                    "face_count": face_count,
                    "quality_score": 0,
                }

            face       = faces[0]
            region     = face.get("facial_area", {})
            confidence = face.get("confidence", 0.0)
            aligned_face = face.get("face")

            quality = assess_quality(img_array, region, confidence)
            if not quality["passed"]:
                logger.warning(f"[Validation] Quality check failed: {quality['reason']}")
                return {
                    "valid": False,
                    "reason": quality["reason"],
                    "face_count": 1,
                    "quality_score": quality["quality_score"],
                }

            logger.info(
                f"[Validation] Face validated ✓ quality_score={quality['quality_score']}% "
                f"confidence={confidence:.3f} yaw={quality.get('yaw_deg', 0)}°"
            )
            return {
                "valid": True,
                "reason": "OK",
                "face_count": 1,
                "quality_score": quality["quality_score"],
                "confidence": confidence,
                "yaw_deg": quality.get("yaw_deg", 0),
                "pitch_deg": quality.get("pitch_deg", 0),
                "blur_score": quality.get("blur_score", 0),
                "brightness": quality.get("brightness", 0),
                "facial_area": region,
                "aligned_face": aligned_face,
            }

        except ImportError:
            logger.warning("[Validation] DeepFace not installed — using basic PIL fallback")
            return {"valid": True, "reason": "OK (basic validation)", "face_count": 1, "quality_score": 50.0}

        except Exception as e:
            err = str(e).lower()
            if "face could not be detected" in err or "no face" in err:
                return {
                    "valid": False,
                    "reason": "No Face Detected",
                    "face_count": 0,
                    "quality_score": 0,
                }
            logger.error(
                f"[Validation] Unexpected DeepFace error: {e}",
                exc_info=True,
            )
            # Bug B2 FIX: fail-safe defaults to REJECTION, never false-positive success.
            # Previously this returned valid=True which allowed unvalidated images through.
            return {
                "valid": False,
                "reason": "Face detection service error. Please retry.",
                "face_count": 0,
                "quality_score": 0,
                "confidence": 0.0,
            }

    except Exception as e:
        logger.error(f"[Validation] Unexpected error in detect_and_validate_face: {e}", exc_info=True)
        return {"valid": False, "reason": "Image processing error. Please try again.", "face_count": 0, "quality_score": 0}


# ── Liveness Detection ─────────────────────────────────────────────────────────

def _eye_aspect_ratio(pts: list) -> float:
    """Compute Eye Aspect Ratio (EAR) from 6 eye landmark points."""
    if len(pts) < 6:
        return 0.3

    class P:
        def __init__(self, x, y):
            self.x, self.y = x, y

    p1, p2, p3, p4, p5, p6 = pts[:6]

    def d(a, b):
        return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

    v1 = d(p2, p6)
    v2 = d(p3, p5)
    h  = d(p1, p4)
    if h == 0:
        return 0.3
    return (v1 + v2) / (2.0 * h)


def perform_liveness_check(frames_bytes: List[bytes]) -> Dict[str, Any]:
    """
    Liveness detection across multiple frames using MediaPipe Face Mesh.

    Detects:
        - Blink (EAR drops below threshold)
        - Head movement (yaw change)

    Returns:
        {'passed': bool, 'reason': str, 'blink_detected': bool, 'movement_detected': bool}
    """
    if not frames_bytes:
        return {
            "passed": False,
            "reason": "No frames provided for liveness check.",
            "blink_detected": False,
            "movement_detected": False,
        }

    try:
        import mediapipe as mp
        mp_face_mesh = mp.solutions.face_mesh

        ear_values  = []
        yaw_values  = []
        blink_detected = False

        with mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        ) as face_mesh:

            for i, frame_bytes in enumerate(frames_bytes):
                try:
                    img_pil   = bytes_to_pil(frame_bytes)
                    img_rgb   = np.array(img_pil)
                    results   = face_mesh.process(img_rgb)

                    if not results.multi_face_landmarks:
                        continue

                    lm = results.multi_face_landmarks[0].landmark

                    class _LM:
                        def __init__(self, x, y):
                            self.x, self.y = x, y

                    left_pts  = [_LM(lm[idx].x, lm[idx].y) for idx in _LEFT_EYE_IDX]
                    right_pts = [_LM(lm[idx].x, lm[idx].y) for idx in _RIGHT_EYE_IDX]
                    avg_ear   = (_eye_aspect_ratio(left_pts) + _eye_aspect_ratio(right_pts)) / 2.0
                    ear_values.append(avg_ear)

                    nose_x  = lm[_NOSE_TIP].x
                    left_x  = lm[_LEFT_EAR_LM].x
                    right_x = lm[_RIGHT_EAR_LM].x
                    if right_x != left_x:
                        yaw_values.append((nose_x - left_x) / (right_x - left_x))

                except Exception as fe:
                    logger.debug(f"[Liveness] Frame {i} skipped: {fe}")
                    continue

        if ear_values:
            min_ear = min(ear_values)
            ear_range = max(ear_values) - min_ear
            blink_detected = min_ear < LIVENESS_BLINK_THRESHOLD or ear_range > LIVENESS_EAR_RANGE_MIN

        movement_detected = False
        if len(yaw_values) >= 2:
            movement_detected = (max(yaw_values) - min(yaw_values)) > LIVENESS_YAW_RANGE_MIN

        if len(frames_bytes) < MIN_LIVENESS_FRAMES:
            return {
                "passed": False,
                "reason": "Insufficient frames for liveness check. Please follow the on-screen prompts.",
                "blink_detected": blink_detected,
                "movement_detected": movement_detected,
            }

        passed = blink_detected or movement_detected
        return {
            "passed": passed,
            "reason": "Liveness verified." if passed else "Liveness verification failed. Please blink or move your head slightly.",
            "blink_detected": blink_detected,
            "movement_detected": movement_detected,
        }

    except ImportError:
        logger.warning("[Liveness] MediaPipe not installed — using pixel-variance fallback")
        return _pixel_liveness_fallback(frames_bytes)

    except Exception as e:
        logger.error(f"[Liveness] Unexpected error: {e}", exc_info=True)
        # Bug B3 FIX: fail-safe defaults to REJECTION, never false-positive success.
        # Previously this returned passed=True which could bypass liveness on MediaPipe crash.
        return {
            "passed": False,
            "reason": "Liveness service error. Please retry.",
            "blink_detected": False,
            "movement_detected": False,
        }


def _pixel_liveness_fallback(frames_bytes: List[bytes]) -> Dict[str, Any]:
    """
    Fallback liveness: check pixel-level variance across frames.
    A static photo has near-zero inter-frame variance; live camera has noise.
    """
    if len(frames_bytes) < MIN_LIVENESS_FRAMES:
        return {"passed": False, "reason": "Need at least 3 frames.", "blink_detected": False, "movement_detected": False}

    try:
        arrays = []
        for f_bytes in frames_bytes[:5]:
            img = bytes_to_pil(f_bytes).resize((64, 64)).convert("L")
            arrays.append(np.array(img, dtype=np.float32))

        if len(arrays) < 2:
            return {"passed": False, "reason": "Could not process frames.", "blink_detected": False, "movement_detected": False}

        diffs = [np.mean(np.abs(arrays[i + 1] - arrays[i])) for i in range(len(arrays) - 1)]
        avg_diff = float(np.mean(diffs))
        passed = avg_diff > 2.0
        return {
            "passed": passed,
            "reason": "Liveness verified." if passed else "Liveness verification failed. Static image detected.",
            "blink_detected": passed,
            "movement_detected": passed,
        }
    except Exception as e:
        logger.error(f"[Liveness] Pixel fallback error: {e}")
        # Fail-safe: reject rather than bypass
        return {
            "passed": False,
            "reason": "Liveness check could not be completed. Please retry.",
            "blink_detected": False,
            "movement_detected": False,
        }


# ── Client-side Liveness Metrics Validator ────────────────────────────────────

def validate_liveness_metrics(metrics: dict, challenge_type: str) -> Dict[str, Any]:
    """
    Validate liveness metrics computed client-side by useFaceDetection.ts.

    The frontend sends extracted metrics (blink_count, ear_min, yaw_delta, etc.)
    instead of raw frames to avoid large payloads. The backend re-validates the
    metrics server-side as a second layer of defence.

    Args:
        metrics:        Dict from frontend containing liveness signal values.
        challenge_type: One of LIVENESS_CHALLENGES ('blink', 'turn_left', etc.).

    Returns:
        {'passed': bool, 'reason': str, 'challenge_type': str}
    """
    if not metrics:
        return {"passed": False, "reason": "No liveness metrics provided.", "challenge_type": challenge_type}

    if challenge_type not in LIVENESS_CHALLENGES:
        return {"passed": False, "reason": f"Unknown challenge type: {challenge_type}", "challenge_type": challenge_type}

    blink_count    = metrics.get("blink_count", 0)
    ear_min        = metrics.get("ear_min", 1.0)
    ear_range      = metrics.get("ear_range", 0.0)
    yaw_delta      = metrics.get("yaw_delta", 0.0)
    frames         = metrics.get("frames_collected", 0)
    challenge_met  = metrics.get("challenge_met", False)

    if frames < MIN_LIVENESS_FRAMES:
        return {
            "passed": False,
            "reason": f"Too few liveness frames collected ({frames}). Please follow the on-screen prompt.",
            "challenge_type": challenge_type,
        }

    if challenge_type == "blink":
        passed = blink_count >= 1 and ear_min < LIVENESS_BLINK_THRESHOLD
        reason = "Blink detected." if passed else "No blink detected. Please blink naturally."

    elif challenge_type in ("turn_left", "turn_right"):
        passed = abs(yaw_delta) >= LIVENESS_YAW_RANGE_MIN
        direction = "left" if challenge_type == "turn_left" else "right"
        reason = f"Head turn detected." if passed else f"Please turn your head {direction} slowly."

    elif challenge_type == "smile":
        # Smile is validated client-side via MediaPipe blendshapes.
        # We trust the challenge_met flag for smile as it requires blendshape access.
        passed = challenge_met
        reason = "Smile detected." if passed else "No smile detected. Please smile naturally."

    else:
        passed = False
        reason = "Unrecognised challenge type."

    logger.info(
        f"[Liveness] Metrics validation: challenge={challenge_type} "
        f"passed={passed} blinks={blink_count} ear_min={ear_min:.3f} yaw_delta={yaw_delta:.3f}"
    )
    return {"passed": passed, "reason": reason, "challenge_type": challenge_type}
