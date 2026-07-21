import os



from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import traceback



from app.core.config import settings
from app.routes import (
    auth, students, teams, projects, events, dashboard,
    notifications, forms, weekly_reports, announcements,
    meetings, uploads, users, uniforms,
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
    except Exception as e:
        logger.warning(f"Supabase connection issue: {e}")

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
