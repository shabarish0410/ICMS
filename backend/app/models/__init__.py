from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, JSON, Date, Table
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base
from sqlalchemy import LargeBinary


# ─── Junction Tables ─────────────────────────────────────────────────────────

team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", Integer, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
)

meeting_invites = Table(
    "meeting_invites",
    Base.metadata,
    Column("meeting_id", Integer, ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


# ─── Core Models ──────────────────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # admin, student
    description = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    ic_number = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255))
    mobile = Column(String(20))
    avatar_url = Column(String(500))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    is_profile_completed = Column(Boolean, default=False)
    must_change_password = Column(Boolean, default=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    role = relationship("Role", back_populates="users")
    student = relationship("Student", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    semester = Column(Integer)
    section = Column(String(50))
    mentor_name = Column(String(255))
    team_id = Column(Integer, ForeignKey("teams.id"))
    resume_url = Column(String(500), nullable=True)
    resume_data = Column(JSON, nullable=True)
    # ── Face Registration Fields ──────────────────────────────────────────────
    face_register = Column(Boolean, default=False)
    face_registered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="student")
    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    attendances = relationship("Attendance", back_populates="student")
    weekly_reports = relationship("WeeklyReport", back_populates="student")
    registrations = relationship("Registration", back_populates="student")
    certificates = relationship("Certificate", back_populates="student")
    face = relationship("StudentFace", back_populates="student", uselist=False)


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)
    department = Column(String(100))
    mentor_name = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    members = relationship("Student", back_populates="team", foreign_keys="[Student.team_id]")
    projects = relationship("Project", back_populates="team")


# ─── Project & Submissions ───────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="planning")  # planning, ongoing, completed, on_hold
    category = Column(String(100))
    team_id = Column(Integer, ForeignKey("teams.id"))
    start_date = Column(Date)
    end_date = Column(Date)
    progress = Column(Integer, default=0)
    remarks = Column(Text)
    problem_statement = Column(Text, nullable=True)
    proposed_solution = Column(Text, nullable=True)
    development_stage = Column(String(100), default="Ideation")
    technologies_used = Column(JSON, default=[])
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    team = relationship("Team", back_populates="projects")
    submissions = relationship("ProjectSubmission", back_populates="project")


class ProjectSubmission(Base):
    __tablename__ = "project_submissions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    submission_type = Column(String(50), nullable=False)  # report, document, presentation, source_code
    title = Column(String(255), nullable=False)
    description = Column(Text)
    file_url = Column(String(500))
    status = Column(String(50), default="submitted")  # submitted, approved, rejected, revision_requested
    admin_comments = Column(Text)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime)

    project = relationship("Project", back_populates="submissions")
    submitter = relationship("User")


# ─── Dynamic Forms ────────────────────────────────────────────────────────────

class DynamicForm(Base):
    __tablename__ = "dynamic_forms"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    fields = Column(JSON, nullable=False)  # Array of field definitions
    is_active = Column(Boolean, default=True)
    deadline = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    responses = relationship("FormSubmission", back_populates="form")
    creator = relationship("User")


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("dynamic_forms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    data = Column(JSON, nullable=False)  # Submitted form data
    status = Column(String(50), default="submitted")  # submitted, reviewed, approved
    admin_remarks = Column(Text)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime)

    form = relationship("DynamicForm", back_populates="responses")
    user = relationship("User")


# ─── Weekly Reports ───────────────────────────────────────────────────────────

class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    week_number = Column(Integer, nullable=False)
    work_completed = Column(Text, nullable=False)
    challenges = Column(Text)
    next_plan = Column(Text)
    attachments = Column(JSON, default=[])  # List of file URLs
    status = Column(String(50), default="submitted")  # submitted, reviewed, approved, revision_requested
    admin_comments = Column(Text)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime)

    student = relationship("Student", back_populates="weekly_reports")


# ─── Announcements ────────────────────────────────────────────────────────────

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    attachment_url = Column(String(500))
    priority = Column(String(20), default="medium")  # low, medium, high, urgent
    expiry_date = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    creator = relationship("User")


# ─── Meetings ─────────────────────────────────────────────────────────────────

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    agenda = Column(Text)
    date = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=60)
    meeting_link = Column(String(500))  # Google Meet / Zoom link
    documents = Column(JSON, default=[])  # List of doc URLs
    recording_url = Column(String(500))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    creator = relationship("User")
    invitees = relationship("User", secondary=meeting_invites)


# ─── Attendance ───────────────────────────────────────────────────────────────

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    check_in_time = Column(DateTime)
    check_out_time = Column(DateTime)
    method = Column(String(50), default="manual")  # manual, face
    status = Column(String(20), default="present")  # present, absent, late
    photo_url = Column(String(500))  # Facial recognition capture
    # ── Face Verification Fields ──────────────────────────────────────────────
    face_verified = Column(Boolean, default=False)
    liveness_verified = Column(Boolean, default=False)
    dress_verified = Column(Boolean, default=False)
    attendance_method = Column(String(50), default="manual")  # manual, face
    # ── Uniform Verification Fields ───────────────────────────────────────────
    uniform_verified = Column(Boolean, default=False)
    uniform_confidence = Column(Float, nullable=True)
    uniform_details = Column(JSON, nullable=True)  # e.g. {logo, collar, color, id_card}

    student = relationship("Student", back_populates="attendances")


# ─── Events ───────────────────────────────────────────────────────────────────

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    event_type = Column(String(50), nullable=False)
    date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    venue = Column(String(255))
    max_participants = Column(Integer)
    status = Column(String(50), default="upcoming")
    image_url = Column(String(500))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    registrations = relationship("Registration", back_populates="event")
    certificates = relationship("Certificate", back_populates="event")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="registered")
    registered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    event = relationship("Event", back_populates="registrations")
    student = relationship("Student", back_populates="registrations")


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    certificate_url = Column(String(500))
    issued_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="certificates")
    event = relationship("Event", back_populates="certificates")


# ─── Notifications ────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)
    is_read = Column(Boolean, default=False)
    link = Column(String(500))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")


# ─── Activity Logs ────────────────────────────────────────────────────────────

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    details = Column(JSON, default={})
    ip_address = Column(String(50))
    device = Column(String(255))
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="activity_logs")


# ─── OTP Verifications ────────────────────────────────────────────────────────

class OtpVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String(20), unique=True, nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    attempts = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


# ─── Student Face Embeddings ───────────────────────────────────────────────────

class StudentFace(Base):
    __tablename__ = "student_faces"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), unique=True, nullable=False)
    face_embedding = Column(JSON, nullable=False)  # ArcFace 512-dim vector as list of floats
    face_image_url = Column(String(500), nullable=True)  # Google Drive URL
    model_version = Column(String(50), default="ArcFace")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="face")


# ─── Attendance Validation Logs ────────────────────────────────────────────────

class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    validation_step = Column(String(100), nullable=False)  # e.g. face_detect, liveness, embedding_match
    result = Column(String(20), nullable=False)  # PASS / FAIL
    message = Column(Text)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    student = relationship("Student")


# ─── Institutional Uniforms ────────────────────────────────────────────────────

class Uniform(Base):
    __tablename__ = "uniforms"

    id = Column(Integer, primary_key=True, index=True)
    department = Column(String(100), default="all")       # 'all' or specific dept
    gender = Column(String(20), default="all")             # all, male, female
    season = Column(String(20), default="all")             # all, summer, winter
    label = Column(String(255))                            # Human-readable label
    front_image_url = Column(String(500), nullable=True)
    back_image_url = Column(String(500), nullable=True)
    side_image_url = Column(String(500), nullable=True)
    logo_image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

