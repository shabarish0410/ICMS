from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.routes import (
    auth, students, teams, projects, events, dashboard,
    notifications, forms, weekly_reports, announcements,
    meetings, attendance, uploads, users
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup can be added here if needed, such as testing Supabase connection
    from app.core.supabase import get_supabase
    try:
        sb = get_supabase()
        print("✅ Connected to Supabase REST client.")
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

# CORS
cors_origins = settings.cors_origins_list
is_wildcard = cors_origins == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else cors_origins,
    allow_credentials=not is_wildcard,  # credentials not allowed with wildcard origin
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

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
