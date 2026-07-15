"""face_service.py — Compatibility facade re-exporting the face/* package."""


# ── Utility functions (used by attendance_service & uniform_service) ──────────
from app.services.face.utils import decode_base64_image, bytes_to_pil  # noqa: F401

# ── Validation & liveness (used by attendance_service) ───────────────────────
from app.services.face.validation import (  # noqa: F401
    detect_and_validate_face as validate_face_image,
    perform_liveness_check,
)

# ── Embedding (used by attendance_service) ────────────────────────────────────
from app.services.face.embedding import (  # noqa: F401
    generate_face_embedding,
    compare_embeddings,
    cosine_distance,
    average_embeddings,
    FACE_MATCH_THRESHOLD,
    EMBEDDING_DIM,
)

# ── Registration workflow (used by routes/face.py via `face_service.*`) ───────
from app.services.face.registration import (  # noqa: F401
    register_face,
    update_face,
    get_face_status,
    get_my_face_status,
    reset_face,
    admin_face_status,
)
