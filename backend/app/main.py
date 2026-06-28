from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import logging
import traceback

from app.core.config import settings
from app.routes import (
    auth, students, teams, projects, events, dashboard,
    notifications, forms, weekly_reports, announcements,
    meetings, attendance, uploads, users
)

# Use Python's standard logger instead of hardcoded Windows file paths
logger = logging.getLogger("icms")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup can be added here if needed, such as testing Supabase connection
    from app.core.supabase import get_supabase
    try:
        sb = get_supabase()
        print("✅ Connected to Supabase REST client.")
        
        # Ensure the attendance-photos bucket exists and is public
        try:
            buckets = sb.storage.list_buckets()
            bucket_names = [b.name for b in buckets]
            if "attendance-photos" not in bucket_names:
                print("⚠️ Bucket 'attendance-photos' not found. Creating it now...")
                sb.storage.create_bucket("attendance-photos", {"public": True})
                print("✅ Bucket created successfully!")
        except Exception as bucket_err:
            print(f"⚠️ Could not verify/create bucket: {bucket_err}")
            
    except Exception as e:
        print(f"⚠️ Supabase connection issue: {e}")
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

# Static files for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

from fastapi import HTTPException

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"GLOBAL EXCEPTION | URL: {request.url} | {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP EXCEPTION | URL: {request.url} | Status: {exc.status_code} | {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
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


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}

@app.get("/")
@app.head("/")
def root_health_check():
    return {"status": "ok", "message": "ICMS Backend is running"}
