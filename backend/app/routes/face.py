"""face.py — Face registration API routes.

Two routers are registered:
  - v1_router:     /api/v1/face/*  (canonical V2 pipeline)
  - legacy_router: /api/face/*     (deprecated; returns Deprecation/Sunset headers)

Both routers call exactly the same service functions.
No business logic is duplicated here.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, Request, Response

from app.core.security import get_current_user, require_roles
from app.core.face_config import LEGACY_API_SUNSET, LEGACY_API_SUCCESSOR, FACE_PIPELINE_V2
from app.schemas import (
    FaceRegisterRequest, FaceStatusOut, FaceUpdateRequest
)
from app.services import face_service

# ── V1 Router (canonical) ─────────────────────────────────────────────────────
v1_router = APIRouter(prefix="/api/v1/face", tags=["Face v1"])

# ── Legacy Router (deprecated) ────────────────────────────────────────────────
legacy_router = APIRouter(prefix="/api/face", tags=["Face (deprecated — use /api/v1/face)"])

# Keep the name 'router' for backward-compatible registration in main.py
router = legacy_router


def _deprecation_headers(response: Response) -> None:
    """Attach standard HTTP deprecation headers to a legacy-route response."""
    response.headers["Deprecation"]    = "true"
    response.headers["Sunset"]         = LEGACY_API_SUNSET
    response.headers["Link"]           = f'<{LEGACY_API_SUCCESSOR}>; rel="successor-version"'


# ── Shared request-context extraction ────────────────────────────────────────

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ============================================================================
# V1 Routes
# ============================================================================

@v1_router.post("/register", status_code=201)
async def register_face_v1(
    req: FaceRegisterRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """Register student face (V2 pipeline)."""
    return await face_service.register_face(
        req, current_user,
        idempotency_key=idempotency_key,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )


@v1_router.put("/update", status_code=200)
async def update_face_v1(
    req: FaceUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """Update student face registration (V2 pipeline)."""
    return await face_service.update_face(
        req, current_user,
        idempotency_key=idempotency_key,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )


@v1_router.get("/status/{student_id}", response_model=FaceStatusOut)
def get_face_status_v1(student_id: int, current_user: dict = Depends(get_current_user)):
    """Get face registration status for a student."""
    return face_service.get_face_status(student_id, current_user)


@v1_router.get("/my-status")
def get_my_face_status_v1(current_user: dict = Depends(get_current_user)):
    """Get face registration status for the currently logged-in student."""
    return face_service.get_my_face_status(current_user)


@v1_router.delete("/reset/{student_id}", status_code=200)
def reset_face_v1(
    student_id: int,
    current_user: dict = Depends(require_roles("admin", "super_admin")),
):
    """Admin: Reset a student's face registration."""
    return face_service.reset_face(student_id, current_user)


@v1_router.get("/admin/all-status")
def admin_face_status_v1(
    department: str = "",
    page: int = 1,
    size: int = 50,
    current_user: dict = Depends(require_roles("admin", "super_admin")),
):
    """Admin: Paginated face registration status."""
    return face_service.admin_face_status(department, page, size, current_user)


@v1_router.get("/register/status/{request_id}")
def get_registration_status(request_id: str, current_user: dict = Depends(get_current_user)):
    """Poll idempotency cache for a registration result by request_id."""
    from app.services.face.database import check_idempotency
    cached = check_idempotency(request_id)
    if not cached:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Request ID not found or expired")
    return cached


@v1_router.get("/health")
async def face_health():
    """
    Face pipeline health check.
    Reports database, Google Drive, model loading status, schema version, and embedding backend.
    """
    import asyncio
    from app.core.model_cache import get_startup_status, is_deepface_ready, is_mediapipe_ready
    from app.services.face.embedding_store import get_backend
    from app.core.face_config import EMBEDDING_MODEL, EMBEDDING_MODEL_VERSION
    from app.core.supabase import get_supabase

    db_healthy      = False
    schema_version  = "unknown"
    drive_healthy   = False
    drive_folder_accessible = False
    drive_folder_writable   = False

    # DB ping + schema version
    try:
        sb = get_supabase()
        result = sb.table("schema_migrations").select("version").eq(
            "version", "V2_face_pipeline"
        ).execute()
        db_healthy     = True
        schema_version = result.data[0]["version"] if result.data else "V1_legacy"
    except Exception as e:
        pass

    # Drive ping
    try:
        from app.services.google_drive import drive_service, FOLDER_ID
        if drive_service:
            meta = drive_service.files().get(
                fileId=FOLDER_ID, fields="id"
            ).execute()
            drive_healthy = True
            drive_folder_accessible = bool(meta.get("id"))
    except Exception:
        pass

    # Drive write-probe (run in executor to avoid blocking)
    if drive_healthy:
        try:
            from app.services.face.storage import probe_drive_writable
            loop = asyncio.get_event_loop()
            drive_folder_writable = await loop.run_in_executor(None, probe_drive_writable)
        except Exception:
            pass

    model_status = get_startup_status()
    all_ok = db_healthy and drive_healthy and is_deepface_ready() and is_mediapipe_ready()

    return {
        "status":                "healthy" if all_ok else "degraded",
        "pipeline_version":      "2.0" if FACE_PIPELINE_V2 else "1.0 (legacy flag active)",
        "schema_version":        schema_version,
        "embedding_backend":     get_backend(),
        "embedding_model":       EMBEDDING_MODEL,
        "embedding_model_version": EMBEDDING_MODEL_VERSION,
        "database":              "healthy" if db_healthy else "error",
        "google_drive":          "healthy" if drive_healthy else "error",
        "drive_folder_access":   drive_folder_accessible,
        "drive_folder_writable": drive_folder_writable,
        "deepface":              model_status.get("deepface", "unknown"),
        "mediapipe":             model_status.get("mediapipe", "unknown"),
        "feature_flag":          {
            "FACE_PIPELINE_V2": FACE_PIPELINE_V2,
            "dynamic":          False,
            "requires_restart": True,
        },
        "version":               "1.4.2",
    }


# ============================================================================
# Legacy Routes (deprecated) — same handlers, plus Deprecation headers
# ============================================================================

@legacy_router.post("/register", status_code=201)
async def register_face(
    req: FaceRegisterRequest,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """Register student face [DEPRECATED — use /api/v1/face/register]."""
    _deprecation_headers(response)
    return await face_service.register_face(
        req, current_user,
        idempotency_key=idempotency_key,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )


@legacy_router.get("/status/{student_id}", response_model=FaceStatusOut)
def get_face_status(student_id: int, response: Response, current_user: dict = Depends(get_current_user)):
    _deprecation_headers(response)
    return face_service.get_face_status(student_id, current_user)


@legacy_router.get("/my-status")
def get_my_face_status(response: Response, current_user: dict = Depends(get_current_user)):
    _deprecation_headers(response)
    return face_service.get_my_face_status(current_user)


@legacy_router.put("/update", status_code=200)
async def update_face(
    req: FaceUpdateRequest,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    _deprecation_headers(response)
    return await face_service.update_face(
        req, current_user,
        idempotency_key=idempotency_key,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )


@legacy_router.delete("/reset/{student_id}", status_code=200)
def reset_face(
    student_id: int,
    response: Response,
    current_user: dict = Depends(require_roles("admin", "super_admin")),
):
    _deprecation_headers(response)
    return face_service.reset_face(student_id, current_user)


@legacy_router.get("/admin/all-status")
def admin_face_status(
    department: str = "",
    page: int = 1,
    size: int = 50,
    response: Response = None,
    current_user: dict = Depends(require_roles("admin", "super_admin")),
):
    if response:
        _deprecation_headers(response)
    return face_service.admin_face_status(department, page, size, current_user)
