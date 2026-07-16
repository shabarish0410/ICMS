"""
face_config.py — Centralized configuration for the ICMS Face Registration V2 pipeline.

All thresholds, limits, timeouts, and behavioural constants live here.
Import from this module everywhere; never hardcode values in service files.

Feature flag
------------
FACE_PIPELINE_V2 is read once at process startup from the environment variable.
It is NOT dynamic — a process restart is required to toggle it.
On Render.com: change via Environment Variables dashboard → Manual Deploy.
"""
import os

# ── Quality thresholds ────────────────────────────────────────────────────────
FACE_CONFIDENCE_MIN      = 0.90   # Minimum DeepFace detection confidence (was 0.85 — Bug B5)
BLUR_THRESHOLD           = 70.0   # Laplacian variance; lower = blurrier
BRIGHTNESS_MIN           = 60     # Mean pixel value (0-255)
BRIGHTNESS_MAX           = 240    # Clamp for over-exposure
MIN_FACE_SIZE_PX         = 80     # Minimum face bounding-box side (pixels)
EYE_OPENNESS_MIN_EAR     = 0.15   # Eye Aspect Ratio below this = closed
POSE_YAW_MAX_DEG         = 20.0   # Maximum acceptable head yaw (degrees)
POSE_PITCH_MAX_DEG       = 15.0   # Maximum acceptable head pitch (degrees)

# ── Embedding ─────────────────────────────────────────────────────────────────
EMBEDDING_DIM              = 512
EMBEDDING_MODEL            = "ArcFace"
EMBEDDING_MODEL_VERSION    = "1.0"
DETECTOR_BACKEND           = "opencv"
FACE_MATCH_THRESHOLD       = 0.40   # Cosine distance — lower = more similar

# ── Google Drive ──────────────────────────────────────────────────────────────
DRIVE_UPLOAD_TIMEOUT       = 30     # Seconds per individual API call
DRIVE_MAX_ATTEMPTS         = 3      # Total upload attempts (1 original + 2 retries)
DRIVE_RETRY_BASE_DELAY     = 1.0    # Seconds; exponential with jitter
DRIVE_RETRY_MAX_DELAY      = 8.0    # Seconds; cap on backoff
# HTTP status codes that are safe to retry on Drive
DRIVE_RETRYABLE_STATUSES   = {429, 500, 502, 503, 504}

# ── Image processing ──────────────────────────────────────────────────────────
MAX_IMAGE_SIZE_BYTES       = 5 * 1024 * 1024   # 5 MB hard limit before compression
COMPRESS_MAX_DIM           = 640               # Max width/height after resize
COMPRESS_JPEG_QUALITY      = 85                # JPEG quality for re-encoding

# ── Liveness ──────────────────────────────────────────────────────────────────
LIVENESS_BLINK_THRESHOLD   = 0.20    # EAR below this = blink detected
LIVENESS_YAW_RANGE_MIN     = 0.05    # Normalised yaw delta for head-turn detection
LIVENESS_FRAMES_REQUIRED   = 30      # Minimum frames collected before capture fires
LIVENESS_CHALLENGES        = ["blink", "turn_left", "turn_right", "smile"]

# ── Idempotency / Request IDs ─────────────────────────────────────────────────
REQUEST_ID_PREFIX          = "REG"
IDEMPOTENCY_TTL_HOURS      = 24

# ── Performance targets (milliseconds) ────────────────────────────────────────
# Used in structured logs. Stages that exceed their target emit a WARNING.
PERF_TARGETS: dict[str, int] = {
    "decode":    50,
    "compress":  50,
    "hash":      10,
    "validate":  500,
    "liveness":  200,
    "embed":     1000,
    "upload":    2000,
    "database":  300,
    "verify":    100,
    "cleanup":   200,
    "total":     4000,
}

# ── API deprecation ───────────────────────────────────────────────────────────
LEGACY_API_SUNSET          = "Wed, 31 Dec 2026 23:59:59 GMT"
LEGACY_API_SUCCESSOR       = "/api/v1/face/register"

# ── Feature flag ─────────────────────────────────────────────────────────────
# Set environment variable FACE_PIPELINE_V2=false to route all face requests
# through the original (V1) pipeline without any code changes.
# NOTE: This is read at startup only. Restart required to toggle.
FACE_PIPELINE_V2: bool = os.environ.get("FACE_PIPELINE_V2", "true").lower() not in ("false", "0", "no")
