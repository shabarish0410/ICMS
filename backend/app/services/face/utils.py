"""face/utils.py — Low-level image I/O: base64 decode, bytes ↔ PIL, PIL → numpy."""

import base64
import io
import logging

import numpy as np
from PIL import Image

logger = logging.getLogger("icms.face.utils")


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
