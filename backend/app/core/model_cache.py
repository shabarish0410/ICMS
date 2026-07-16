"""
model_cache.py — Warm up and cache heavy ML models once at application startup.

Call `warmup_models()` inside the FastAPI lifespan event (via run_in_executor
so it does not block the event loop). Subsequent requests use the already-loaded
weights from memory — eliminates ~2-3 s cold-start latency per request.
"""
import logging
import os
import time
from typing import Optional, Any, Dict

# Fix: Set TF CPU-only mode before any TF imports
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

logger = logging.getLogger("icms.model_cache")

_arcface_model = None
_mediapipe_face_mesh = None
_deepface_error = None
_mediapipe_error = None
_startup_time = time.time()

def _log_memory(stage: str):
    try:
        import psutil
        process = psutil.Process(os.getpid())
        mem_mb = process.memory_info().rss / 1024 / 1024
        logger.info(f"[Memory] {stage}: {mem_mb:.2f} MB")
    except ImportError:
        pass

def get_arcface_model() -> Any:
    """Lazy load the ArcFace model."""
    global _arcface_model, _deepface_error
    if _arcface_model is None:
        _log_memory("Before loading DeepFace")
        try:
            try:
                import tensorflow as tf
                tf.config.set_visible_devices([], "GPU")
            except ImportError:
                pass

            from deepface import DeepFace
            # Fix 6: Build model once and reuse
            _arcface_model = DeepFace.build_model("ArcFace")
            _log_memory("After loading DeepFace")
        except ImportError:
            _deepface_error = "DeepFace not installed."
            logger.warning(_deepface_error)
        except Exception as e:
            _deepface_error = str(e)
            logger.error(f"Failed to load ArcFace: {e}", exc_info=True)
    return _arcface_model

def get_mediapipe_face_mesh() -> Any:
    """Lazy load the MediaPipe FaceMesh."""
    global _mediapipe_face_mesh, _mediapipe_error
    if _mediapipe_face_mesh is None:
        _log_memory("Before loading MediaPipe")
        try:
            import mediapipe as mp
            _mediapipe_face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
            )
            _log_memory("After loading MediaPipe")
        except ImportError:
            _mediapipe_error = "MediaPipe not installed."
            logger.warning(_mediapipe_error)
        except Exception as e:
            _mediapipe_error = str(e)
            logger.error(f"Failed to load MediaPipe: {e}", exc_info=True)
    return _mediapipe_face_mesh

def is_deepface_ready() -> bool:
    return _arcface_model is not None

def is_mediapipe_ready() -> bool:
    return _mediapipe_face_mesh is not None

def get_startup_status() -> Dict:
    """
    Returns the current status of the ML models.
    Used by /api/v1/face/health.
    """
    return {
        "startup_complete": (
            is_deepface_ready() and
            is_mediapipe_ready()
        ),
        "deepface_ready": is_deepface_ready(),
        "deepface_error": _deepface_error,
        "mediapipe_ready": is_mediapipe_ready(),
        "mediapipe_error": _mediapipe_error,
        "arcface_loaded": _arcface_model is not None,
        "mediapipe_loaded": _mediapipe_face_mesh is not None,
        "startup_time": _startup_time,
        "embedding_model": "ArcFace",
        "pipeline_version": "V2_face_pipeline"
    }

def warmup_models():
    """
    Load all heavy ML models during FastAPI startup.
    """
    logger.info("Loading ArcFace model...")
    get_arcface_model()

    # MediaPipe is no longer warmed up at startup to save memory
    # logger.info("Loading MediaPipe...")
    # get_mediapipe_face_mesh()

    logger.info("Model warmup completed.")
