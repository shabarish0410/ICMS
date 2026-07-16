"""
model_cache.py — Warm up and cache heavy ML models once at application startup.

Call `warmup_models()` inside the FastAPI lifespan event (via run_in_executor
so it does not block the event loop). Subsequent requests use the already-loaded
weights from memory — eliminates ~2-3 s cold-start latency per request.
"""
import logging
import os
from typing import Optional, Any

logger = logging.getLogger("icms.model_cache")

_arcface_model = None
_mediapipe_face_mesh = None

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
    global _arcface_model
    if _arcface_model is None:
        _log_memory("Before loading DeepFace")
        try:
            # Fix 3: Disable TensorFlow GPU Detection
            os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
            os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
            
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
            logger.warning("DeepFace not installed.")
        except Exception as e:
            logger.error(f"Failed to load ArcFace: {e}", exc_info=True)
    return _arcface_model

def get_mediapipe_face_mesh() -> Any:
    """Lazy load the MediaPipe FaceMesh."""
    global _mediapipe_face_mesh
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
            logger.warning("MediaPipe not installed.")
        except Exception as e:
            logger.error(f"Failed to load MediaPipe: {e}", exc_info=True)
    return _mediapipe_face_mesh

def is_deepface_ready() -> bool:
    return _arcface_model is not None

def is_mediapipe_ready() -> bool:
    return _mediapipe_face_mesh is not None
