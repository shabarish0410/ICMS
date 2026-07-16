"""face/quality.py — Image quality analysis: blur, brightness, face size, pose, eye-openness, occlusion."""

import logging
import math
from typing import Dict, Any, Optional

import numpy as np

from app.core.face_config import (
    MIN_FACE_SIZE_PX, BLUR_THRESHOLD, FACE_CONFIDENCE_MIN,
    BRIGHTNESS_MIN, BRIGHTNESS_MAX, EYE_OPENNESS_MIN_EAR,
    POSE_YAW_MAX_DEG, POSE_PITCH_MAX_DEG,
)

logger = logging.getLogger("icms.face.quality")


# ── Basic Metrics ─────────────────────────────────────────────────────────────

def compute_blur_score(gray_array: np.ndarray) -> float:
    """
    Compute Laplacian variance as a sharpness metric.
    Higher = sharper. Returns 999 (assume sharp) if cv2 is unavailable.
    """
    try:
        import cv2
        lap = cv2.Laplacian(gray_array, cv2.CV_64F)
        return float(lap.var())
    except ImportError:
        logger.warning("[Quality] cv2 not available; blur check skipped")
        return 999.0
    except Exception as e:
        logger.error(f"[Quality] compute_blur_score error: {e}")
        return 999.0


def compute_brightness(gray_array: np.ndarray) -> float:
    """Return mean pixel brightness (0–255)."""
    return float(np.mean(gray_array))


def check_face_size(facial_area: dict) -> bool:
    """Return True if face bounding box is large enough for reliable embedding."""
    w = facial_area.get("w", 0)
    h = facial_area.get("h", 0)
    return w >= MIN_FACE_SIZE_PX and h >= MIN_FACE_SIZE_PX


def compute_quality_score(blur_score: float, brightness: float, confidence: float) -> float:
    """
    Composite quality score in [0, 100].
    Weighs sharpness (50%), brightness normality (30%), detection confidence (20%).
    """
    blur_norm   = min(blur_score / 300.0, 1.0)
    bright_norm = max(0.0, min(1.0 - abs(brightness - 150) / 150.0, 1.0))
    conf_norm   = max(0.0, min(confidence, 1.0))
    score       = (blur_norm * 0.50 + bright_norm * 0.30 + conf_norm * 0.20) * 100
    return round(score, 1)


# ── Eye Openness ──────────────────────────────────────────────────────────────

def check_eye_openness(ear: Optional[float]) -> bool:
    """
    Return True if the Eye Aspect Ratio indicates open eyes.
    EAR < EYE_OPENNESS_MIN_EAR → eyes closed or occluded.
    Returns True (pass) when EAR is unavailable.
    """
    if ear is None:
        return True   # cannot determine — do not fail
    return ear >= EYE_OPENNESS_MIN_EAR


# ── Pose Estimation ───────────────────────────────────────────────────────────

def estimate_yaw_pitch(facial_area: dict, image_width: int, image_height: int) -> tuple[float, float]:
    """
    Approximate yaw and pitch angles in degrees from the facial bounding box.
    This is a geometric heuristic (not a true 3D pose solver).

    Returns (yaw_deg, pitch_deg) — both clamped to [-90, 90].
    """
    try:
        x = facial_area.get("x", 0)
        y = facial_area.get("y", 0)
        w = facial_area.get("w", 1)
        h = facial_area.get("h", 1)

        cx = x + w / 2
        cy = y + h / 2

        # Offset of face center from image center, normalised to [-1, 1]
        norm_x = (cx - image_width  / 2) / (image_width  / 2) if image_width  > 0 else 0
        norm_y = (cy - image_height / 2) / (image_height / 2) if image_height > 0 else 0

        yaw_deg   = math.degrees(math.asin(max(-1.0, min(1.0, norm_x))))
        pitch_deg = math.degrees(math.asin(max(-1.0, min(1.0, norm_y))))
        return yaw_deg, pitch_deg
    except Exception as e:
        logger.debug(f"[Quality] estimate_yaw_pitch error: {e}")
        return 0.0, 0.0


def check_pose(facial_area: dict, image_width: int, image_height: int) -> tuple[bool, float, float]:
    """
    Return (pose_ok, yaw_deg, pitch_deg).
    Pose fails if yaw or pitch exceeds configured limits.
    """
    yaw, pitch = estimate_yaw_pitch(facial_area, image_width, image_height)
    ok = abs(yaw) <= POSE_YAW_MAX_DEG and abs(pitch) <= POSE_PITCH_MAX_DEG
    return ok, round(yaw, 1), round(pitch, 1)


# ── Occlusion Heuristic ───────────────────────────────────────────────────────

def check_occlusion(img_array: np.ndarray, facial_area: dict) -> bool:
    """
    Lightweight occlusion heuristic: measure pixel-variance inside the lower half
    of the face bounding box (mouth/chin region). Very low variance suggests a mask,
    hand, or card covering part of the face.

    Returns True (no occlusion detected), False (likely occluded).
    Returns True when img_array is unavailable.
    """
    try:
        x = max(0, facial_area.get("x", 0))
        y = max(0, facial_area.get("y", 0))
        w = facial_area.get("w", 0)
        h = facial_area.get("h", 0)
        if w < 20 or h < 20:
            return True   # too small to analyse

        # Lower half of face
        half_y = y + h // 2
        region = img_array[half_y: y + h, x: x + w]
        if region.size == 0:
            return True

        variance = float(np.var(region))
        # Very low variance → nearly uniform colour → likely occlusion
        occlusion_detected = variance < 80.0
        if occlusion_detected:
            logger.debug(f"[Quality] Occlusion suspected: lower-face variance={variance:.1f}")
        return not occlusion_detected
    except Exception as e:
        logger.debug(f"[Quality] check_occlusion error (non-fatal): {e}")
        return True   # fail open — do not block on unexpected error


# ── Full Quality Assessment ───────────────────────────────────────────────────

def assess_quality(
    img_array: np.ndarray,
    facial_area: dict,
    confidence: float,
    ear: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Run all quality checks against a detected face.

    Args:
        img_array:   RGB numpy array of the full image.
        facial_area: {'x', 'y', 'w', 'h'} from DeepFace.
        confidence:  Detection confidence from DeepFace (0.0–1.0).
        ear:         Eye Aspect Ratio (optional, from MediaPipe).

    Returns:
        {
          'passed':       bool,
          'reason':       str,
          'blur_score':   float,
          'brightness':   float,
          'quality_score':float,
          'yaw_deg':      float,
          'pitch_deg':    float,
          'confidence':   float,
        }
    """
    try:
        import cv2
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if img_array.ndim == 3 else img_array
    except ImportError:
        gray = np.mean(img_array, axis=2).astype(np.uint8) if img_array.ndim == 3 else img_array

    h_img, w_img = img_array.shape[:2]

    blur       = compute_blur_score(gray)
    brightness = compute_brightness(gray)
    face_ok    = check_face_size(facial_area)
    pose_ok, yaw_deg, pitch_deg = check_pose(facial_area, w_img, h_img)
    eyes_ok    = check_eye_openness(ear)
    no_occl    = check_occlusion(img_array, facial_area)

    base = {"blur_score": blur, "brightness": brightness, "yaw_deg": yaw_deg,
            "pitch_deg": pitch_deg, "confidence": confidence, "quality_score": 0}

    logger.debug(
        f"[Quality] blur={blur:.1f} bright={brightness:.1f} conf={confidence:.3f} "
        f"face_size_ok={face_ok} pose_ok={pose_ok} eyes_ok={eyes_ok} no_occl={no_occl}"
    )

    if not face_ok:
        return {**base, "passed": False, "reason": "Face too small in frame. Move closer to the camera."}
    if confidence < FACE_CONFIDENCE_MIN:
        return {**base, "passed": False, "reason": f"Low detection confidence ({confidence:.2f}). Ensure good lighting and remove obstructions."}
    if blur < BLUR_THRESHOLD:
        return {**base, "passed": False, "reason": "Image too blurry. Hold still and ensure good lighting."}
    if brightness < BRIGHTNESS_MIN:
        return {**base, "passed": False, "reason": "Image too dark. Move to a brighter area."}
    if brightness > BRIGHTNESS_MAX:
        return {**base, "passed": False, "reason": "Image overexposed. Reduce backlighting."}
    if not pose_ok:
        return {**base, "passed": False, "reason": f"Head angle too extreme (yaw={yaw_deg}°, pitch={pitch_deg}°). Face the camera directly."}
    if not eyes_ok:
        return {**base, "passed": False, "reason": "Eyes appear closed. Please open your eyes fully."}
    if not no_occl:
        return {**base, "passed": False, "reason": "Face appears partially covered. Remove masks, glasses, or obstructions."}

    score = compute_quality_score(blur, brightness, confidence)
    return {**base, "passed": True, "reason": "OK", "quality_score": score}
