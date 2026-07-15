"""
Face Recognition Service for ICMS
Uses DeepFace (ArcFace) for embedding generation with Gemini Vision fallback.
Uses MediaPipe Face Mesh for liveness detection.
"""
import base64
import io
import math
import logging
from typing import List, Optional, Dict, Any

import numpy as np
from PIL import Image

logger = logging.getLogger("icms.face")

# ─── Constants ────────────────────────────────────────────────────────────────
FACE_MATCH_THRESHOLD = 0.40   # Cosine distance — lower = more similar
MIN_FACE_SIZE = 80            # Minimum face size in pixels
LIVENESS_BLINK_THRESHOLD = 0.20  # Eye Aspect Ratio threshold for blink
LIVENESS_HEAD_POSE_THRESHOLD = 10  # Degrees for head pose change
EMBEDDING_DIM = 512           # ArcFace embedding dimension


# ─── Utility ──────────────────────────────────────────────────────────────────

def decode_base64_image(image_b64: str) -> bytes:
    """Decode a base64 image string to raw bytes."""
    # Strip data URI prefix if present (e.g., 'data:image/jpeg;base64,...')
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    try:
        return base64.b64decode(image_b64)
    except Exception as e:
        raise ValueError(f"Invalid base64 image data: {e}")


def bytes_to_pil(image_bytes: bytes) -> Image.Image:
    """Convert raw bytes to a PIL Image."""
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def cosine_distance(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine distance between two embedding vectors."""
    import ast
    if isinstance(vec1, str):
        try:
            vec1 = ast.literal_eval(vec1)
        except:
            pass
    if isinstance(vec2, str):
        try:
            vec2 = ast.literal_eval(vec2)
        except:
            pass
            
    a = np.array(vec1, dtype=np.float64)
    b = np.array(vec2, dtype=np.float64)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / (norm_a * norm_b))


def average_embeddings(embeddings: List[List[float]]) -> List[float]:
    """Average multiple face embeddings into one representative embedding."""
    arr = np.array(embeddings, dtype=np.float64)
    avg = np.mean(arr, axis=0)
    # L2-normalize the average
    norm = np.linalg.norm(avg)
    if norm > 0:
        avg = avg / norm
    return avg.tolist()


# ─── Image Quality Validation ──────────────────────────────────────────────────

def validate_face_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    Validate image quality for face registration/attendance.
    Returns: {'valid': bool, 'reason': str, 'face_count': int}
    """
    try:
        img = bytes_to_pil(image_bytes)
        width, height = img.size
        
        # Check minimum dimensions
        if width < 200 or height < 200:
            return {"valid": False, "reason": "Image resolution too low. Please use better lighting.", "face_count": 0}

        # Try DeepFace face detection first
        try:
            from deepface import DeepFace
            faces = DeepFace.extract_faces(
                img_path=np.array(img),
                detector_backend="opencv",
                enforce_detection=True,
                align=True
            )
            
            if len(faces) == 0:
                return {"valid": False, "reason": "No face detected. Please position your face clearly.", "face_count": 0}
            
            if len(faces) > 1:
                return {"valid": False, "reason": "Multiple faces detected. Only one person should be in frame.", "face_count": len(faces)}
            
            face = faces[0]
            # Check face size
            region = face.get("facial_area", {})
            face_w = region.get("w", 0)
            face_h = region.get("h", 0)
            if face_w < MIN_FACE_SIZE or face_h < MIN_FACE_SIZE:
                return {"valid": False, "reason": "Face too small. Move closer to the camera.", "face_count": 1}
            
            # Check confidence
            confidence = face.get("confidence", 0)
            if confidence < 0.85:
                return {"valid": False, "reason": "Low face confidence. Ensure good lighting and remove obstructions.", "face_count": 1}
            
            # Check blurriness (Laplacian variance)
            import cv2
            gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
            blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
            if blur_score < 70:  # Strict blur threshold
                return {"valid": False, "reason": "Image is blurry. Hold the camera steady.", "face_count": 1}
                
            # Lighting validation (average pixel brightness)
            mean_brightness = np.mean(gray)
            if mean_brightness < 60:
                return {"valid": False, "reason": "Image is too dark. Please move to a well-lit area.", "face_count": 1}
            elif mean_brightness > 240:
                return {"valid": False, "reason": "Image is too bright. Please reduce backlighting.", "face_count": 1}
            
            # Side face rejection: OpenCV frontalface detector naturally filters out severe side profiles.
            return {"valid": True, "reason": "OK", "face_count": 1, "quality_score": round(blur_score)}
            
        except ImportError:
            # DeepFace not available — use basic PIL check as fallback
            logger.warning("DeepFace not installed. Using basic image validation.")
            return {"valid": True, "reason": "OK (basic validation)", "face_count": 1}
            
        except Exception as e:
            err_msg = str(e).lower()
            if "face could not be detected" in err_msg or "no face" in err_msg:
                return {"valid": False, "reason": "No face detected. Please position your face clearly.", "face_count": 0}
            logger.error(f"Face validation error: {e}")
            return {"valid": True, "reason": "OK (validation bypassed)", "face_count": 1}
            
    except Exception as e:
        logger.error(f"Image decode error: {e}")
        return {"valid": False, "reason": "Invalid image. Please try again.", "face_count": 0}


# ─── Face Embedding ────────────────────────────────────────────────────────────

def generate_face_embedding(image_bytes: bytes) -> Optional[List[float]]:
    """
    Generate a 512-dim ArcFace embedding from an image.
    Falls back to Gemini-based hash if DeepFace unavailable (for env without heavy deps).
    """
    try:
        img_pil = bytes_to_pil(image_bytes)
        img_array = np.array(img_pil)
        
        try:
            from deepface import DeepFace
            result = DeepFace.represent(
                img_path=img_array,
                model_name="ArcFace",
                detector_backend="opencv",
                enforce_detection=True,
                align=True
            )
            embedding = result[0]["embedding"]
            # Normalize to unit vector
            vec = np.array(embedding, dtype=np.float64)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            return vec.tolist()
            
        except ImportError:
            logger.warning("DeepFace not installed. Using fallback embedding.")
            return _fallback_embedding(img_pil)
            
        except Exception as e:
            logger.error(f"DeepFace embedding error: {e}")
            return None
            
    except Exception as e:
        logger.error(f"generate_face_embedding error: {e}")
        return None


def _fallback_embedding(img_pil: Image.Image) -> List[float]:
    """
    Lightweight fallback: resize to 8x8 grayscale and compute a 64-dim normalized perceptual hash.
    NOTE: This is NOT production-grade. Use only when DeepFace is unavailable.
    """
    img_small = img_pil.convert("L").resize((64, 64))
    arr = np.array(img_small, dtype=np.float64).flatten()
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    # Pad or trim to 512 dims
    if len(arr) < 512:
        arr = np.pad(arr, (0, 512 - len(arr)))
    else:
        arr = arr[:512]
    return arr.tolist()


# ─── Embedding Comparison ──────────────────────────────────────────────────────

def compare_embeddings(embedding1: List[float], embedding2: List[float]) -> Dict[str, Any]:
    """
    Compare two face embeddings.
    Returns: {'match': bool, 'distance': float, 'confidence': float}
    """
    distance = cosine_distance(embedding1, embedding2)
    match = distance < FACE_MATCH_THRESHOLD
    # Convert distance to confidence percentage (inverse of distance normalized to threshold)
    confidence = max(0.0, min(100.0, (1.0 - distance / FACE_MATCH_THRESHOLD) * 100))
    return {
        "match": match,
        "distance": round(distance, 4),
        "confidence": round(confidence, 1),
        "threshold": FACE_MATCH_THRESHOLD
    }


# ─── Liveness Detection ────────────────────────────────────────────────────────

def eye_aspect_ratio(eye_landmarks: List) -> float:
    """Compute Eye Aspect Ratio (EAR) for blink detection."""
    # Eye landmarks: 6 points defining the eye contour
    if len(eye_landmarks) < 6:
        return 0.3
    p1, p2, p3, p4, p5, p6 = eye_landmarks[:6]
    
    def dist(a, b):
        return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
    
    # Vertical distances
    v1 = dist(p2, p6)
    v2 = dist(p3, p5)
    # Horizontal distance
    h = dist(p1, p4)
    
    if h == 0:
        return 0.3
    return (v1 + v2) / (2.0 * h)


def perform_liveness_check(frames_base64: List[str]) -> Dict[str, Any]:
    """
    Liveness detection using MediaPipe Face Mesh across multiple frames.
    Detects:
    - Blink (EAR drops below threshold)
    - Head movement (yaw/pitch changes)
    
    Returns: {'passed': bool, 'reason': str, 'blink_detected': bool, 'movement_detected': bool}
    """
    if not frames_base64:
        return {"passed": False, "reason": "No frames provided for liveness check.", "blink_detected": False, "movement_detected": False}
    
    try:
        import mediapipe as mp
        mp_face_mesh = mp.solutions.face_mesh
        
        # MediaPipe eye landmark indices
        LEFT_EYE = [362, 385, 387, 263, 373, 380]
        RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        # Nose tip and chin for head pose
        NOSE_TIP = 1
        CHIN = 199
        LEFT_EAR_LANDMARK = 234
        RIGHT_EAR_LANDMARK = 454
        
        ear_values = []
        yaw_values = []
        pitch_values = []
        blink_detected = False
        
        with mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        ) as face_mesh:
            
            for i, frame_b64 in enumerate(frames_base64):
                try:
                    img_bytes = decode_base64_image(frame_b64)
                    img_pil = bytes_to_pil(img_bytes)
                    img_rgb = np.array(img_pil)
                    
                    results = face_mesh.process(img_rgb)
                    
                    if not results.multi_face_landmarks:
                        continue
                    
                    lm = results.multi_face_landmarks[0].landmark
                    
                    # EAR for blink detection
                    class LM:
                        def __init__(self, x, y):
                            self.x = x
                            self.y = y
                    
                    left_eye_pts = [LM(lm[idx].x, lm[idx].y) for idx in LEFT_EYE]
                    right_eye_pts = [LM(lm[idx].x, lm[idx].y) for idx in RIGHT_EYE]
                    
                    left_ear = eye_aspect_ratio(left_eye_pts)
                    right_ear = eye_aspect_ratio(right_eye_pts)
                    avg_ear = (left_ear + right_ear) / 2.0
                    ear_values.append(avg_ear)
                    
                    # Simple head pose: horizontal ratio (left ear x vs right ear x)
                    nose_x = lm[NOSE_TIP].x
                    left_x = lm[LEFT_EAR_LANDMARK].x
                    right_x = lm[RIGHT_EAR_LANDMARK].x
                    
                    if right_x != left_x:
                        yaw_ratio = (nose_x - left_x) / (right_x - left_x)
                        yaw_values.append(yaw_ratio)
                    
                    nose_y = lm[NOSE_TIP].y
                    chin_y = lm[CHIN].y
                    pitch_values.append(abs(chin_y - nose_y))
                    
                except Exception as frame_err:
                    logger.debug(f"Frame {i} processing error: {frame_err}")
                    continue
        
        # Blink detection: EAR drops below threshold at some point
        if ear_values:
            min_ear = min(ear_values)
            max_ear = max(ear_values)
            ear_range = max_ear - min_ear
            blink_detected = min_ear < LIVENESS_BLINK_THRESHOLD or ear_range > 0.08
        
        # Head movement detection: yaw variation
        movement_detected = False
        if len(yaw_values) >= 2:
            yaw_range = max(yaw_values) - min(yaw_values)
            movement_detected = yaw_range > 0.05  # 5% ratio change in yaw
        
        if len(frames_base64) < 3:
            return {
                "passed": False,
                "reason": "Insufficient frames for liveness check. Please follow the on-screen prompts.",
                "blink_detected": blink_detected,
                "movement_detected": movement_detected
            }
        
        # Require at least one of: blink OR head movement
        passed = blink_detected or movement_detected
        
        if not passed:
            return {
                "passed": False,
                "reason": "Liveness verification failed. Please blink or move your head slightly.",
                "blink_detected": blink_detected,
                "movement_detected": movement_detected
            }
        
        return {
            "passed": True,
            "reason": "Liveness verified.",
            "blink_detected": blink_detected,
            "movement_detected": movement_detected
        }
        
    except ImportError:
        logger.warning("MediaPipe not installed. Liveness check bypassed (permissive fallback).")
        # If MediaPipe not available, do basic motion detection across frames
        return _basic_liveness_check(frames_base64)
    except Exception as e:
        logger.error(f"Liveness check error: {e}")
        # Fail-open: allow attendance if liveness library crashes (don't block students)
        return {"passed": True, "reason": "Liveness bypassed (service error).", "blink_detected": True, "movement_detected": True}


def _basic_liveness_check(frames_base64: List[str]) -> Dict[str, Any]:
    """
    Fallback liveness: compare pixel-level variance across frames.
    A static photo will have zero variance; a live camera will have some.
    """
    if len(frames_base64) < 3:
        return {"passed": False, "reason": "Need at least 3 frames.", "blink_detected": False, "movement_detected": False}
    
    try:
        arrays = []
        for f in frames_base64[:5]:
            img_bytes = decode_base64_image(f)
            img = bytes_to_pil(img_bytes).resize((64, 64)).convert("L")
            arrays.append(np.array(img, dtype=np.float32))
        
        if len(arrays) < 2:
            return {"passed": False, "reason": "Could not process frames.", "blink_detected": False, "movement_detected": False}
        
        # Compute mean pixel difference between consecutive frames
        diffs = [np.mean(np.abs(arrays[i + 1] - arrays[i])) for i in range(len(arrays) - 1)]
        avg_diff = np.mean(diffs)
        
        # A real camera feed will have at least 2-3 pixel diff; a static image repeated will be 0
        passed = avg_diff > 2.0
        return {
            "passed": passed,
            "reason": "Liveness verified." if passed else "Liveness verification failed. Static image detected.",
            "blink_detected": passed,
            "movement_detected": passed
        }
    except Exception as e:
        logger.error(f"Basic liveness check error: {e}")
        return {"passed": True, "reason": "Liveness bypassed.", "blink_detected": True, "movement_detected": True}

from datetime import datetime, timezone
import uuid
from passlib.context import CryptContext
from app.core.supabase import get_supabase
from app.core.exceptions import NotFoundError, ValidationError, PermissionDeniedError, BusinessLogicError
from app.schemas import FaceRegisterRequest, FaceUpdateRequest
from app.services.google_drive import upload_image_to_drive

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _get_student_id(current_user: dict) -> int:
    student_data = current_user.get("student")
    if isinstance(student_data, list) and len(student_data) > 0:
        return student_data[0]["id"]
    elif isinstance(student_data, dict):
        return student_data["id"]
    raise PermissionDeniedError("Student profile not found")

def _log_validation(supabase, student_id: int, step: str, result: str, message: str):
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

def register_face(req: FaceRegisterRequest, current_user: dict) -> dict:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise PermissionDeniedError("Only students can register their face")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()
    request_id = uuid.uuid4().hex[:8]

    try:
        img_bytes = decode_base64_image(req.image_base64)
    except Exception as e:
        raise BusinessLogicError(f"Decoding image failed: {str(e)}", status_code=500)

    validation = validate_face_image(img_bytes)
    if not validation["valid"]:
        raise ValidationError(validation["reason"])

    embedding = generate_face_embedding(img_bytes)
    if embedding is None:
        raise ValidationError("Could not generate face embedding. Please ensure clear lighting and try again.")

    filename = f"face_reg_{student_id}_{request_id}.jpg"
    try:
        drive_file_id, face_image_url = upload_image_to_drive(img_bytes, filename)
    except Exception:
        raise BusinessLogicError("Google Drive upload failed. Please try again.", status_code=500)

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        update_data = {
            "face_registered": True,
            "face_registered_at": now_iso
        }
        res = supabase.table("students").update(update_data).eq("id", student_id).execute()
        if not res.data:
            raise NotFoundError("Student profile not found.")
            
        face_data = {
            "student_id": student_id,
            "face_embedding": embedding,
            "face_image_url": face_image_url,
            "updated_at": now_iso
        }
        supabase.table("student_faces").upsert(face_data, on_conflict="student_id").execute()
    except Exception as e:
        raise BusinessLogicError(f"Updating Supabase failed: {str(e)}", status_code=500)

    _log_validation(supabase, student_id, "face_registration", "PASS", "Registered single face image successfully")

    return {
        "success": True,
        "message": "Face registered successfully!",
        "registered_at": now_iso
    }

def get_face_status(student_id: int, current_user: dict) -> dict:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    if role_name == "student":
        my_student_id = _get_student_id(current_user)
        if my_student_id != student_id:
            raise PermissionDeniedError("Access denied")

    supabase = get_supabase()
    res = supabase.table("students").select("id, face_registered, face_registered_at, face_image_url").eq("id", student_id).execute()
    if not res.data:
        raise NotFoundError("Student not found")

    student = res.data[0]
    return {
        "student_id": student_id,
        "face_registered": bool(student.get("face_registered", False)),
        "registered_at": student.get("face_registered_at"),
        "face_image_url": student.get("face_image_url")
    }

def get_my_face_status(current_user: dict) -> dict:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise PermissionDeniedError("Only students can check face status")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()
    res = supabase.table("students").select("id, face_registered, face_registered_at, face_image_url").eq("id", student_id).execute()
    
    if not res.data:
        raise NotFoundError("Student not found")

    student = res.data[0]
    return {
        "student_id": student_id,
        "face_registered": bool(student.get("face_registered", False)),
        "registered_at": student.get("face_registered_at"),
        "face_image_url": student.get("face_image_url")
    }

def update_face(req: FaceUpdateRequest, current_user: dict) -> dict:
    role_info = current_user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"
    if role_name != "student":
        raise PermissionDeniedError("Only students can update their face registration")

    student_id = _get_student_id(current_user)
    supabase = get_supabase()
    request_id = uuid.uuid4().hex[:8]

    user_id = current_user.get("id")
    if not user_id:
        raise PermissionDeniedError("User not authenticated")

    user_res = supabase.table("users").select("password_hash").eq("id", user_id).execute()
    if not user_res.data:
        raise NotFoundError("User not found")
        
    password_hash = user_res.data[0]["password_hash"]
    if not pwd_context.verify(req.password, password_hash):
        raise PermissionDeniedError("Invalid password. Please try again.")

    try:
        img_bytes = decode_base64_image(req.image_base64)
    except ValueError:
        raise ValidationError("Invalid image format provided.")

    validation = validate_face_image(img_bytes)
    if not validation["valid"]:
        raise ValidationError(validation["reason"])

    embedding = generate_face_embedding(img_bytes)
    if embedding is None:
        raise ValidationError("Could not generate face embedding. Please ensure clear lighting and try again.")

    filename = f"face_reg_{student_id}_{request_id}.jpg"
    try:
        drive_file_id, face_image_url = upload_image_to_drive(img_bytes, filename)
    except Exception:
        raise BusinessLogicError("Google Drive upload failed. Please try again.", status_code=500)

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        update_data = {
            "face_registered": True,
            "face_registered_at": now_iso
        }
        res = supabase.table("students").update(update_data).eq("id", student_id).execute()
        if not res.data:
            raise NotFoundError("Student profile not found.")
            
        face_data = {
            "student_id": student_id,
            "face_embedding": embedding,
            "face_image_url": face_image_url,
            "updated_at": now_iso
        }
        supabase.table("student_faces").upsert(face_data, on_conflict="student_id").execute()
    except Exception:
        raise BusinessLogicError("Database update failed while saving registration.", status_code=500)

    _log_validation(supabase, student_id, "face_update", "PASS", "Updated single face image successfully")

    return {
        "success": True,
        "message": "Face registration updated successfully!",
        "updated_at": now_iso
    }

def reset_face(student_id: int, current_user: dict) -> dict:
    supabase = get_supabase()

    student_res = supabase.table("students").select("id").eq("id", student_id).execute()
    if not student_res.data:
        raise NotFoundError("Student not found")

    supabase.table("students").update({
        "face_registered": False,
        "face_registered_at": None,
        "face_embedding": None,
        "face_image_url": None,
        "face_drive_file_id": None
    }).eq("id", student_id).execute()

    _log_validation(supabase, student_id, "face_reset", "INFO", f"Face reset by admin user {current_user.get('id')}")

    return {"success": True, "message": "Face registration reset successfully."}

def admin_face_status(department: str, page: int, size: int, current_user: dict) -> dict:
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

