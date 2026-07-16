"""
model_cache.py — Warm up and cache heavy ML models once at application startup.

Call `warmup_models()` inside the FastAPI lifespan event (via run_in_executor
so it does not block the event loop). Subsequent requests use the already-loaded
weights from memory — eliminates ~2-3 s cold-start latency per request.
"""
import logging
from typing import Optional

logger = logging.getLogger("icms.model_cache")

_deepface_ready  = False
_mediapipe_ready = False
_startup_status: dict = {}


def warmup_models() -> dict:
    """
    Load ArcFace weights and MediaPipe FaceMesh into memory.

    Must be called from inside `asyncio.run_in_executor(None, warmup_models)`
    because DeepFace and MediaPipe initialisation is CPU-blocking.

    Returns:
        dict with keys: deepface, mediapipe, deepface_error, mediapipe_error
    """
    global _deepface_ready, _mediapipe_ready, _startup_status

    status: dict = {
        "deepface":        "unloaded",
        "mediapipe":       "unloaded",
        "deepface_error":  None,
        "mediapipe_error": None,
    }

    # ── ArcFace / DeepFace ────────────────────────────────────────────────────
    try:
        import numpy as np
        from deepface import DeepFace  # noqa: F401

        # Trigger model file download and weight loading with a 1-pixel dummy.
        # "skip" detector bypasses face detection so we only load the ArcFace model.
        dummy = np.zeros((112, 112, 3), dtype=np.uint8)
        DeepFace.represent(
            img_path=dummy,
            model_name="ArcFace",
            detector_backend="skip",
            enforce_detection=False,
        )
        _deepface_ready = True
        status["deepface"] = "loaded"
        logger.info("[ModelCache] ArcFace model warmed up ✓")

    except ImportError:
        status["deepface_error"] = "DeepFace not installed"
        logger.warning("[ModelCache] DeepFace not installed — ArcFace will be unavailable")
    except Exception as e:
        status["deepface_error"] = str(e)
        logger.error(f"[ModelCache] ArcFace warmup failed: {e}", exc_info=True)

    # ── MediaPipe FaceMesh ────────────────────────────────────────────────────
    try:
        import mediapipe as mp

        # Instantiate FaceMesh to trigger model download / compilation
        with mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
        ):
            pass
        _mediapipe_ready = True
        status["mediapipe"] = "loaded"
        logger.info("[ModelCache] MediaPipe FaceMesh warmed up ✓")

    except ImportError:
        status["mediapipe_error"] = "MediaPipe not installed"
        logger.warning("[ModelCache] MediaPipe not installed — liveness detection will use fallback")
    except Exception as e:
        status["mediapipe_error"] = str(e)
        logger.error(f"[ModelCache] MediaPipe warmup failed: {e}", exc_info=True)

    _startup_status = status
    return status


# ── Public accessors ──────────────────────────────────────────────────────────

def is_deepface_ready() -> bool:
    """True if ArcFace was successfully loaded at startup."""
    return _deepface_ready


def is_mediapipe_ready() -> bool:
    """True if MediaPipe FaceMesh was successfully loaded at startup."""
    return _mediapipe_ready


def get_startup_status() -> dict:
    """Return the status dict produced by `warmup_models()`."""
    return _startup_status
