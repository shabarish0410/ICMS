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
    Register student face. Accepts 5-10 base64 images.
    Generates ArcFace embeddings and stores the averaged embedding.
    """
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise HTTPException(status_code=403, detail="Only students can register their face")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()

    images = req.images_base64
    if len(images) < 1 or len(images) > 10:
        raise HTTPException(
            status_code=400,
            detail=f"Please provide between 1 and 10 images. You provided {len(images)}."
        )

    # Validate and generate embeddings for each image
    embeddings = []
    errors = []
    for i, img_b64 in enumerate(images):
        try:
            img_bytes = decode_base64_image(img_b64)
        except ValueError as e:
            errors.append(f"Image {i + 1}: {str(e)}")
            continue

        # Quality validation
        validation = validate_face_image(img_bytes)
        if not validation["valid"]:
            errors.append(f"Image {i + 1}: {validation['reason']}")
            continue

        # Generate embedding
        embedding = generate_face_embedding(img_bytes)
        if embedding is None:
            errors.append(f"Image {i + 1}: Could not generate face embedding. Please retake.")
            continue

        embeddings.append(embedding)

    # Need at least 1 valid embedding
    if len(embeddings) < 1:
        raise HTTPException(
            status_code=400,
            detail=f"Registration failed. Not enough valid face images. Errors: {'; '.join(errors[:3])}"
        )

    # Average all valid embeddings into one representative vector
    final_embedding = average_embeddings(embeddings)

    # Check if student already has a face registered
    existing = supabase.table("student_faces").select("id").eq("student_id", student_id).execute()

    now_iso = datetime.now(timezone.utc).isoformat()

    if existing.data:
        # Update existing embedding
        supabase.table("student_faces").update({
            "face_embedding": final_embedding,
            "model_version": "ArcFace",
            "updated_at": now_iso
        }).eq("student_id", student_id).execute()
    else:
        # Insert new embedding
        supabase.table("student_faces").insert({
            "student_id": student_id,
            "face_embedding": final_embedding,
            "model_version": "ArcFace",
            "created_at": now_iso,
            "updated_at": now_iso
        }).execute()

    # Mark student as face-registered
    supabase.table("students").update({
        "face_registered": True,
        "face_registered_at": now_iso
    }).eq("id", student_id).execute()

    _log_validation(supabase, student_id, "face_registration", "PASS",
                    f"Registered {len(embeddings)} face images successfully")

    return {
        "success": True,
        "message": "Face registered successfully!",
        "images_processed": len(embeddings),
        "images_failed": len(errors),
        "errors": errors,
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
    res = supabase.table("students").select("id, face_registered, face_registered_at").eq("id", student_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Student not found")

    student = res.data[0]
    return {
        "student_id": student_id,
        "face_registered": bool(student.get("face_registered", False)),
        "registered_at": student.get("face_registered_at")
    }


# ─── GET /api/face/my-status ─────────────────────────────────────────────────

@router.get("/my-status")
def get_my_face_status(current_user: dict = Depends(get_current_user)):
    """Get face registration status for the currently logged-in student."""
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise HTTPException(status_code=403, detail="Only students can check face status")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()
    res = supabase.table("students").select("id, face_registered, face_registered_at").eq("id", student_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Student not found")

    student = res.data[0]
    return {
        "student_id": student_id,
        "face_registered": bool(student.get("face_registered", False)),
        "registered_at": student.get("face_registered_at")
    }


# ─── PUT /api/face/update ─────────────────────────────────────────────────────

@router.put("/update", status_code=200)
def update_face(
    req: "FaceUpdateRequest",
    current_user: dict = Depends(get_current_user)
):
    """Update student face embedding. Requires password confirmation."""
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise HTTPException(status_code=403, detail="Only students can update their face")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()

    # Verify password
    user_id = current_user.get("id")
    user_res = supabase.table("users").select("password_hash").eq("id", user_id).execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")

    password_hash = user_res.data[0]["password_hash"]
    if not pwd_context.verify(req.password, password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Face update denied.")

    # Re-register (same flow as register)
    images = req.images_base64
    if len(images) < 1:
        raise HTTPException(status_code=400, detail="Please provide at least 1 image.")

    embeddings = []
    for i, img_b64 in enumerate(images):
        try:
            img_bytes = decode_base64_image(img_b64)
            validation = validate_face_image(img_bytes)
            if not validation["valid"]:
                continue
            embedding = generate_face_embedding(img_bytes)
            if embedding:
                embeddings.append(embedding)
        except Exception:
            continue

    if len(embeddings) < 1:
        raise HTTPException(status_code=400, detail="Not enough valid face images. Please retake.")

    final_embedding = average_embeddings(embeddings)
    now_iso = datetime.now(timezone.utc).isoformat()

    existing = supabase.table("student_faces").select("id").eq("student_id", student_id).execute()
    if existing.data:
        supabase.table("student_faces").update({
            "face_embedding": final_embedding,
            "updated_at": now_iso
        }).eq("student_id", student_id).execute()
    else:
        supabase.table("student_faces").insert({
            "student_id": student_id,
            "face_embedding": final_embedding,
            "model_version": "ArcFace",
            "created_at": now_iso,
            "updated_at": now_iso
        }).execute()

    supabase.table("students").update({
        "face_registered": True,
        "face_registered_at": now_iso
    }).eq("id", student_id).execute()

    _log_validation(supabase, student_id, "face_update", "PASS", "Face embedding updated successfully")

    return {"success": True, "message": "Face updated successfully!", "updated_at": now_iso}


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

    # Delete embedding
    supabase.table("student_faces").delete().eq("student_id", student_id).execute()

    # Reset flag
    supabase.table("students").update({
        "face_registered": False,
        "face_registered_at": None
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
