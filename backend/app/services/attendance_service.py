import logging
from typing import Dict, Any, Optional
from datetime import datetime, date, timezone
import pytz

from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, ValidationError, PermissionDeniedError, BusinessLogicError
from app.schemas import AttendanceMarkRequest, AdminAttendanceMarkRequest, FaceMarkAttendanceRequest
from app.services.ai_service import verify_uniform_with_reference
from app.services.face_service import (
    decode_base64_image, validate_face_image, generate_face_embedding,
    compare_embeddings, perform_liveness_check
)
from app.utils.actions import log_admin_action
from app.services.google_drive import upload_image_to_drive

logger = logging.getLogger("icms.attendance")

def _log_att(supabase, student_id: int, step: str, result: str, message: str) -> None:
    try:
        supabase.table("attendance_logs").insert({
            "student_id": student_id,
            "validation_step": step,
            "result": result,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        logger.warning(f"attendance_log write failed: {e}")


def mark_attendance(req: AttendanceMarkRequest, current_user: dict) -> Dict[str, Any]:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    
    if role_name != "student" or not current_user.get("student"):
        raise PermissionDeniedError("Only students can mark attendance")

    student_data = current_user.get("student")
    if isinstance(student_data, list) and len(student_data) > 0:
        student_id = student_data[0]["id"]
    elif isinstance(student_data, dict):
        student_id = student_data["id"]
    else:
        raise PermissionDeniedError("Student profile not found")

    today = date.today().isoformat()
    supabase = get_supabase()

    student_res = supabase.table("students").select("id, face_registered, department").eq("id", student_id).execute()
    if not student_res.data:
        raise NotFoundError("Student profile not found.")
    if not student_res.data[0].get("face_registered"):
        raise ValidationError("Face registration required. Please register your face in Profile → Face Registration before marking attendance.")

    existing = supabase.table("attendance").select("id").eq("student_id", student_id).eq("date", today).execute()
    if existing.data:
        raise BusinessLogicError("Attendance has already been recorded for today.", status_code=409)

    ist_tz = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.now(timezone.utc).astimezone(ist_tz)
    time_str = now_ist.strftime("%H:%M")
    
    if time_str < "14:30":
        raise ValidationError("Attendance is not open yet. Opens at 2:30 PM.")
    if time_str > "15:00":
        raise ValidationError("Attendance window has closed. It closed at 3:00 PM.")
        
    final_status = "PRESENT"
    if "14:46" <= time_str <= "15:00":
        final_status = "LATE"
        
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


def face_attendance(req: FaceMarkAttendanceRequest, current_user: dict) -> Dict[str, Any]:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student" or not current_user.get("student"):
        raise PermissionDeniedError("Only students can mark attendance")

    student_data = current_user.get("student")
    if isinstance(student_data, list) and len(student_data) > 0:
        student_id = student_data[0]["id"]
    elif isinstance(student_data, dict):
        student_id = student_data["id"]
    else:
        raise PermissionDeniedError("Student profile not found")

    supabase = get_supabase()

    student_res = supabase.table("students").select("id, face_registered, face_embedding").eq("id", student_id).execute()
    if not student_res.data or not student_res.data[0].get("face_registered"):
        _log_att(supabase, student_id, "face_register_check", "FAIL", "Face not registered")
        raise ValidationError("Face not registered. Please register your face in Profile → Face Registration before using face attendance.")
    _log_att(supabase, student_id, "face_register_check", "PASS", "Face is registered")

    try:
        img_bytes = decode_base64_image(req.image_base64)
    except ValueError as e:
        _log_att(supabase, student_id, "image_decode", "FAIL", str(e))
        raise ValidationError(f"Invalid image: {e}")

    validation = validate_face_image(img_bytes)
    if not validation["valid"]:
        _log_att(supabase, student_id, "face_detect", "FAIL", validation["reason"])
        raise ValidationError(validation["reason"])
    _log_att(supabase, student_id, "face_detect", "PASS", f"Face detected (count={validation['face_count']})")

    liveness_frames = req.liveness_frames or []
    if not liveness_frames:
        liveness_frames = [req.image_base64]

    liveness = perform_liveness_check(liveness_frames)
    if not liveness["passed"]:
        _log_att(supabase, student_id, "liveness_check", "FAIL", liveness["reason"])
        raise ValidationError(f"Liveness verification failed: {liveness['reason']}")
    _log_att(supabase, student_id, "liveness_check", "PASS", f"blink={liveness['blink_detected']}, movement={liveness['movement_detected']}")

    live_embedding = generate_face_embedding(img_bytes)
    if live_embedding is None:
        _log_att(supabase, student_id, "embedding_generate", "FAIL", "Could not generate face embedding")
        raise ValidationError("Could not analyze face. Please ensure good lighting and try again.")
    _log_att(supabase, student_id, "embedding_generate", "PASS", "Embedding generated")

    registered_embedding = student_res.data[0].get("face_embedding")
    if not registered_embedding:
        _log_att(supabase, student_id, "embedding_load", "FAIL", "No embedding found in database")
        raise ValidationError("Face embedding not found. Please re-register your face.")
    _log_att(supabase, student_id, "embedding_load", "PASS", "Registered embedding loaded")

    comparison = compare_embeddings(live_embedding, registered_embedding)
    if not comparison["match"]:
        _log_att(supabase, student_id, "face_match", "FAIL", f"distance={comparison['distance']}, threshold={comparison['threshold']}, confidence={comparison['confidence']}%")
        raise BusinessLogicError(f"Face verification failed. The face does not match the registered student. (Confidence: {comparison['confidence']}%)", status_code=401)
    _log_att(supabase, student_id, "face_match", "PASS", f"Match! distance={comparison['distance']}, confidence={comparison['confidence']}%")

    photo_url = req.photo_url 
    drive_file_id = None

    if not photo_url:
        try:
            import uuid
            photo_filename = f"att_{student_id}_{date.today().isoformat()}_{uuid.uuid4().hex[:8]}.jpg"
            drive_file_id, photo_url = upload_image_to_drive(img_bytes, photo_filename)
        except Exception as upload_err:
            logger.warning(f"Google Drive upload failed: {upload_err}")
            photo_url = None

    student_info_res = supabase.table("students").select("department").eq("id", student_id).execute()
    student_department = student_info_res.data[0].get("department") if student_info_res.data else None

    uniform_result = verify_uniform_with_reference(img_bytes, department=student_department)
    uniform_verified = uniform_result["valid"]
    uniform_confidence = uniform_result["confidence"]
    uniform_details = uniform_result.get("details", {})

    if not uniform_verified:
        _log_att(supabase, student_id, "uniform_check", "FAIL", f"Uniform mismatch: {uniform_result['reason']} (confidence={uniform_confidence}%)")
        raise ValidationError(f"Uniform verification failed: {uniform_result['reason']} (Confidence: {uniform_confidence}%)")
    _log_att(supabase, student_id, "uniform_check", "PASS", f"Uniform verified: confidence={uniform_confidence}% reason={uniform_result['reason']}")

    ist_tz = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.now(timezone.utc).astimezone(ist_tz)
    time_str = now_ist.strftime("%H:%M")
    today = date.today().isoformat()

    if time_str < "14:30":
        _log_att(supabase, student_id, "time_window", "FAIL", f"Too early: {time_str}")
        raise ValidationError("Attendance is not open yet. Attendance opens at 2:30 PM.")

    if time_str > "15:00":
        _log_att(supabase, student_id, "time_window", "FAIL", f"Too late: {time_str}")
        raise ValidationError("Attendance window has closed. It closed at 3:00 PM.")

    final_status = "PRESENT"
    if "14:46" <= time_str <= "15:00":
        final_status = "LATE"

    _log_att(supabase, student_id, "time_window", "PASS", f"Time {time_str} → status={final_status}")

    existing = supabase.table("attendance").select("id").eq("student_id", student_id).eq("date", today).execute()
    if existing.data:
        _log_att(supabase, student_id, "duplicate_check", "FAIL", f"Already marked for {today}")
        raise BusinessLogicError("Attendance has already been recorded for today.", status_code=409)
    _log_att(supabase, student_id, "duplicate_check", "PASS", "No duplicate found")

    new_att = {
        "student_id": student_id,
        "date": today,
        "check_in_time": datetime.now(timezone.utc).isoformat(),
        "method": "face",
        "status": final_status,
        "photo_url": photo_url,
        "drive_file_id": drive_file_id,
        "face_verified": True,
        "liveness_verified": True,
        "dress_verified": uniform_verified,
        "uniform_verified": uniform_verified,
        "uniform_confidence": uniform_confidence,
        "uniform_details": uniform_details,
        "attendance_method": "face",
    }

    res = supabase.table("attendance").insert(new_att).execute()
    att_id = res.data[0]["id"]
    final_res = supabase.table("attendance").select("*, student:students(*, user:users(*))").eq("id", att_id).execute()

    _log_att(supabase, student_id, "attendance_saved", "PASS", f"Attendance ID={att_id} saved. Status={final_status} uniform_confidence={uniform_confidence}%")

    return final_res.data[0]


def list_attendance(page: int, size: int, date_filter: str, department: str, team_id: Optional[int], student_id: Optional[int], current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("attendance").select("*, student:students!inner(*, user:users(*))", count="exact")

    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student" and current_user.get("student"):
        student_data = current_user.get("student")
        s_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
        query = query.eq("student_id", s_id)
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
    return {
        "items": res.data,
        "total": res.count or 0,
        "page": page,
        "size": size,
    }


def attendance_stats(current_user: dict) -> Dict[str, Any]:
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
        present = sum(1 for a in att_res.data if a["status"] == "PRESENT")
        late = sum(1 for a in att_res.data if a["status"] == "LATE")
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
        att_today_res = supabase.table("attendance").select("status").eq("date", today).in_("status", ["PRESENT", "LATE"]).execute()
        present_today = sum(1 for a in att_today_res.data if a["status"] in ["PRESENT", "LATE"])
        late_today = sum(1 for a in att_today_res.data if a["status"] == "LATE")

        return {
            "total_students": total_students,
            "present_today": present_today,
            "absent_today": total_students - present_today,
            "late_today": late_today,
            "attendance_percentage": round(present_today / total_students * 100, 1) if total_students > 0 else 0,
        }


def monthly_attendance(month: Optional[int], year: Optional[int], current_user: dict) -> Dict[str, Any]:
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


def admin_mark_attendance(req: AdminAttendanceMarkRequest, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    student_res = supabase.table("students").select("id").eq("id", req.student_id).execute()
    if not student_res.data:
        raise NotFoundError("Student not found")

    date_iso = req.date.isoformat() if isinstance(req.date, date) else req.date
    existing = supabase.table("attendance").select("id, check_in_time").eq("student_id", req.student_id).eq("date", date_iso).execute()

    if existing.data:
        att_id = existing.data[0]["id"]
        update_data = {
            "status": req.status,
            "method": req.method
        }
        if req.status == "ABSENT":
            update_data["check_in_time"] = None
        elif not existing.data[0].get("check_in_time"):
            update_data["check_in_time"] = datetime.now(timezone.utc).isoformat()
            
        supabase.table("attendance").update(update_data).eq("id", att_id).execute()
    else:
        check_in = None
        if req.status in ["PRESENT", "LATE"]:
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
    log_admin_action(current_user["id"], "mark_attendance", "attendance", att_id, new_value=req.model_dump(mode='json'))
    return final_res.data[0]


def delete_attendance(attendance_id: int, current_user: dict) -> None:
    supabase = get_supabase()
    existing = supabase.table("attendance").select("id, photo_url").eq("id", attendance_id).execute()
    if not existing.data:
        raise NotFoundError("Attendance record not found")

    record = existing.data[0]
    photo_url = record.get("photo_url") or ""
    if "supabase.co" in photo_url and "/object/public/" in photo_url:
        try:
            parts = photo_url.split("/object/public/attendance-photos/")
            if len(parts) == 2:
                file_path = parts[1].split("?")[0]
                supabase.storage.from_("attendance-photos").remove([file_path])
        except Exception as e:
            logger.warning(f"Could not delete photo from storage: {e}")

    supabase.table("attendance").delete().eq("id", attendance_id).execute()
    log_admin_action(current_user["id"], "delete", "attendance", attendance_id, old_value=existing.data[0])
