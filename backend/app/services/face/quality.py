"""
face/quality.py
─────────────────────────────────────────────────
Responsibility: Image quality analysis.
  - Blur detection (Laplacian variance)
  - Brightness / over-exposure check
  - Face size check
  - Face confidence check
  - Composite quality score

No database access. No external service calls.
"""
import logging
from typing import Dict, Any

import numpy as np

logger = logging.getLogger("icms.face.quality")

# ── Thresholds ────────────────────────────────────────────────────────────────
MIN_FACE_SIZE_PX       = 80       # Minimum face width/height in pixels
MIN_BLUR_SCORE         = 70.0     # Laplacian variance — lower = blurrier
MIN_FACE_CONFIDENCE    = 0.85     # DeepFace detection confidence
MIN_BRIGHTNESS         = 60       # Average pixel value (0-255)
MAX_BRIGHTNESS         = 240      # Clamp for over-exposure


def compute_blur_score(gray_array: np.ndarray) -> float:
    """
    Compute Laplacian variance as a sharpness metric.
    Higher = sharper.
    """
    try:
        import cv2
        lap = cv2.Laplacian(gray_array, cv2.CV_64F)
        return float(lap.var())
    except ImportError:
        logger.warning("[Quality] cv2 not available; blur check skipped")
        return 999.0   # Assume sharp if cv2 missing
    except Exception as e:
        logger.error(f"[Quality] compute_blur_score error: {e}")
        return 999.0


def compute_brightness(gray_array: np.ndarray) -> float:
    """Return mean pixel brightness (0–255)."""
    return float(np.mean(gray_array))


def check_face_size(facial_area: dict) -> bool:
    """Return True if face is large enough for reliable embedding."""
    w = facial_area.get("w", 0)
    h = facial_area.get("h", 0)
    return w >= MIN_FACE_SIZE_PX and h >= MIN_FACE_SIZE_PX


def compute_quality_score(blur_score: float, brightness: float, confidence: float) -> float:
    """
    Composite quality score in [0, 100].
    Weighs sharpness (50%), brightness normality (30%), detection confidence (20%).
    """
    # Normalise blur: clamp at 300 max (very sharp), map to 0-1
    blur_norm = min(blur_score / 300.0, 1.0)
    # Normalise brightness: peak at 150, fall off to edges
    bright_norm = 1.0 - abs(brightness - 150) / 150.0
    bright_norm = max(0.0, min(bright_norm, 1.0))
    # Confidence already 0-1
    conf_norm = max(0.0, min(confidence, 1.0))

    score = (blur_norm * 0.50 + bright_norm * 0.30 + conf_norm * 0.20) * 100
    return round(score, 1)


def assess_quality(img_array: np.ndarray, facial_area: dict, confidence: float) -> Dict[str, Any]:
    """
    Run all quality checks against a detected face.

    Args:
        img_array:   RGB numpy array of the full image.
        facial_area: {'x', 'y', 'w', 'h'} from DeepFace.
        confidence:  Detection confidence from DeepFace.

    Returns:
        {
          'passed': bool,
          'reason': str,
          'blur_score': float,
          'brightness': float,
          'quality_score': float,
        }
    """
    import cv2
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if img_array.ndim == 3 else img_array

    blur = compute_blur_score(gray)
    brightness = compute_brightness(gray)
    face_ok = check_face_size(facial_area)

    logger.debug(
        f"[Quality] blur={blur:.1f}, brightness={brightness:.1f}, "
        f"confidence={confidence:.3f}, face_size_ok={face_ok}"
    )

    if not face_ok:
        return {
            "passed": False,
            "reason": "Face too small in frame. Move closer to the camera.",
            "blur_score": blur, "brightness": brightness, "quality_score": 0,
        }
    if confidence < MIN_FACE_CONFIDENCE:
        return {
            "passed": False,
            "reason": "Low face detection confidence. Ensure good lighting and remove obstructions.",
            "blur_score": blur, "brightness": brightness, "quality_score": 0,
        }
    if blur < MIN_BLUR_SCORE:
        return {
            "passed": False,
            "reason": "Image is too blurry. Hold the camera steady.",
            "blur_score": blur, "brightness": brightness, "quality_score": 0,
        }
    if brightness < MIN_BRIGHTNESS:
        return {
            "passed": False,
            "reason": "Image is too dark. Please move to a well-lit area.",
            "blur_score": blur, "brightness": brightness, "quality_score": 0,
        }
    if brightness > MAX_BRIGHTNESS:
        return {
            "passed": False,
            "reason": "Image is too bright / overexposed. Please reduce backlighting.",
            "blur_score": blur, "brightness": brightness, "quality_score": 0,
        }

    score = compute_quality_score(blur, brightness, confidence)
    return {
        "passed": True,
        "reason": "OK",
        "blur_score": blur,
        "brightness": brightness,
        "quality_score": score,
    }
