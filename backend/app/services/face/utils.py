"""face/utils.py — Low-level image I/O: base64 decode, bytes ↔ PIL, compression, hashing, request IDs."""

import base64
import datetime
import hashlib
import io
import logging
import random
import string

import numpy as np
from PIL import Image

from app.core.face_config import (
    COMPRESS_MAX_DIM, COMPRESS_JPEG_QUALITY, REQUEST_ID_PREFIX
)

logger = logging.getLogger("icms.face.utils")


# ── Base64 / PIL / NumPy ──────────────────────────────────────────────────────

def decode_base64_image(image_b64: str) -> bytes:
    """
    Decode a base64-encoded image string to raw bytes.
    Strips the data-URI prefix (e.g. 'data:image/jpeg;base64,...') if present.

    Raises:
        ValueError: If the string is not valid base64.
    """
    if not image_b64:
        raise ValueError("Empty image_b64 string provided")
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    try:
        return base64.b64decode(image_b64)
    except Exception as e:
        raise ValueError(f"Invalid base64 image data: {e}") from e


def bytes_to_pil(image_bytes: bytes) -> Image.Image:
    """
    Convert raw image bytes to an RGB PIL Image.

    Raises:
        ValueError: If the bytes cannot be decoded as an image.
    """
    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Cannot decode image bytes: {e}") from e


def pil_to_numpy(img: Image.Image) -> np.ndarray:
    """Convert a PIL Image to a numpy uint8 RGB array."""
    return np.array(img)


def decode_to_pil(image_b64: str) -> tuple[bytes, Image.Image]:
    """
    Convenience: decode base64 and return (raw_bytes, PIL Image) together
    so callers can reuse the bytes without re-encoding.
    """
    raw = decode_base64_image(image_b64)
    img = bytes_to_pil(raw)
    return raw, img


# ── Image Compression ─────────────────────────────────────────────────────────

def compress_image(img_bytes: bytes) -> bytes:
    """
    Resize the image so its longest dimension is at most COMPRESS_MAX_DIM,
    then re-encode as JPEG at COMPRESS_JPEG_QUALITY.

    This reduces upload payload from ~200–500 KB to ~30–80 KB with negligible
    impact on ArcFace embedding quality (the model operates on a 112×112 crop).

    Args:
        img_bytes: Raw image bytes (any PIL-supported format).

    Returns:
        Compressed JPEG bytes.
    """
    try:
        img = bytes_to_pil(img_bytes)
        img.thumbnail((COMPRESS_MAX_DIM, COMPRESS_MAX_DIM), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=COMPRESS_JPEG_QUALITY, optimize=True)
        compressed = buf.getvalue()
        logger.debug(
            f"[Utils] Image compressed: {len(img_bytes):,} B → {len(compressed):,} B "
            f"({len(img_bytes) // 1024}KB → {len(compressed) // 1024}KB)"
        )
        return compressed
    except Exception as e:
        logger.warning(f"[Utils] compress_image failed, returning original: {e}")
        return img_bytes   # Fallback: return uncompressed rather than crash


# ── SHA-256 Hashing ───────────────────────────────────────────────────────────

def hash_image(img_bytes: bytes) -> str:
    """
    Compute the SHA-256 hex digest of raw image bytes.
    Used for duplicate upload detection and upload integrity verification.

    Returns:
        64-character lowercase hex string (no 'sha256:' prefix stored in DB).
    """
    return hashlib.sha256(img_bytes).hexdigest()


# ── Request ID Generator ──────────────────────────────────────────────────────

def generate_request_id() -> str:
    """
    Generate a human-readable, sortable unique request ID.

    Format: REG-YYYYMMDD-HHMMSS-XXXX
    Example: REG-20260716-192541-a3f1

    The UTC timestamp makes logs naturally sortable.
    The 4-char hex suffix provides uniqueness within the same second.
    """
    now    = datetime.datetime.utcnow()
    suffix = "".join(random.choices(string.hexdigits[:16], k=4)).lower()
    return f"{REQUEST_ID_PREFIX}-{now.strftime('%Y%m%d-%H%M%S')}-{suffix}"
