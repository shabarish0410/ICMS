"""
Face Registration & Verification API Routes
POST /api/face/register      — Student registers their face (5-10 images)
GET  /api/face/status/{id}   — Get face registration status
PUT  /api/face/update        — Student updates their face (requires password)
DELETE /api/face/reset/{id}  — Admin resets student face registration
POST /api/face/verify        — Verify a face against registered embedding
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime, timezone
import logging

from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import (
    FaceRegisterRequest, FaceStatusOut, FaceUpdateRequest, FaceVerifyRequest, FaceMarkAttendanceRequest
)
from app.services.face_service import (
    decode_base64_image,
    validate_face_image,
    generate_face_embedding,
    average_embeddings,
    compare_embeddings,
)
from app.services.google_drive import upload_image_to_drive
from passlib.context import CryptContext

logger = logging.getLogger("icms.face")
router = APIRouter(prefix="/api/face", tags=["Face"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_student_id(current_user: dict) -> int:
    """Extract student ID from current user dict."""
    student_data = current_user.get("student")
    if isinstance(student_data, list) and len(student_data) > 0:
        return student_data[0]["id"]
    elif isinstance(student_data, dict):
        return student_data["id"]
    raise HTTPException(status_code=403, detail="Student profile not found")


def _log_validation(supabase, student_id: int, step: str, result: str, message: str):
    """Log a validation step to attendance_logs table (fire-and-forget)."""
    try:
        supabase.table("attendance_logs").insert({
            "student_id": student_id,
            "validation_step": step,
            "result": result,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to write attendance log: {e}")


# ─── POST /api/face/register ──────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register_face(
    req: "FaceRegisterRequest",
    current_user: dict = Depends(get_current_user)
):
    """
    Register student face. Accepts a single high-quality base64 image.
    Generates ArcFace embeddings and stores them in the students table.
    """
    import uuid
    import traceback
    
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise HTTPException(status_code=403, detail="Only students can register their face")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()
    request_id = uuid.uuid4().hex[:8]

    logger.info(f"[Req {request_id}] Starting face registration for student {student_id}")

    # 1. Decode image
    logger.info(f"[Req {request_id}] Decoding image")
    try:
        img_bytes = decode_base64_image(req.image_base64)
    except Exception as e:
        logger.exception(f"[Req {request_id}] Face registration failed at decoding image")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Decoding image failed: {str(e)}")

    # 2. Quality validation
    logger.info(f"[Req {request_id}] Detecting face")
    try:
        validation = validate_face_image(img_bytes)
        if not validation["valid"]:
            logger.warning(f"[Req {request_id}] Image validation failed: {validation['reason']}")
            raise HTTPException(status_code=400, detail=validation["reason"])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Req {request_id}] Face registration failed at face detection")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Detecting face failed: {str(e)}")

    # 3. Generate embedding
    logger.info(f"[Req {request_id}] Generating embedding")
    try:
        embedding = generate_face_embedding(img_bytes)
        if embedding is None:
            logger.error(f"[Req {request_id}] Could not generate face embedding for student {student_id}")
            raise HTTPException(status_code=400, detail="Could not generate face embedding. Please ensure clear lighting and try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Req {request_id}] Face registration failed at embedding generation")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Generating embedding failed: {str(e)}")

    # 4. Upload to Google Drive
    logger.info(f"[Req {request_id}] Uploading to Google Drive")
    filename = f"face_reg_{student_id}_{request_id}.jpg"
    try:
        drive_file_id, face_image_url = upload_image_to_drive(img_bytes, filename)
    except Exception as e:
        logger.error(f"[Req {request_id}] Google Drive upload failed: {e}")
        raise HTTPException(status_code=500, detail="Google Drive upload failed. Please try again.")

    now_iso = datetime.now(timezone.utc).isoformat()

    # 5. Store metadata in Supabase (students table)
    logger.info(f"[Req {request_id}] Updating Supabase")
    try:
        # Update students table
        update_data = {
            "face_registered": True,
            "face_registered_at": now_iso
        }
        res = supabase.table("students").update(update_data).eq("id", student_id).execute()
        if not res.data:
            logger.error(f"[Req {request_id}] Database update failed: Student {student_id} not found.")
            raise HTTPException(status_code=404, detail="Student profile not found.")
            
        # Upsert embedding and image URL into student_faces table
        face_data = {
            "student_id": student_id,
            "face_embedding": embedding,
            "face_image_url": face_image_url,
            "updated_at": now_iso
        }
        # Assuming student_id is unique, upsert on student_id
        face_res = supabase.table("student_faces").upsert(face_data, on_conflict="student_id").execute()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Req {request_id}] Face registration failed at Supabase update")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Updating Supabase failed: {str(e)}")

    _log_validation(supabase, student_id, "face_registration", "PASS", "Registered single face image successfully")
    logger.info(f"[Req {request_id}] Registration completed")

    return {
        "success": True,
        "message": "Face registered successfully!",
        "registered_at": now_iso
    }


# ─── GET /api/face/status/{student_id} ───────────────────────────────────────

@router.get("/status/{student_id}", response_model="FaceStatusOut")
def get_face_status(
    student_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get face registration status for a student."""
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    # Students can only view their own status
    if role_name == "student":
        my_student_id = _get_student_id(current_user)
        if my_student_id != student_id:
            raise HTTPException(status_code=403, detail="Access denied")

    supabase = get_supabase()
    res = supabase.table("students").select("id, face_registered, face_registered_at, face_image_url").eq("id", student_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Student not found")

    student = res.data[0]
    return {
        "student_id": student_id,
        "face_registered": bool(student.get("face_registered", False)),
        "registered_at": student.get("face_registered_at"),
        "face_image_url": student.get("face_image_url")
    }


# ─── GET /api/face/my-status ─────────────────────────────────────────────────

@router.get("/my-status")
def get_my_face_status(current_user: dict = Depends(get_current_user)):
    """Get face registration status for the currently logged-in student."""
    import traceback
    try:
        role_info = current_user.get("role")
        role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
        if role_name != "student":
            raise HTTPException(status_code=403, detail="Only students can check face status")

        student_id = _get_student_id(current_user)
        supabase = get_supabase()
        res = supabase.table("students").select("id, face_registered, face_registered_at, face_image_url").eq("id", student_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Student not found")

        student = res.data[0]
        return {
            "student_id": student_id,
            "face_registered": bool(student.get("face_registered", False)),
            "registered_at": student.get("face_registered_at"),
            "face_image_url": student.get("face_image_url")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching face status: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── PUT /api/face/update ─────────────────────────────────────────────────────

@router.put("/update", status_code=200)
def update_face(
    req: "FaceUpdateRequest",
    current_user: dict = Depends(get_current_user)
):
    """
    Update student face registration.
    Requires password verification and a single high-quality base64 image.
    """
    import uuid
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise HTTPException(status_code=403, detail="Only students can update their face registration")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()
    request_id = uuid.uuid4().hex[:8]
    
    logger.info(f"[Req {request_id}] Starting face update for student {student_id}")

    # 1. Verify password
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    user_res = supabase.table("users").select("password_hash").eq("id", user_id).execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    password_hash = user_res.data[0]["password_hash"]
    if not pwd_context.verify(req.password, password_hash):
        logger.warning(f"[Req {request_id}] Face update failed: Invalid password for student {student_id}")
        raise HTTPException(status_code=401, detail="Invalid password. Please try again.")

    # 2. Decode image
    try:
        img_bytes = decode_base64_image(req.image_base64)
    except ValueError as e:
        logger.warning(f"[Req {request_id}] Invalid base64 image format: {e}")
        raise HTTPException(status_code=400, detail="Invalid image format provided.")

    # 3. Quality validation
    validation = validate_face_image(img_bytes)
    if not validation["valid"]:
        logger.warning(f"[Req {request_id}] Image validation failed: {validation['reason']}")
        raise HTTPException(status_code=400, detail=validation["reason"])

    # 4. Generate embedding
    embedding = generate_face_embedding(img_bytes)
    if embedding is None:
        logger.error(f"[Req {request_id}] Could not generate face embedding for student {student_id}")
        raise HTTPException(status_code=400, detail="Could not generate face embedding. Please ensure clear lighting and try again.")

    # 5. Upload to Google Drive
    filename = f"face_reg_{student_id}_{request_id}.jpg"
    try:
        drive_file_id, face_image_url = upload_image_to_drive(img_bytes, filename)
    except Exception as e:
        logger.error(f"[Req {request_id}] Google Drive upload failed: {e}")
        raise HTTPException(status_code=500, detail="Google Drive upload failed. Please try again.")

    now_iso = datetime.now(timezone.utc).isoformat()

    # 6. Store metadata in Supabase (students table)
    try:
        update_data = {
            "face_registered": True,
            "face_registered_at": now_iso
        }
        res = supabase.table("students").update(update_data).eq("id", student_id).execute()
        if not res.data:
            logger.error(f"[Req {request_id}] Database update failed: Student {student_id} not found.")
            raise HTTPException(status_code=404, detail="Student profile not found.")
            
        # Upsert embedding and image URL into student_faces table
        face_data = {
            "student_id": student_id,
            "face_embedding": embedding,
            "face_image_url": face_image_url,
            "updated_at": now_iso
        }
        face_res = supabase.table("student_faces").upsert(face_data, on_conflict="student_id").execute()
        
    except Exception as e:
        logger.exception(f"[Req {request_id}] Database update exception: {e}")
        raise HTTPException(status_code=500, detail="Database update failed while saving registration.")

    _log_validation(supabase, student_id, "face_update", "PASS", "Updated single face image successfully")
    logger.info(f"[Req {request_id}] Face registration updated for student {student_id}")

    return {
        "success": True,
        "message": "Face registration updated successfully!",
        "updated_at": now_iso
    }


# ─── DELETE /api/face/reset/{student_id} ─────────────────────────────────────

@router.delete("/reset/{student_id}", status_code=200)
def reset_face(
    student_id: int,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Admin: Reset a student's face registration."""
    supabase = get_supabase()

    # Verify student exists
    student_res = supabase.table("students").select("id").eq("id", student_id).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")

    # Reset flag and clear embeddings/image data
    supabase.table("students").update({
        "face_registered": False,
        "face_registered_at": None,
        "face_embedding": None,
        "face_image_url": None,
        "face_drive_file_id": None
    }).eq("id", student_id).execute()

    _log_validation(supabase, student_id, "face_reset", "INFO", f"Face reset by admin user {current_user.get('id')}")

    return {"success": True, "message": "Face registration reset successfully."}


# ─── GET /api/face/admin/all-status ──────────────────────────────────────────

@router.get("/admin/all-status")
def admin_face_status(
    department: str = "",
    page: int = 1,
    size: int = 50,
    current_user: dict = Depends(require_roles("admin", "super_admin"))
):
    """Admin: Get face registration status for all students."""
    supabase = get_supabase()

    query = supabase.table("students").select(
        "id, face_registered, face_registered_at, department, user:users(id, ic_number, full_name, email)",
        count="exact"
    )

    if department:
        query = query.eq("department", department)

    res = query.order("face_registered", desc=False).range(
        (page - 1) * size, page * size - 1
    ).execute()

    return {
        "items": res.data,
        "total": res.count or 0,
        "page": page,
        "size": size
    }
