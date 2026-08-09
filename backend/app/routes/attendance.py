from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.core.supabase import get_supabase
from app.core.security import get_current_user

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

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
    res = supabase.table('attendance_sessions').select('*').eq('id', session_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found. Please scan a valid QR code.")

    session_data = res.data[0]

    # Auto-mark expired sessions
    expires_at = datetime.fromisoformat(session_data['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        session_data['is_active'] = False

    return session_data

@router.post("/mark")
def mark_attendance(req: MarkAttendanceRequest):
    """Public endpoint — no auth required so mobile can submit attendance."""
    supabase = get_supabase()

    # ── 1. Verify session ────────────────────────────────────────────────────
    session_res = supabase.table('attendance_sessions').select('*').eq('id', req.session_id).execute()
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Invalid session. Please scan the QR code again.")

    session_data = session_res.data[0]
    if not session_data.get('is_active'):
        raise HTTPException(status_code=400, detail="This attendance session has been closed.")

    expires_at = datetime.fromisoformat(session_data['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This attendance session has expired.")

    # ── 2. Find user by IC number ────────────────────────────────────────────
    ic = req.ic_number.strip().upper()

    # Try exact match on ic_number first
    user_res = supabase.table('users').select('id, full_name, ic_number').eq('ic_number', ic).execute()

    if not user_res.data:
        # Try case-insensitive partial match on ic_number OR exact match on full_name
        ic_clean = ic.replace('-', '').replace(' ', '')
        all_users = supabase.table('users').select('id, full_name, ic_number').execute()
        
        matched = []
        for u in (all_users.data or []):
            u_ic = (u.get('ic_number') or '').replace('-', '').replace(' ', '').upper()
            u_name = (u.get('full_name') or '').strip().upper()
            if u_ic == ic_clean or u_name == ic:
                matched.append(u)
                
        if matched:
            user_res_data = matched
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No student found with IC Number or Name '{ic}'. Please check your input and try again."
            )
    else:
        user_res_data = user_res.data

    user = user_res_data[0]
    user_id = user['id']
    student_name = user.get('full_name', 'Unknown')

    # ── 3. Find student record ───────────────────────────────────────────────
    student_res = supabase.table('students').select('id').eq('user_id', user_id).execute()
    if not student_res.data:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found. Please contact your administrator."
        )

    student = student_res.data[0]
    student_id = student['id']

    # ── 4. Check for duplicate in attendance_records (session-specific) ──────
    dup_res = supabase.table('attendance_records').select('id').eq('session_id', req.session_id).eq('student_id', student_id).execute()
    if dup_res.data:
        raise HTTPException(status_code=400, detail="Attendance already marked for this session.")

    # ── 5. Insert into attendance_records (session-based) ────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table('attendance_records').insert({
        "session_id": req.session_id,
        "student_id": student_id,
        "student_name": student_name,
        "student_identifier": ic,
        "marked_at": now_iso,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "device_id": req.device_id,
    }).execute()

    # ── 6. Also update the main attendance table for daily records ───────────
    today = datetime.now(timezone.utc).date().isoformat()
    existing_res = supabase.table('attendance').select('id, status').eq('student_id', student_id).eq('date', today).execute()

    if existing_res.data:
        existing = existing_res.data[0]
        if existing['status'].upper() != 'PRESENT':
            supabase.table('attendance').update({
                "status": "PRESENT",
                "check_in_time": now_iso,
                "method": "qr",
            }).eq('id', existing['id']).execute()
    else:
        supabase.table('attendance').insert({
            "student_id": student_id,
            "date": today,
            "status": "PRESENT",
            "check_in_time": now_iso,
            "method": "qr",
        }).execute()

    return {"success": True, "message": f"Attendance marked for {student_name}!"}


@router.get("/session/{session_id}/records")
def get_attendance_records(session_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch all attendance records for a session (Admin only)."""
    supabase = get_supabase()
    res = supabase.table('attendance_records').select('*').eq('session_id', session_id).order('marked_at', desc=True).execute()
    return res.data or []


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
    supabase = get_supabase()

    now_ts = datetime.now(timezone.utc).timestamp()
    expires_at = datetime.fromtimestamp(now_ts + (req.duration_minutes * 60), timezone.utc).isoformat()

    data = {
        "faculty_id": current_user['id'],
        "subject_name": req.subject_name,
        "section": req.section,
        "is_active": True,
        "expires_at": expires_at,
        "gps_latitude": req.gps_latitude,
        "gps_longitude": req.gps_longitude,
        "gps_radius": req.gps_radius,
    }

    res = supabase.table('attendance_sessions').insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create session. Please try again.")

    return {"success": True, "session": res.data[0]}


@router.post("/session/{session_id}/close")
def close_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Close an active attendance session (Admin/Faculty only)."""
    supabase = get_supabase()

    res = supabase.table('attendance_sessions').update({"is_active": False}).eq('id', session_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found.")

    return {"success": True}
