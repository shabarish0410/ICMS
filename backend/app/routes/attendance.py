from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, date, timezone
import pytz
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import AttendanceMarkRequest, AdminAttendanceMarkRequest, AttendanceOut, PaginatedResponse
from app.services.ai_service import verify_dress_code
import math

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.post("/mark", response_model=AttendanceOut, status_code=201)
def mark_attendance(
    req: AttendanceMarkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark attendance for today. Student marks their own attendance."""
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    
    if role_name != "student" or not current_user.get("student"):
        raise HTTPException(status_code=403, detail="Only students can mark attendance")

    student_data = current_user.get("student")
    if isinstance(student_data, list) and len(student_data) > 0:
        student_id = student_data[0]["id"]
    elif isinstance(student_data, dict):
        student_id = student_data["id"]
    else:
        raise HTTPException(status_code=403, detail="Student profile not found")

    today = date.today().isoformat()
    supabase = get_supabase()

    existing = supabase.table("attendance").select("id").eq("student_id", student_id).eq("date", today).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Attendance already marked for today")

    # Time Window Logic (IST)
    ist_tz = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.now(timezone.utc).astimezone(ist_tz)
    time_str = now_ist.strftime("%H:%M")
    
    if time_str < "14:30":
        raise HTTPException(status_code=400, detail="NOT ALLOWED")
        
    if time_str > "14:40":
        raise HTTPException(status_code=400, detail="INVALID - OUT OF TIME WINDOW")
        
    final_status = "present"
    if "14:36" <= time_str <= "14:40":
        final_status = "late"
        
    # AI Dress Code Logic
    if req.method == "face" and req.photo_url:
        is_valid_dress = verify_dress_code(req.photo_url)
        if not is_valid_dress:
            final_status = "rejected_dresscode"

    new_att = {
        "student_id": student_id,
        "date": today,
        "check_in_time": datetime.now(timezone.utc).isoformat(),
        "method": req.method,
        "status": final_status,
        "photo_url": req.photo_url,
    }
    
    res = supabase.table("attendance").insert(new_att).execute()
    att_id = res.data[0]["id"]
    final_res = supabase.table("attendance").select("*, student:students(*, user:users(*))").eq("id", att_id).execute()
    return final_res.data[0]


@router.get("", response_model=PaginatedResponse)
def list_attendance(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    date_filter: str = Query("", description="Filter by date (YYYY-MM-DD)"),
    department: str = Query(""),
    team_id: int = Query(None),
    student_id: int = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List attendance. Student: own. Admin: all with filters."""
    supabase = get_supabase()
    query = supabase.table("attendance").select("*, student:students!inner(*, user:users(*))", count="exact")

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student" and current_user.get("student"):
        student_data = current_user.get("student")
        student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
        query = query.eq("student_id", student_id)
    else:
        if student_id:
            query = query.eq("student_id", student_id)
        if department:
            query = query.eq("student.department", department)
        if team_id:
            query = query.eq("student.team_id", team_id)

    if date_filter:
        query = query.eq("date", date_filter)

    res = query.order("date", desc=True).range((page - 1) * size, page * size - 1).execute()
    
    return PaginatedResponse(
        items=res.data,
        total=res.count or 0, page=page, size=size, pages=math.ceil((res.count or 0) / size) if (res.count or 0) else 0,
    )


@router.get("/stats")
def attendance_stats(current_user: dict = Depends(get_current_user)):
    """Attendance statistics."""
    supabase = get_supabase()
    today = date.today().isoformat()
    
    total_res = supabase.table("users").select("id", count="exact").eq("is_active", True).eq("role_id", 2).execute()
    total_students = total_res.count or 0

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student" and current_user.get("student"):
        student_data = current_user.get("student")
        student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
        
        att_res = supabase.table("attendance").select("status").eq("student_id", student_id).execute()
        total_days = len(att_res.data)
        present = sum(1 for a in att_res.data if a["status"] == "present")
        late = sum(1 for a in att_res.data if a["status"] == "late")
        percentage = (present + late) / total_days * 100 if total_days > 0 else 0

        today_marked_res = supabase.table("attendance").select("id").eq("student_id", student_id).eq("date", today).execute()

        return {
            "total_days": total_days,
            "present": present,
            "late": late,
            "absent": total_days - present - late,
            "percentage": round(percentage, 1),
            "today_marked": len(today_marked_res.data) > 0,
        }
    else:
        # Admin stats
        att_today_res = supabase.table("attendance").select("status").eq("date", today).in_("status", ["present", "late"]).execute()
        present_today = sum(1 for a in att_today_res.data if a["status"] in ["present", "late"])
        late_today = sum(1 for a in att_today_res.data if a["status"] == "late")

        return {
            "total_students": total_students,
            "present_today": present_today,
            "absent_today": total_students - present_today,
            "late_today": late_today,
            "attendance_percentage": round(present_today / total_students * 100, 1) if total_students > 0 else 0,
        }


@router.get("/monthly")
def monthly_attendance(
    month: int = Query(None, ge=1, le=12),
    year: int = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get monthly attendance summary."""
    supabase = get_supabase()
    now = datetime.now()
    m = month or now.month
    y = year or now.year

    start_date = date(y, m, 1).isoformat()
    if m == 12:
        end_date = date(y + 1, 1, 1).isoformat()
    else:
        end_date = date(y, m + 1, 1).isoformat()

    query = supabase.table("attendance").select("*").gte("date", start_date).lt("date", end_date)

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student" and current_user.get("student"):
        student_data = current_user.get("student")
        student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
        query = query.eq("student_id", student_id)

    res = query.execute()
    
    days = {}
    for r in res.data:
        day_str = r["date"]
        if day_str not in days:
            days[day_str] = {"present": 0, "absent": 0, "late": 0}
        days[day_str][r["status"]] = days[day_str].get(r["status"], 0) + 1

    return {"month": m, "year": y, "days": days}


@router.post("/admin/mark", response_model=AttendanceOut)
def admin_mark_attendance(
    req: AdminAttendanceMarkRequest,
    current_user: dict = Depends(require_roles("admin"))
):
    """Mark or update attendance for any student on a given date (Admin only)."""
    supabase = get_supabase()
    student_res = supabase.table("students").select("id").eq("id", req.student_id).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")

    date_iso = req.date.isoformat() if isinstance(req.date, date) else req.date
    
    existing = supabase.table("attendance").select("id, check_in_time").eq("student_id", req.student_id).eq("date", date_iso).execute()

    if existing.data:
        att_id = existing.data[0]["id"]
        update_data = {
            "status": req.status,
            "method": req.method
        }
        if req.status == "absent":
            update_data["check_in_time"] = None
        elif not existing.data[0].get("check_in_time"):
            update_data["check_in_time"] = datetime.now(timezone.utc).isoformat()
            
        supabase.table("attendance").update(update_data).eq("id", att_id).execute()
    else:
        check_in = None
        if req.status in ["present", "late"]:
            check_in = datetime.now(timezone.utc).isoformat()
            
        new_att = {
            "student_id": req.student_id,
            "date": date_iso,
            "check_in_time": check_in,
            "method": req.method,
            "status": req.status,
        }
        res = supabase.table("attendance").insert(new_att).execute()
        att_id = res.data[0]["id"]

    final_res = supabase.table("attendance").select("*, student:students(*, user:users(*))").eq("id", att_id).execute()
    return final_res.data[0]


@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(
    attendance_id: int,
    current_user: dict = Depends(require_roles("super_admin", "admin")),
):
    """Delete an attendance record (and clears its photo_url). Admin only."""
    supabase = get_supabase()
    
    existing = supabase.table("attendance").select("id, photo_url").eq("id", attendance_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    # If photo stored in Supabase Storage, try to remove it
    record = existing.data[0]
    photo_url = record.get("photo_url") or ""
    if "supabase.co" in photo_url and "/object/public/" in photo_url:
        try:
            # Extract the path after the bucket name
            parts = photo_url.split("/object/public/attendance-photos/")
            if len(parts) == 2:
                file_path = parts[1].split("?")[0]  # strip query params
                supabase.storage.from_("attendance-photos").remove([file_path])
        except Exception as e:
            print(f"⚠️ Could not delete photo from storage: {e}")

    supabase.table("attendance").delete().eq("id", attendance_id).execute()
    return
