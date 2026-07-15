"""face/embedding.py — ArcFace embedding generation and cosine-distance comparison."""

import logging
import ast
from typing import List, Optional, Dict, Any

import numpy as np
from PIL import Image

from app.services.face.utils import bytes_to_pil

logger = logging.getLogger("icms.face.embedding")

EMBEDDING_DIM        = 512
FACE_MATCH_THRESHOLD = 0.40   # Cosine distance ─ lower = more similar


# ── Embedding Generation ───────────────────────────────────────────────────────

def generate_face_embedding(image_source: Any, enforce_detection: bool = True) -> Optional[List[float]]:
    """
    Generate a unit-normalised 512-dim ArcFace embedding from raw image bytes or np.ndarray.
    Falls back to a perceptual-hash embedding if DeepFace is unavailable.

    Returns:
        List[float] of length 512, or None on failure.
    """
    try:
        if isinstance(image_source, bytes):
            img_pil   = bytes_to_pil(image_source)
            img_array = np.array(img_pil)
        elif isinstance(image_source, np.ndarray):
            img_array = image_source
        else:
            return None

        try:
            from deepface import DeepFace

            result = DeepFace.represent(
                img_path=img_array,
                model_name="ArcFace",
                detector_backend="opencv",
                enforce_detection=enforce_detection,
                align=enforce_detection,
            )
            raw_vec = result[0]["embedding"]
            vec     = np.array(raw_vec, dtype=np.float64)
            norm    = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            logger.debug(f"[Embedding] ArcFace embedding generated (dim={len(vec)})")
            return vec.tolist()

        except ImportError:
            logger.warning("[Embedding] DeepFace not installed — using perceptual-hash fallback")
            if isinstance(image_source, bytes):
                return _perceptual_hash_embedding(bytes_to_pil(image_source))
            return None

        except Exception as e:
            logger.error(f"[Embedding] DeepFace.represent error: {e}", exc_info=True)
            return None

    except Exception as e:
        logger.error(f"[Embedding] generate_face_embedding outer error: {e}", exc_info=True)
        return None


def _perceptual_hash_embedding(img_pil: Image.Image) -> List[float]:
    """
    Lightweight fallback: 8×8 grayscale resize → 512-dim unit vector.
    NOT production-grade. Use only when DeepFace is unavailable.
    """
    img_small = img_pil.convert("L").resize((64, 64))
    arr  = np.array(img_small, dtype=np.float64).flatten()
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    if len(arr) < EMBEDDING_DIM:
        arr = np.pad(arr, (0, EMBEDDING_DIM - len(arr)))
    else:
        arr = arr[:EMBEDDING_DIM]
    return arr.tolist()


def average_embeddings(embeddings: List[List[float]]) -> List[float]:
    """
    Average multiple face embeddings and L2-normalise the result.
    Useful for multi-shot registration.
    """
    arr = np.array(embeddings, dtype=np.float64)
    avg = np.mean(arr, axis=0)
    norm = np.linalg.norm(avg)
    if norm > 0:
        avg = avg / norm
    return avg.tolist()


# ── Cosine Distance & Comparison ───────────────────────────────────────────────

def cosine_distance(vec1: Any, vec2: Any) -> float:
    """
    Compute cosine distance between two embedding vectors.
    Accepts list[float] or a serialised string representation.
    Returns 1.0 (maximum distance) if either vector is zero or invalid.
    """
    def _parse(v):
        if isinstance(v, str):
            try:
                return ast.literal_eval(v)
            except Exception:
                return v
        return v

    try:
        a = np.array(_parse(vec1), dtype=np.float64)
        b = np.array(_parse(vec2), dtype=np.float64)
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        if na == 0 or nb == 0:
            return 1.0
        return float(1.0 - np.dot(a, b) / (na * nb))
    except Exception as e:
        logger.error(f"[Embedding] cosine_distance error: {e}")
        return 1.0


def compare_embeddings(embedding1: Any, embedding2: Any) -> Dict[str, Any]:
    """
    Compare two face embeddings.

    Returns:
        {
            'match':      bool,
            'distance':   float,
            'confidence': float,   # 0–100%
            'threshold':  float,
        }
    """
    distance   = cosine_distance(embedding1, embedding2)
    match      = distance < FACE_MATCH_THRESHOLD
    confidence = max(0.0, min(100.0, (1.0 - distance / FACE_MATCH_THRESHOLD) * 100))
    return {
        "match":      match,
        "distance":   round(distance, 4),
        "confidence": round(confidence, 1),
        "threshold":  FACE_MATCH_THRESHOLD,
    }
