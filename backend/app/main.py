from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.routes import (
    auth, students, teams, projects, events, dashboard,
    notifications, forms, weekly_reports, announcements,
    meetings, attendance, uploads
)


def seed_roles(db):
    """Seed admin and student roles."""
    from app.models import Role
    roles_data = [
        {"name": "admin", "description": "Full system access"},
        {"name": "student", "description": "Student access"},
    ]
    for role_data in roles_data:
        existing = db.query(Role).filter(Role.name == role_data["name"]).first()
        if not existing:
            db.add(Role(**role_data))
    db.commit()


def seed_demo_data(db):
    """Seed demo data with admin, teams, students, and projects."""
    from app.models import (
        User, Role, Student, Team, Project, Event, Announcement, Meeting, Attendance
    )
    from app.core.security import hash_password
    from datetime import datetime, timezone, timedelta, date

    if db.query(User).count() > 0:
        return

    admin_role = db.query(Role).filter(Role.name == "admin").first()
    student_role = db.query(Role).filter(Role.name == "student").first()

    # ─── Create Admin ─────────────────────────────────────────────────────
    admin = User(
        ic_number="IC0000001",
        password_hash=hash_password("Admin@123"),
        full_name="Dr. Rajesh Kumar",
        email="admin@icms.edu",
        mobile="9876543210",
        role_id=admin_role.id,
        is_active=True,
        is_profile_completed=True,
        must_change_password=False,
    )
    db.add(admin)
    db.flush()

    # ─── Create Teams ─────────────────────────────────────────────────────
    teams_data = [
        ("Team Alpha", "AI-powered study assistant development", "Computer Science", "Dr. Priya Sharma"),
        ("Team Beta", "IoT campus monitoring system", "Electronics", "Prof. Anil Verma"),
        ("Team Gamma", "Green energy dashboard project", "Electrical", "Dr. Meena Iyer"),
        ("Team Delta", "AR campus tour application", "Computer Science", "Prof. Sanjay Rao"),
    ]
    teams = []
    for name, desc, dept, mentor in teams_data:
        t = Team(name=name, description=desc, department=dept, mentor_name=mentor)
        db.add(t)
        db.flush()
        teams.append(t)

    # ─── Create Students ──────────────────────────────────────────────────
    students_data = [
        ("IC2024001", "Arjun Patel", "Computer Science", 3, 0),
        ("IC2024002", "Priya Mehta", "Computer Science", 3, 0),
        ("IC2024003", "Rahul Singh", "Electronics", 2, 1),
        ("IC2024004", "Sneha Reddy", "Electronics", 2, 1),
        ("IC2024005", "Amit Kumar", "Electrical", 4, 2),
        ("IC2024006", "Kavya Nair", "Electrical", 3, 2),
        ("IC2024007", "Vikram Desai", "Computer Science", 1, 3),
        ("IC2024008", "Ananya Gupta", "Computer Science", 4, 3),
        ("IC2024009", "Ravi Shankar", "Mechanical", 2, 0),
        ("IC2024010", "Deepika Joshi", "Civil", 3, 1),
    ]
    for ic, name, dept, year, team_idx in students_data:
        u = User(
            ic_number=ic,
            password_hash=hash_password(f"icms@{ic}"),
            full_name=name,
            role_id=student_role.id,
            is_active=True,
            is_profile_completed=False,
            must_change_password=True,
        )
        db.add(u)
        db.flush()
        s = Student(
            user_id=u.id,
            department=dept,
            year=year,
            team_id=teams[team_idx].id,
            mentor_name=teams[team_idx].mentor_name,
        )
        db.add(s)

    # ─── Create Projects ──────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    projects_data = [
        ("AI Study Assistant", "An AI-powered tool for personalized learning", "ongoing", "AI/ML", 65, 0),
        ("Smart Campus IoT", "IoT-based campus monitoring system", "ongoing", "IoT", 40, 1),
        ("Green Energy Dashboard", "Real-time energy consumption tracker", "completed", "Web", 100, 2),
        ("AR Campus Tour", "Augmented reality campus navigation app", "planning", "AR/VR", 15, 3),
    ]
    for title, desc, status, cat, progress, team_idx in projects_data:
        p = Project(
            title=title, description=desc, status=status, category=cat,
            progress=progress, team_id=teams[team_idx].id,
            start_date=now.date() - timedelta(days=30),
        )
        db.add(p)

    # ─── Create Events ────────────────────────────────────────────────────
    events_data = [
        ("AI Workshop 2024", "workshop", "Learn about latest AI trends", 1),
        ("CodeSprint Hackathon", "hackathon", "24-hour coding challenge", 3),
        ("IoT Seminar", "seminar", "Internet of Things in Industry", 5),
        ("Tech Startup Pitch", "competition", "Present your startup ideas", 7),
        ("Cloud Computing Talk", "guest_lecture", "AWS architecture best practices", 10),
    ]
    for title, etype, desc, days_offset in events_data:
        e = Event(
            title=title, event_type=etype, description=desc,
            date=now + timedelta(days=days_offset),
            venue="Innovation Center Hall A",
            max_participants=100, status="upcoming",
            created_by=admin.id,
        )
        db.add(e)

    # ─── Create Announcements ─────────────────────────────────────────────
    db.add(Announcement(
        title="Welcome to Innovation Center 2024-25!",
        description="We are excited to welcome all students to the Innovation Center. Please complete your profile setup to get started.",
        priority="high",
        created_by=admin.id,
    ))
    db.add(Announcement(
        title="Weekly Report Submission Reminder",
        description="All students must submit their weekly progress reports by Friday 5:00 PM.",
        priority="medium",
        created_by=admin.id,
    ))

    # ─── Mark some attendance for demo ────────────────────────────────────
    # Mark attendance for today for a few students
    students_list = db.query(Student).all()
    today = date.today()
    for i, s in enumerate(students_list[:6]):
        att = Attendance(
            student_id=s.id,
            date=today,
            check_in_time=datetime.now(timezone.utc) - timedelta(hours=2),
            method="manual",
            status="present" if i < 5 else "late",
        )
        db.add(att)

    db.commit()
    print("✅ Demo data seeded successfully!")
    print(f"   Admin IC: IC0000001 | Password: Admin@123")
    print(f"   Student IC: IC2024001 | Password: icms@IC2024001")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Check and migrate SQLite schema if columns are missing
    from sqlalchemy import inspect
    inspector = inspect(engine)
    if "students" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("students")]
        if "resume_data" not in columns:
            print("⚠️ Schema mismatch detected (missing resume_data). Dropping and recreating tables...")
            Base.metadata.drop_all(bind=engine)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_roles(db)
        seed_demo_data(db)
    finally:
        db.close()
    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Innovation Center Management System API",
    lifespan=lifespan,
)

# CORS
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


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}
