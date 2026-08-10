from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo
from app.core.supabase import get_supabase
from app.core.security import get_current_user

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

IST = ZoneInfo("Asia/Kolkata")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_role_name(user: dict) -> str:
    role_info = user.get("role")
    if isinstance(role_info, list) and len(role_info) > 0:
        return role_info[0].get("name", "")
    if isinstance(role_info, dict):
        return role_info.get("name", "")
    return ""


def require_admin_or_faculty(user: dict):
    role = get_role_name(user)
    if role not in ("admin", "faculty"):
        raise HTTPException(status_code=403, detail="Admin or Faculty access required.")


def get_student_id_from_user(user: dict, supabase) -> int:
    """Derives student_id from the authenticated ICMS JWT user. Never trusts client input."""
    user_id = user.get("id")
    res = supabase.table("students").select("id").eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Student profile not found for your account.")
    return res.data[0]["id"]


def to_ist(ts_str: Optional[str]) -> Optional[str]:
    """Convert UTC ISO string to IST display string: 09:42:18 AM"""
    if not ts_str:
        return None
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        dt_ist = dt.astimezone(IST)
        return dt_ist.strftime("%I:%M:%S %p")
    except Exception:
        return ts_str


def to_ist_datetime(ts_str: Optional[str]) -> Optional[str]:
    """Convert UTC ISO string to full IST datetime: 10-Aug-2026 09:42:18 AM"""
    if not ts_str:
        return None
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        dt_ist = dt.astimezone(IST)
        return dt_ist.strftime("%d-%b-%Y %I:%M:%S %p")
    except Exception:
        return ts_str


def session_date_ist(created_at_str: str) -> str:
    """Returns the session date (YYYY-MM-DD) in Asia/Kolkata."""
    dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    return dt.astimezone(IST).strftime("%Y-%m-%d")


def session_date_display(created_at_str: str) -> str:
    """Returns the session date as dd-Mon-YYYY in IST."""
    dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    return dt.astimezone(IST).strftime("%d-%b-%Y")


# ─── Mark Attendance ─────────────────────────────────────────────────────────

class MarkAttendanceRequest(BaseModel):
    session_id: str
    ic_number: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device_id: Optional[str] = None


@router.get("/session/{session_id}")
def get_session(session_id: str):
    """Public endpoint — no auth required so mobile can fetch session info."""
    supabase = get_supabase()
    res = supabase.table("attendance_sessions").select("*").eq("id", session_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found. Please scan a valid QR code.")

    session_data = res.data[0]

    # Auto-mark expired sessions
    expires_at = datetime.fromisoformat(session_data["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        session_data["is_active"] = False

    return session_data


@router.post("/mark")
def mark_attendance(req: MarkAttendanceRequest):
    """Public endpoint — no auth required so mobile can submit attendance."""
    supabase = get_supabase()

    # ── 1. Verify session ────────────────────────────────────────────────────
    session_res = supabase.table("attendance_sessions").select("*").eq("id", req.session_id).execute()
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Invalid session. Please scan the QR code again.")

    session_data = session_res.data[0]
    if not session_data.get("is_active"):
        raise HTTPException(status_code=400, detail="This attendance session has been closed.")

    expires_at = datetime.fromisoformat(session_data["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This attendance session has expired.")

    # ── 2. Find user by IC number ────────────────────────────────────────────
    ic = req.ic_number.strip().upper()

    user_res = supabase.table("users").select("id, full_name, ic_number").eq("ic_number", ic).execute()

    if not user_res.data:
        ic_clean = ic.replace("-", "").replace(" ", "")
        all_users = supabase.table("users").select("id, full_name, ic_number").execute()

        matched = []
        for u in (all_users.data or []):
            u_ic = (u.get("ic_number") or "").replace("-", "").replace(" ", "").upper()
            u_name = (u.get("full_name") or "").strip().upper()
            if u_ic == ic_clean or u_name == ic:
                matched.append(u)

        if matched:
            user_res_data = matched
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No student found with IC Number or Name '{ic}'. Please check your input and try again.",
            )
    else:
        user_res_data = user_res.data

    user = user_res_data[0]
    user_id = user["id"]
    student_name = user.get("full_name", "Unknown")

    # ── 3. Find student record ───────────────────────────────────────────────
    student_res = supabase.table("students").select("id").eq("user_id", user_id).execute()
    if not student_res.data:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found. Please contact your administrator.",
        )

    student = student_res.data[0]
    student_id = student["id"]

    # ── 4. Check for duplicate ───────────────────────────────────────────────
    dup_res = (
        supabase.table("attendance_records")
        .select("id")
        .eq("session_id", req.session_id)
        .eq("student_id", student_id)
        .execute()
    )
    if dup_res.data:
        raise HTTPException(status_code=400, detail="Attendance already marked for this session.")

    # ── 5. Insert attendance record ──────────────────────────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("attendance_records").insert(
        {
            "session_id": req.session_id,
            "student_id": student_id,
            "student_name": student_name,
            "student_identifier": ic,
            "marked_at": now_iso,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "device_id": req.device_id,
        }
    ).execute()

    return {"success": True, "message": f"Attendance marked for {student_name}!"}


# ─── Session Records (Live) ───────────────────────────────────────────────────

@router.get("/session/{session_id}/records")
def get_attendance_records(session_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch all attendance records for a session (Admin only)."""
    require_admin_or_faculty(current_user)
    supabase = get_supabase()
    res = (
        supabase.table("attendance_records")
        .select("*")
        .eq("session_id", session_id)
        .order("marked_at", desc=True)
        .execute()
    )
    return res.data or []


# ─── Create Session ───────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    subject_name: str
    section: str
    duration_minutes: int
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_radius: Optional[int] = None


@router.post("/session/create")
def create_session(req: CreateSessionRequest, current_user: dict = Depends(get_current_user)):
    """Create a new attendance session (Admin/Faculty only)."""
    require_admin_or_faculty(current_user)
    supabase = get_supabase()

    now_ts = datetime.now(timezone.utc).timestamp()
    expires_at = datetime.fromtimestamp(
        now_ts + (req.duration_minutes * 60), timezone.utc
    ).isoformat()

    data = {
        "faculty_id": current_user["id"],
        "subject_name": req.subject_name,
        "section": req.section,
        "is_active": True,
        "expires_at": expires_at,
        "gps_latitude": req.gps_latitude,
        "gps_longitude": req.gps_longitude,
        "gps_radius": req.gps_radius,
    }

    res = supabase.table("attendance_sessions").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create session. Please try again.")

    return {"success": True, "session": res.data[0]}


# ─── Close Session ────────────────────────────────────────────────────────────

@router.post("/session/{session_id}/close")
def close_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Close an active attendance session (Admin/Faculty only)."""
    require_admin_or_faculty(current_user)
    supabase = get_supabase()

    res = (
        supabase.table("attendance_sessions")
        .update({"is_active": False})
        .eq("id", session_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found.")

    return {"success": True}


# ─── REPORTING: Session List ──────────────────────────────────────────────────

@router.get("/report/sessions")
def list_sessions(
    date: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD (IST)"),
    section: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """List attendance sessions with filters. Admin/Faculty only."""
    require_admin_or_faculty(current_user)
    supabase = get_supabase()

    query = supabase.table("attendance_sessions").select(
        "id, subject_name, section, faculty_id, is_active, created_at, expires_at, gps_radius"
    )

    if section:
        query = query.eq("section", section)
    if subject:
        query = query.ilike("subject_name", f"%{subject}%")

    query = query.order("created_at", desc=True)
    res = query.execute()
    sessions = res.data or []

    # Filter by date in IST if provided
    if date:
        sessions = [s for s in sessions if session_date_ist(s["created_at"]) == date]

    # Enrich each session with record count
    result = []
    for s in sessions:
        count_res = (
            supabase.table("attendance_records")
            .select("id", count="exact")
            .eq("session_id", s["id"])
            .execute()
        )
        s["record_count"] = count_res.count or 0
        s["session_date"] = session_date_display(s["created_at"])
        s["session_date_iso"] = session_date_ist(s["created_at"])
        result.append(s)

    return result


# ─── REPORTING: Daily Report ──────────────────────────────────────────────────

@router.get("/report/daily")
def daily_attendance_report(
    date: str = Query(..., description="Date in YYYY-MM-DD (IST)"),
    section: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Daily attendance report: for each applicable session on the given IST date,
    derive PRESENT / ABSENT for every expected student.
    Admin/Faculty only.
    """
    require_admin_or_faculty(current_user)
    supabase = get_supabase()

    # 1. Fetch all sessions (we'll filter by IST date in Python)
    session_query = supabase.table("attendance_sessions").select(
        "id, subject_name, section, faculty_id, created_at, expires_at"
    )
    if section:
        session_query = session_query.eq("section", section)
    if subject:
        session_query = session_query.ilike("subject_name", f"%{subject}%")

    session_res = session_query.execute()
    all_sessions = session_res.data or []

    # Filter sessions that occurred on the selected IST date
    day_sessions = [s for s in all_sessions if session_date_ist(s["created_at"]) == date]

    if not day_sessions:
        return {"date": date, "sessions": [], "rows": [], "total_present": 0, "total_absent": 0}

    rows = []
    total_present = 0
    total_absent = 0

    for sess in day_sessions:
        sess_id = sess["id"]
        sess_section = sess.get("section") or ""
        sess_subject = sess.get("subject_name", "")

        # 2. Determine expected students for this session
        if not sess_section.strip():
            # No section → only show actual records
            rec_res = (
                supabase.table("attendance_records")
                .select("student_id, student_name, student_identifier, marked_at")
                .eq("session_id", sess_id)
                .execute()
            )
            for rec in (rec_res.data or []):
                total_present += 1
                rows.append({
                    "session_id": sess_id,
                    "subject_name": sess_subject,
                    "section": sess_section or "Not specified",
                    "date": date,
                    "date_display": session_date_display(sess["created_at"]),
                    "student_id": rec["student_id"],
                    "student_name": rec["student_name"],
                    "ic_number": rec["student_identifier"],
                    "status": "PRESENT",
                    "marked_at": rec["marked_at"],
                    "present_time": to_ist(rec["marked_at"]),
                    "present_time_full": to_ist_datetime(rec["marked_at"]),
                })
            continue

        # 3. Fetch expected students via section
        students_res = (
            supabase.table("students")
            .select("id, user_id, section, users!inner(id, full_name, ic_number)")
            .eq("section", sess_section)
            .execute()
        )
        expected_students = students_res.data or []

        # 4. Fetch attendance records for this session
        rec_res = (
            supabase.table("attendance_records")
            .select("student_id, marked_at")
            .eq("session_id", sess_id)
            .execute()
        )
        present_map = {r["student_id"]: r["marked_at"] for r in (rec_res.data or [])}

        # 5. Build rows
        for stu in expected_students:
            user_info = stu.get("users") or {}
            if isinstance(user_info, list):
                user_info = user_info[0] if user_info else {}
            stu_id = stu["id"]
            if stu_id in present_map:
                status = "PRESENT"
                marked_at = present_map[stu_id]
                present_time = to_ist(marked_at)
                present_time_full = to_ist_datetime(marked_at)
                total_present += 1
            else:
                status = "ABSENT"
                marked_at = None
                present_time = None
                present_time_full = None
                total_absent += 1

            rows.append({
                "session_id": sess_id,
                "subject_name": sess_subject,
                "section": sess_section,
                "date": date,
                "date_display": session_date_display(sess["created_at"]),
                "student_id": stu_id,
                "student_name": user_info.get("full_name", "Unknown"),
                "ic_number": user_info.get("ic_number", ""),
                "status": status,
                "marked_at": marked_at,
                "present_time": present_time,
                "present_time_full": present_time_full,
            })

    # Sort: PRESENT first, then ABSENT, by name
    rows.sort(key=lambda r: (r["status"] != "PRESENT", r.get("student_name", "")))

    return {
        "date": date,
        "sessions": [
            {
                "id": s["id"],
                "subject_name": s.get("subject_name"),
                "section": s.get("section"),
                "session_date": session_date_display(s["created_at"]),
            }
            for s in day_sessions
        ],
        "rows": rows,
        "total_present": total_present,
        "total_absent": total_absent,
    }


# ─── REPORTING: Monthly Report ────────────────────────────────────────────────

@router.get("/report/monthly")
def monthly_attendance_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    section: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Monthly attendance matrix report.
    Returns student rows with day-by-day P/A/-- status.
    Admin/Faculty only.
    """
    require_admin_or_faculty(current_user)
    supabase = get_supabase()

    # 1. Fetch all sessions in this month/year
    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    month_start_ist = f"{year:04d}-{month:02d}-01"
    month_end_ist = f"{year:04d}-{month:02d}-{days_in_month:02d}"

    # Fetch sessions from the entire month range with a buffer for timezone offset
    # We fetch a wider range and filter by IST date
    start_utc = f"{year:04d}-{month:02d}-01T00:00:00+05:30"
    end_utc = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59+05:30"

    session_query = (
        supabase.table("attendance_sessions")
        .select("id, subject_name, section, faculty_id, created_at, expires_at")
        .gte("created_at", start_utc)
        .lte("created_at", end_utc)
    )
    if section:
        session_query = session_query.eq("section", section)
    if subject:
        session_query = session_query.ilike("subject_name", f"%{subject}%")

    session_res = session_query.execute()
    all_sessions = session_res.data or []

    # Group sessions by IST date
    sessions_by_date: dict[str, list] = {}
    for s in all_sessions:
        d = session_date_ist(s["created_at"])
        if d not in sessions_by_date:
            sessions_by_date[d] = []
        sessions_by_date[d].append(s)

    # The active dates (dates where at least one applicable session existed)
    active_dates = sorted(sessions_by_date.keys())

    # 2. Build per-session expected student sets and presence maps
    # Collect all unique expected students
    all_student_ids: set = set()
    section_students: dict[str, list] = {}  # section -> [student records]

    # Gather sessions with sections to find expected students
    sections_needed = set(s.get("section") for s in all_sessions if s.get("section"))
    for sec in sections_needed:
        if sec not in section_students:
            stu_res = (
                supabase.table("students")
                .select("id, user_id, section, users!inner(id, full_name, ic_number)")
                .eq("section", sec)
                .execute()
            )
            section_students[sec] = stu_res.data or []
            for stu in section_students[sec]:
                all_student_ids.add(stu["id"])

    # 3. Fetch all attendance records for relevant sessions
    session_ids = [s["id"] for s in all_sessions]
    presence_map: dict = {}  # (session_id, student_id) -> marked_at

    if session_ids:
        # Supabase in_ filter
        rec_res = (
            supabase.table("attendance_records")
            .select("session_id, student_id, marked_at")
            .in_("session_id", session_ids)
            .execute()
        )
        for r in (rec_res.data or []):
            presence_map[(r["session_id"], r["student_id"])] = r["marked_at"]

    # 4. Build student index
    student_index: dict[int, dict] = {}
    for sec, students in section_students.items():
        for stu in students:
            if stu["id"] not in student_index:
                user_info = stu.get("users") or {}
                if isinstance(user_info, list):
                    user_info = user_info[0] if user_info else {}
                student_index[stu["id"]] = {
                    "student_id": stu["id"],
                    "student_name": user_info.get("full_name", "Unknown"),
                    "ic_number": user_info.get("ic_number", ""),
                    "section": stu.get("section", ""),
                }

    # 5. Build student rows for matrix
    rows = []
    for stu_id, stu_info in student_index.items():
        stu_section = stu_info["section"]
        day_cells: dict[str, dict] = {}
        present_count = 0
        absent_count = 0
        applicable_sessions = 0

        for d in active_dates:
            day_sessions = sessions_by_date[d]
            # Only sessions applicable to this student's section
            applicable = [s for s in day_sessions if s.get("section") == stu_section]

            if not applicable:
                day_cells[d] = {"status": "NO_SESSION", "sessions": []}
                continue

            # For each applicable session on this date, check presence
            session_cells = []
            for sess in applicable:
                applicable_sessions += 1
                if (sess["id"], stu_id) in presence_map:
                    present_count += 1
                    session_cells.append({
                        "session_id": sess["id"],
                        "subject": sess.get("subject_name", ""),
                        "status": "PRESENT",
                        "marked_at": presence_map[(sess["id"], stu_id)],
                        "present_time": to_ist(presence_map[(sess["id"], stu_id)]),
                    })
                else:
                    absent_count += 1
                    session_cells.append({
                        "session_id": sess["id"],
                        "subject": sess.get("subject_name", ""),
                        "status": "ABSENT",
                        "marked_at": None,
                        "present_time": None,
                    })

            # Summary status for the day cell
            if all(c["status"] == "PRESENT" for c in session_cells):
                day_status = "PRESENT"
            elif any(c["status"] == "PRESENT" for c in session_cells):
                day_status = "PARTIAL"
            else:
                day_status = "ABSENT"

            # Primary time: first PRESENT record
            primary_time = next(
                (c["present_time"] for c in session_cells if c["status"] == "PRESENT"), None
            )
            day_cells[d] = {
                "status": day_status,
                "sessions": session_cells,
                "present_time": primary_time,
            }

        percentage = round(present_count / applicable_sessions * 100, 2) if applicable_sessions > 0 else 0.0

        rows.append({
            **stu_info,
            "days": day_cells,
            "present": present_count,
            "absent": absent_count,
            "applicable_sessions": applicable_sessions,
            "percentage": percentage,
        })

    # Sort by student name
    rows.sort(key=lambda r: r.get("student_name", ""))

    return {
        "month": month,
        "year": year,
        "section": section,
        "subject": subject,
        "active_dates": active_dates,
        "sessions_by_date": {
            d: [
                {
                    "id": s["id"],
                    "subject_name": s.get("subject_name"),
                    "section": s.get("section"),
                }
                for s in sessions_by_date[d]
            ]
            for d in active_dates
        },
        "rows": rows,
        "summary": {
            "total_students": len(rows),
            "total_sessions": len(session_ids),
            "total_present": sum(r["present"] for r in rows),
            "total_absent": sum(r["absent"] for r in rows),
            "avg_percentage": round(
                sum(r["percentage"] for r in rows) / len(rows), 2
            ) if rows else 0.0,
        },
    }


# ─── REPORTING: Subject Summary ───────────────────────────────────────────────

@router.get("/report/subject-summary")
def subject_attendance_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    section: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Subject-wise attendance summary for admin."""
    require_admin_or_faculty(current_user)
    supabase = get_supabase()

    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    start_utc = f"{year:04d}-{month:02d}-01T00:00:00+05:30"
    end_utc = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59+05:30"

    session_query = (
        supabase.table("attendance_sessions")
        .select("id, subject_name, section")
        .gte("created_at", start_utc)
        .lte("created_at", end_utc)
    )
    if section:
        session_query = session_query.eq("section", section)

    session_res = session_query.execute()
    sessions = session_res.data or []

    subject_map: dict[str, dict] = {}
    for sess in sessions:
        subj = sess.get("subject_name", "Unknown")
        sec = sess.get("section", "")
        if subj not in subject_map:
            subject_map[subj] = {"sessions": [], "sections": set()}
        subject_map[subj]["sessions"].append(sess["id"])
        if sec:
            subject_map[subj]["sections"].add(sec)

    result = []
    for subj, info in subject_map.items():
        sess_ids = info["sessions"]
        sections_for_subj = info["sections"]

        # Expected students across all applicable sections
        total_expected = 0
        for sec in sections_for_subj:
            stu_res = (
                supabase.table("students")
                .select("id", count="exact")
                .eq("section", sec)
                .execute()
            )
            total_expected += (stu_res.count or 0)

        applicable_slots = total_expected * len(sess_ids)

        # Count present records
        if sess_ids:
            rec_res = (
                supabase.table("attendance_records")
                .select("id", count="exact")
                .in_("session_id", sess_ids)
                .execute()
            )
            present_count = rec_res.count or 0
        else:
            present_count = 0

        absent_count = max(0, applicable_slots - present_count)
        percentage = round(present_count / applicable_slots * 100, 2) if applicable_slots > 0 else 0.0

        result.append({
            "subject": subj,
            "sessions": len(sess_ids),
            "present": present_count,
            "absent": absent_count,
            "applicable_slots": applicable_slots,
            "percentage": percentage,
        })

    result.sort(key=lambda r: r["subject"])
    return result


# ─── REPORTING: Student Own Attendance ───────────────────────────────────────

@router.get("/report/my")
def my_attendance(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    date: Optional[str] = Query(None, description="Optional specific date YYYY-MM-DD (IST)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Student's own attendance for a month.
    The student_id is ALWAYS derived from the authenticated JWT.
    Never trusts request parameters for identity.
    """
    supabase = get_supabase()

    # Derive student from JWT — never from query params
    student_id = get_student_id_from_user(current_user, supabase)

    # Get the student's section
    stu_res = (
        supabase.table("students")
        .select("id, section, users!inner(id, full_name, ic_number)")
        .eq("id", student_id)
        .execute()
    )
    if not stu_res.data:
        raise HTTPException(status_code=404, detail="Student not found.")

    stu = stu_res.data[0]
    stu_section = stu.get("section") or ""
    user_info = stu.get("users") or {}
    if isinstance(user_info, list):
        user_info = user_info[0] if user_info else {}

    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    start_utc = f"{year:04d}-{month:02d}-01T00:00:00+05:30"
    end_utc = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59+05:30"

    # Fetch sessions applicable to the student's section in the month
    session_query = (
        supabase.table("attendance_sessions")
        .select("id, subject_name, section, created_at, expires_at")
        .gte("created_at", start_utc)
        .lte("created_at", end_utc)
    )
    if stu_section:
        session_query = session_query.eq("section", stu_section)

    session_res = session_query.execute()
    all_sessions = session_res.data or []

    # Filter by specific date if provided
    if date:
        all_sessions = [s for s in all_sessions if session_date_ist(s["created_at"]) == date]

    if not all_sessions:
        return {
            "student_name": user_info.get("full_name", ""),
            "ic_number": user_info.get("ic_number", ""),
            "section": stu_section,
            "month": month,
            "year": year,
            "rows": [],
            "summary": {
                "present": 0,
                "absent": 0,
                "applicable_sessions": 0,
                "percentage": 0.0,
            },
        }

    session_ids = [s["id"] for s in all_sessions]

    # Fetch this student's attendance records for those sessions
    rec_res = (
        supabase.table("attendance_records")
        .select("session_id, marked_at")
        .in_("session_id", session_ids)
        .eq("student_id", student_id)
        .execute()
    )
    presence_map = {r["session_id"]: r["marked_at"] for r in (rec_res.data or [])}

    rows = []
    present_count = 0
    absent_count = 0

    for sess in sorted(all_sessions, key=lambda s: s["created_at"]):
        sess_id = sess["id"]
        d_iso = session_date_ist(sess["created_at"])
        d_display = session_date_display(sess["created_at"])

        if sess_id in presence_map:
            status = "PRESENT"
            marked_at = presence_map[sess_id]
            present_time = to_ist(marked_at)
            present_count += 1
        else:
            status = "ABSENT"
            marked_at = None
            present_time = None
            absent_count += 1

        rows.append({
            "session_id": sess_id,
            "date": d_iso,
            "date_display": d_display,
            "subject_name": sess.get("subject_name", ""),
            "section": stu_section,
            "status": status,
            "marked_at": marked_at,
            "present_time": present_time,
            "present_time_full": to_ist_datetime(marked_at),
        })

    applicable_sessions = len(all_sessions)
    percentage = round(present_count / applicable_sessions * 100, 2) if applicable_sessions > 0 else 0.0

    return {
        "student_name": user_info.get("full_name", ""),
        "ic_number": user_info.get("ic_number", ""),
        "section": stu_section,
        "month": month,
        "year": year,
        "rows": rows,
        "summary": {
            "present": present_count,
            "absent": absent_count,
            "applicable_sessions": applicable_sessions,
            "percentage": percentage,
        },
    }


# ─── REPORTING: Student Subject Summary ──────────────────────────────────────

@router.get("/report/my/subjects")
def my_subject_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    current_user: dict = Depends(get_current_user),
):
    """Subject-wise attendance summary for the authenticated student."""
    supabase = get_supabase()

    student_id = get_student_id_from_user(current_user, supabase)

    stu_res = (
        supabase.table("students")
        .select("id, section")
        .eq("id", student_id)
        .execute()
    )
    if not stu_res.data:
        raise HTTPException(status_code=404, detail="Student not found.")

    stu_section = stu_res.data[0].get("section") or ""

    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    start_utc = f"{year:04d}-{month:02d}-01T00:00:00+05:30"
    end_utc = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59+05:30"

    session_query = (
        supabase.table("attendance_sessions")
        .select("id, subject_name, section, created_at")
        .gte("created_at", start_utc)
        .lte("created_at", end_utc)
    )
    if stu_section:
        session_query = session_query.eq("section", stu_section)

    session_res = session_query.execute()
    all_sessions = session_res.data or []

    if not all_sessions:
        return []

    session_ids = [s["id"] for s in all_sessions]
    rec_res = (
        supabase.table("attendance_records")
        .select("session_id")
        .in_("session_id", session_ids)
        .eq("student_id", student_id)
        .execute()
    )
    present_sessions = {r["session_id"] for r in (rec_res.data or [])}

    # Group by subject
    subject_map: dict[str, dict] = {}
    for sess in all_sessions:
        subj = sess.get("subject_name", "Unknown")
        if subj not in subject_map:
            subject_map[subj] = {"total": 0, "present": 0}
        subject_map[subj]["total"] += 1
        if sess["id"] in present_sessions:
            subject_map[subj]["present"] += 1

    result = []
    for subj, info in subject_map.items():
        total = info["total"]
        present = info["present"]
        absent = total - present
        percentage = round(present / total * 100, 2) if total > 0 else 0.0
        result.append({
            "subject": subj,
            "total": total,
            "present": present,
            "absent": absent,
            "percentage": percentage,
        })

    result.sort(key=lambda r: r["subject"])
    return result
