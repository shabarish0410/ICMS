import os

os.environ["CUDA_VISIBLE_DEVICES"]="-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"]="3"
os.environ["TF_FORCE_GPU_ALLOW_GROWTH"]="true"

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import traceback

# Force TensorFlow/DeepFace to run on CPU only to prevent cuInit (CUDA) crashes on Render

from app.core.config import settings
from app.routes import (
    auth, students, teams, projects, events, dashboard,
    notifications, forms, weekly_reports, announcements,
    meetings, attendance, uploads, users, uniforms,
    achievements, admin_achievements, exports
)

# Use Python's standard logger instead of hardcoded Windows file paths
logger = logging.getLogger("icms")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup can be added here if needed, such as testing Supabase connection
    from app.core.supabase import get_supabase
    try:
        sb = get_supabase()
        logger.info("Connected to Supabase REST client.")
        
        # Ensure the attendance-photos bucket exists and is public
        try:
            buckets = sb.storage.list_buckets()
            bucket_names = [b.name for b in buckets]
            if "attendance-photos" not in bucket_names:
                logger.info("Bucket 'attendance-photos' not found. Creating it now via REST...")
                import httpx
                headers = {
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "id": "attendance-photos",
                    "name": "attendance-photos",
                    "public": True
                }
                bucket_url = f"{settings.SUPABASE_URL}/storage/v1/bucket"
                resp = httpx.post(bucket_url, json=payload, headers=headers, timeout=10.0)
                if resp.status_code in [200, 201]:
                    logger.info("Bucket created successfully!")
                else:
                    logger.warning(f"Failed to create bucket via REST: {resp.text}")
        except Exception as bucket_err:
            logger.warning(f"Could not verify/create bucket: {bucket_err}")
            
    except Exception as e:
        logger.warning(f"Supabase connection issue: {e}")

    # ── Face Pipeline V2: model warm-up + pgvector detection ────────────────────
    from app.core.face_config import FACE_PIPELINE_V2
    if FACE_PIPELINE_V2:
        logger.info(f"[Startup] FACE_PIPELINE_V2=True — warming up ML models ...")
        try:
            import asyncio
            from app.services.face.embedding_store import detect_backend
            from app.services.face.database import cleanup_expired_idempotency_keys

            loop = asyncio.get_event_loop()

            # Detect pgvector availability
            sb = get_supabase()
            backend = await loop.run_in_executor(None, detect_backend, sb)
            logger.info(f"[Startup] Embedding backend: {backend}")

            # Clean up expired idempotency cache rows
            removed = await loop.run_in_executor(None, cleanup_expired_idempotency_keys)
            logger.info(f"[Startup] Cleaned up {removed} expired idempotency keys")
            
            # Warm up ML models (ArcFace) in a separate thread
            DISABLE_FACE_WARMUP = os.getenv("DISABLE_FACE_WARMUP", "false").lower() == "true"
            if not DISABLE_FACE_WARMUP:
                from app.core.model_cache import warmup_models
                await loop.run_in_executor(None, warmup_models)
            else:
                logger.info("[Startup] DISABLE_FACE_WARMUP=True — skipping ML model warmup")

        except Exception as face_startup_err:
            logger.warning(f"[Startup] Face V2 startup tasks failed (non-fatal): {face_startup_err}")
    else:
        logger.info("[Startup] FACE_PIPELINE_V2=False — V2 startup tasks skipped")

    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Spark Innovation Center API",
    lifespan=lifespan,
)

# CORS — must be added BEFORE all routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.core.logging import LoggingMiddleware
app.add_middleware(LoggingMiddleware)

# Static files for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

from fastapi import HTTPException
from app.core.exceptions import ICMSException

@app.exception_handler(ICMSException)
async def icms_exception_handler(request: Request, exc: ICMSException):
    logger.warning(f"ICMS EXCEPTION | URL: {request.url} | Status: {exc.status_code} | {exc.message} | Details: {exc.details}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "extras": exc.details}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"GLOBAL EXCEPTION | URL: {request.url} | {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code in (401, 404):
        logger.debug(f"HTTP EXCEPTION | URL: {request.url} | Status: {exc.status_code} | {exc.detail}")
    else:
        logger.warning(f"HTTP EXCEPTION | URL: {request.url} | Status: {exc.status_code} | {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Register routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(teams.router)
app.include_router(projects.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(forms.router)
app.include_router(weekly_reports.router)
app.include_router(announcements.router)
app.include_router(meetings.router)
app.include_router(attendance.router)
app.include_router(uploads.router)
app.include_router(users.router)
app.include_router(uniforms.router)
app.include_router(achievements.router)
app.include_router(admin_achievements.router)
app.include_router(exports.router)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}

@app.get("/")
@app.head("/")
def root_health_check():
    return {"status": "ok", "message": "ICMS Backend is running"}
