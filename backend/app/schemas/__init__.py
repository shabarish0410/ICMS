from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime, date
import re


# ─── Validators ───────────────────────────────────────────────────────────────

def validate_ic_number(v: str) -> str:
    if not re.match(r'^IC\d{7}$', v):
        raise ValueError('IC Number must be in format IC followed by 7 digits (e.g., IC2024001)')
    return v

def validate_mobile(v: Optional[str]) -> Optional[str]:
    if v and not re.match(r'^\d{10}$', v):
        raise ValueError('Mobile number must be exactly 10 digits')
    return v

def validate_name(v: str) -> str:
    if not re.match(r'^[a-zA-Z\s\.]+$', v):
        raise ValueError('Name must contain only alphabets, spaces, and dots')
    return v

def validate_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError('Password must be at least 8 characters')
    if not re.search(r'[A-Z]', v):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', v):
        raise ValueError('Password must contain at least one lowercase letter')
    if not re.search(r'\d', v):
        raise ValueError('Password must contain at least one number')
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
        raise ValueError('Password must contain at least one special character')
    return v


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    ic_number: str
    password: str = Field(..., min_length=1)

    @field_validator('ic_number')
    @classmethod
    def check_ic(cls, v):
        return validate_ic_number(v)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_profile_completed: bool = False
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class CompleteProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: str
    mobile: str
    avatar_url: Optional[str] = None

    @field_validator('full_name')
    @classmethod
    def check_name(cls, v):
        return validate_name(v)

    @field_validator('mobile')
    @classmethod
    def check_mobile(cls, v):
        return validate_mobile(v)


class ChangePasswordRequest(BaseModel):
    new_password: str

    @field_validator('new_password')
    @classmethod
    def check_password(cls, v):
        return validate_password(v)


class ForgotPasswordRequest(BaseModel):
    ic_number: str
    method: str = "email"  # email or mobile

    @field_validator('ic_number')
    @classmethod
    def check_ic(cls, v):
        return validate_ic_number(v)


class VerifyOTPRequest(BaseModel):
    ic_number: str
    otp: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def check_password(cls, v):
        return validate_password(v)


class RequestOTPRequest(BaseModel):
    mobile: str

    @field_validator('mobile')
    @classmethod
    def check_mobile(cls, v):
        return validate_mobile(v)


class RegisterRequest(BaseModel):
    ic_number: str
    full_name: str
    email: str
    mobile: str
    password: str
    otp: str

    @field_validator('ic_number')
    @classmethod
    def check_ic(cls, v):
        return validate_ic_number(v)

    @field_validator('full_name')
    @classmethod
    def check_name(cls, v):
        return validate_name(v)

    @field_validator('mobile')
    @classmethod
    def check_mobile(cls, v):
        return validate_mobile(v)

    @field_validator('password')
    @classmethod
    def check_password(cls, v):
        return validate_password(v)


# ─── User & Role Schemas ─────────────────────────────────────────────────────

class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    ic_number: str
    full_name: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[RoleOut] = None
    is_active: bool
    is_profile_completed: bool
    must_change_password: bool = False
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Student Schemas ──────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    ic_number: str
    full_name: str
    department: str
    year: int = Field(..., ge=1, le=5)
    semester: Optional[int] = None
    mentor_name: Optional[str] = None
    team_id: Optional[int] = None
    password: Optional[str] = None

    @field_validator('ic_number')
    @classmethod
    def check_ic(cls, v):
        return validate_ic_number(v)


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    mentor_name: Optional[str] = None
    team_id: Optional[int] = None
    is_active: Optional[bool] = None
    resume_url: Optional[str] = None
    resume_data: Optional[Any] = None


class StudentOut(BaseModel):
    id: int
    user_id: int
    department: str
    year: int
    semester: Optional[int] = None
    mentor_name: Optional[str] = None
    team_id: Optional[int] = None
    resume_url: Optional[str] = None
    resume_data: Optional[Any] = None
    team: Optional["TeamOut"] = None
    user: Optional[UserOut] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Team Schemas ─────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: Optional[str] = None
    department: Optional[str] = None
    mentor_name: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    mentor_name: Optional[str] = None


class TeamOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    mentor_name: Optional[str] = None
    member_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Project Schemas ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: Optional[str] = None
    category: Optional[str] = None
    team_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    development_stage: Optional[str] = "Ideation"
    technologies_used: Optional[List[str]] = []


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    remarks: Optional[str] = None
    end_date: Optional[date] = None
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    development_stage: Optional[str] = None
    technologies_used: Optional[List[str]] = None


class ProjectOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    category: Optional[str] = None
    team_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    progress: int
    remarks: Optional[str] = None
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    development_stage: Optional[str] = None
    technologies_used: Optional[List[str]] = None
    team: Optional[TeamOut] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    submission_type: str  # report, document, presentation, source_code
    title: str
    description: Optional[str] = None
    file_url: Optional[str] = None


class SubmissionReview(BaseModel):
    status: str  # approved, rejected, revision_requested
    admin_comments: Optional[str] = None


class SubmissionOut(BaseModel):
    id: int
    project_id: int
    submitted_by: int
    submission_type: str
    title: str
    description: Optional[str] = None
    file_url: Optional[str] = None
    status: str
    admin_comments: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    submitter: Optional[UserOut] = None
    class Config:
        from_attributes = True


# ─── Dynamic Form Schemas ────────────────────────────────────────────────────

class FormFieldSchema(BaseModel):
    id: str
    type: str  # text, paragraph, number, email, phone, date, time, dropdown, radio, checkbox, file, image
    label: str
    placeholder: Optional[str] = None
    required: bool = False
    options: Optional[List[str]] = None  # For dropdown, radio, checkbox
    validation: Optional[dict] = None  # { min_length, max_length, pattern, min, max }
    default_value: Optional[str] = None


class FormCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: Optional[str] = None
    fields: List[FormFieldSchema]
    is_active: bool = True
    deadline: Optional[datetime] = None


class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    fields: Optional[List[FormFieldSchema]] = None
    is_active: Optional[bool] = None
    deadline: Optional[datetime] = None


class FormOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    fields: List[dict]
    is_active: bool
    deadline: Optional[datetime] = None
    created_by: Optional[int] = None
    response_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


class FormSubmissionCreate(BaseModel):
    data: dict


class FormSubmissionOut(BaseModel):
    id: int
    form_id: int
    user_id: int
    data: dict
    status: str
    admin_remarks: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    user: Optional[UserOut] = None
    class Config:
        from_attributes = True


# ─── Weekly Report Schemas ────────────────────────────────────────────────────

class WeeklyReportCreate(BaseModel):
    week_number: int = Field(..., ge=1, le=52)
    work_completed: str
    challenges: Optional[str] = None
    next_plan: Optional[str] = None
    attachments: Optional[List[str]] = []


class WeeklyReportReview(BaseModel):
    status: str  # approved, revision_requested
    admin_comments: Optional[str] = None


class WeeklyReportOut(BaseModel):
    id: int
    student_id: int
    week_number: int
    work_completed: str
    challenges: Optional[str] = None
    next_plan: Optional[str] = None
    attachments: Optional[List[str]] = []
    status: str
    admin_comments: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    student: Optional[StudentOut] = None
    class Config:
        from_attributes = True


# ─── Announcement Schemas ────────────────────────────────────────────────────

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: str
    attachment_url: Optional[str] = None
    priority: str = "medium"
    expiry_date: Optional[datetime] = None


class AnnouncementOut(BaseModel):
    id: int
    title: str
    description: str
    attachment_url: Optional[str] = None
    priority: str
    expiry_date: Optional[datetime] = None
    created_by: Optional[int] = None
    creator: Optional[UserOut] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Meeting Schemas ─────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=2)
    agenda: Optional[str] = None
    date: datetime
    duration_minutes: int = 60
    meeting_link: Optional[str] = None
    documents: Optional[List[str]] = []
    invite_user_ids: Optional[List[int]] = []
    invite_team_ids: Optional[List[int]] = []


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    agenda: Optional[str] = None
    date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    meeting_link: Optional[str] = None
    documents: Optional[List[str]] = None
    recording_url: Optional[str] = None


class MeetingOut(BaseModel):
    id: int
    title: str
    agenda: Optional[str] = None
    date: datetime
    duration_minutes: int
    meeting_link: Optional[str] = None
    documents: Optional[List[str]] = []
    recording_url: Optional[str] = None
    created_by: Optional[int] = None
    creator: Optional[UserOut] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Attendance Schemas ───────────────────────────────────────────────────────

class AttendanceMarkRequest(BaseModel):
    method: str = "manual"  # manual or face
    photo_url: Optional[str] = None


class AdminAttendanceMarkRequest(BaseModel):
    student_id: int
    date: date
    status: str  # present, absent, late
    method: Optional[str] = "manual"


class AttendanceOut(BaseModel):
    id: int
    student_id: int
    date: date
    check_in_time: Optional[datetime] = None
    method: str
    status: str
    student: Optional[StudentOut] = None
    class Config:
        from_attributes = True


# ─── Event Schemas ────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: Optional[str] = None
    event_type: str
    date: datetime
    end_date: Optional[datetime] = None
    venue: Optional[str] = None
    max_participants: Optional[int] = None
    image_url: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    venue: Optional[str] = None
    max_participants: Optional[int] = None
    status: Optional[str] = None


class EventOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    event_type: str
    date: datetime
    end_date: Optional[datetime] = None
    venue: Optional[str] = None
    max_participants: Optional[int] = None
    status: str
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Notification Schemas ────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    link: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Pagination ───────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int


# ─── Dashboard Schemas ────────────────────────────────────────────────────────

class AdminDashboardStats(BaseModel):
    total_students: int
    total_teams: int
    total_projects: int
    active_projects: int
    completed_projects: int
    pending_reviews: int
    students_present_today: int
    students_absent_today: int
    attendance_percentage: float
    forms_pending: int
    upcoming_meetings: int
    total_events: int


class StudentDashboardData(BaseModel):
    user: Optional[UserOut] = None
    student: Optional[StudentOut] = None
    team: Optional[TeamOut] = None
    project: Optional[ProjectOut] = None
    attendance_percentage: float = 0.0
    weekly_progress: Optional[dict] = None
    pending_forms: int = 0
    upcoming_meetings: int = 0
    recent_notifications: List[NotificationOut] = []
