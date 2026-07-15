import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta

from app.core.supabase import get_supabase
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.services.email_service import send_email
from app.utils.otp import generate_otp
from app.core.sms import send_otp_sms
from app.core.config import settings
from app.schemas import RegisterRequest
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError, BusinessLogicError

logger = logging.getLogger("icms.auth")

def authenticate_user(ic_number: str, password: str) -> Dict[str, Any]:
    """Authenticate user and return access tokens (2FA removed)."""
    supabase = get_supabase()
    
    res = supabase.table("users").select("*, role:roles(name)").eq("ic_number", ic_number).execute()
    if not res.data:
        logger.warning(f"Login failed: IC Number '{ic_number}' not found.")
        raise PermissionDeniedError("Invalid IC Number or password")
        
    user_data = res.data[0]
    
    if not verify_password(password, user_data.get("password_hash")):
        logger.warning(f"Login failed: Password verification failed for '{ic_number}'.")
        raise PermissionDeniedError("Invalid IC Number or password")

    if user_data.get("is_active") is False:
        logger.warning(f"Login failed: Account '{ic_number}' deactivated.")
        raise PermissionDeniedError("Account is deactivated")
        
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update({"last_login": now}).eq("id", user_data["id"]).execute()

    role_info = user_data.get("role")
    if isinstance(role_info, list) and len(role_info) > 0:
        role_info = role_info[0]
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    access_token = create_access_token({"sub": str(user_data["id"]), "role": role_name})
    refresh_token = create_refresh_token({"sub": str(user_data["id"])})

    face_registered = None
    if role_name == "student":
        try:
            student_res = supabase.table("students").select("face_registered").eq("user_id", user_data["id"]).execute()
            if student_res.data:
                face_registered = bool(student_res.data[0].get("face_registered", False))
        except Exception as e:
            logger.warning(f"Could not fetch face_registered status: {e}")

    logger.info(f"Login successful for '{ic_number}'.")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "is_profile_completed": bool(user_data.get("is_profile_completed")),
        "must_change_password": bool(user_data.get("must_change_password")),
        "face_registered": face_registered,
    }



def complete_user_profile(user_id: int, full_name: str, email: str, mobile: str, avatar_url: Optional[str]) -> Dict[str, Any]:
    """Mark a user profile as complete."""
    supabase = get_supabase()
    update_data = {
        "full_name": full_name,
        "email": email,
        "mobile": mobile,
        "is_profile_completed": True
    }
    if avatar_url:
        update_data["avatar_url"] = avatar_url
        
    res = supabase.table("users").update(update_data).eq("id", user_id).execute()
    if not res.data:
        raise BusinessLogicError("Failed to update profile")
        
    supabase.table("activity_logs").insert({
        "user_id": user_id,
        "action": "profile_completed",
        "entity_type": "user",
        "entity_id": user_id
    }).execute()
    
    return res.data[0]


def change_user_password(user_id: int, new_password: str) -> None:
    """Change the user's password."""
    supabase = get_supabase()
    supabase.table("users").update({
        "password_hash": hash_password(new_password),
        "must_change_password": False
    }).eq("id", user_id).execute()


def refresh_user_token(refresh_token: str) -> Dict[str, Any]:
    """Generate a new access token using a refresh token."""
    supabase = get_supabase()
    payload = decode_token(refresh_token)
    
    if payload.get("type") != "refresh":
        raise PermissionDeniedError("Invalid refresh token")

    user_id = int(payload.get("sub"))
        
    res = supabase.table("users").select("*, role:roles(name)").eq("id", user_id).execute()
    if not res.data:
        raise NotFoundError("User not found")
        
    user = res.data[0]
    role_info = user.get("role")
    if isinstance(role_info, list) and len(role_info) > 0:
        role_info = role_info[0]
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    access_token = create_access_token({"sub": str(user["id"]), "role": role_name})
    new_refresh = create_refresh_token({"sub": str(user["id"])})

    return {
        "access_token": access_token,
        "refresh_token": new_refresh,
        "is_profile_completed": bool(user.get("is_profile_completed")),
        "must_change_password": bool(user.get("must_change_password")),
    }


def process_forgot_password(ic_number: str, method: str) -> Dict[str, Any]:
    """Send a password reset OTP."""
    supabase = get_supabase()
    res = supabase.table("users").select("id, email, mobile, full_name").eq("ic_number", ic_number).execute()
    
    if not res.data:
        return {"message": "If the IC Number exists, a reset OTP has been sent"}
        
    user = res.data[0]
    email = user.get("email")
    mobile = user.get("mobile")
    
    otp = generate_otp()
    
    if method == "mobile":
        if not mobile:
            raise ValidationError("User does not have a registered mobile number.")
        if not send_otp_sms(mobile, otp):
            raise BusinessLogicError("Failed to send OTP SMS.")
    else:
        if not email:
            raise ValidationError("User does not have a registered email.")
        html = f"<div style='font-family:Arial'><h2>Password Reset OTP</h2><p>Your OTP is:</p><h1 style='color:blue'>{otp}</h1><p>This OTP is valid for 10 minutes.</p></div>"
        send_email(to_email=email, subject="Password Reset OTP", html=html)
        
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    otp_data = {
        "mobile": ic_number,
        "otp_hash": hash_password(otp),
        "expires_at": expires_at,
        "attempts": 0
    }
    
    existing_otp = supabase.table("otp_verifications").select("id").eq("mobile", ic_number).execute()
    if existing_otp.data:
        supabase.table("otp_verifications").update(otp_data).eq("id", existing_otp.data[0]["id"]).execute()
    else:
        supabase.table("otp_verifications").insert(otp_data).execute()
    
    response = {"message": "If the IC Number exists, a reset OTP has been sent"}
    if method == "mobile" and settings.SMS_PROVIDER.lower() == "mock":
        response["demo_otp"] = otp
        
    return response


def verify_password_reset_otp(ic_number: str, otp: str, new_password: str) -> None:
    """Verify OTP and reset password."""
    supabase = get_supabase()
    res = supabase.table("users").select("id").eq("ic_number", ic_number).execute()
    if not res.data:
        raise NotFoundError("User not found")
        
    user = res.data[0]
    
    otp_res = supabase.table("otp_verifications").select("*").eq("mobile", ic_number).execute()
    if not otp_res.data:
        raise ValidationError("No OTP requested for this user")
        
    otp_record = otp_res.data[0]
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise ValidationError("OTP has expired")
        
    if not verify_password(otp, otp_record["otp_hash"]):
        attempts = otp_record.get("attempts", 0) + 1
        supabase.table("otp_verifications").update({"attempts": attempts}).eq("id", otp_record["id"]).execute()
        raise ValidationError("Invalid OTP")
        
    supabase.table("otp_verifications").delete().eq("id", otp_record["id"]).execute()

    supabase.table("users").update({
        "password_hash": hash_password(new_password),
        "must_change_password": False
    }).eq("id", user["id"]).execute()


def request_registration_otp(mobile: str) -> Dict[str, Any]:
    """Request OTP for student registration."""
    supabase = get_supabase()
    if supabase.table("users").select("id").eq("mobile", mobile).execute().data:
        raise ValidationError("Mobile number is already registered")

    now = datetime.now(timezone.utc)
    otp_res = supabase.table("otp_verifications").select("*").eq("identifier", mobile).execute()
    
    if otp_res.data:
        otp_record = otp_res.data[0]
        created_at = datetime.fromisoformat(otp_record["created_at"].replace("Z", "+00:00"))
        time_elapsed = now - created_at
        if time_elapsed < timedelta(seconds=30):
            cooldown_left = 30 - int(time_elapsed.total_seconds())
            raise BusinessLogicError(f"Please wait {cooldown_left} seconds before requesting a new OTP.", status_code=429)
            
    otp = generate_otp()
    expires_at = (now + timedelta(minutes=5)).isoformat()
    
    otp_data = {
        "identifier": mobile,
        "otp_hash": hash_password(otp),
        "attempts": 0,
        "expires_at": expires_at,
        "created_at": now.isoformat()
    }
    
    if otp_res.data:
        supabase.table("otp_verifications").update(otp_data).eq("identifier", mobile).execute()
    else:
        supabase.table("otp_verifications").insert(otp_data).execute()
        
    if not send_otp_sms(mobile, otp):
        raise BusinessLogicError("Failed to dispatch SMS OTP. Please try again.")
        
    response = {"message": "OTP sent successfully"}
    if settings.SMS_PROVIDER.lower() == "mock":
        response["demo_otp"] = otp
        
    return response


def register_new_student(req: RegisterRequest) -> Dict[str, Any]:
    """Verify OTP and register new student user."""
    supabase = get_supabase()
    
    if supabase.table("users").select("id").eq("ic_number", req.ic_number).execute().data:
        raise ValidationError("IC Number is already registered")
    if supabase.table("users").select("id").eq("email", req.email).execute().data:
        raise ValidationError("Email is already registered")
    if supabase.table("users").select("id").eq("mobile", req.mobile).execute().data:
        raise ValidationError("Mobile number is already registered")

    otp_res = supabase.table("otp_verifications").select("*").eq("identifier", req.mobile).execute()
    if not otp_res.data:
        raise ValidationError("No OTP requested for this mobile number")
        
    otp_record = otp_res.data[0]
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    
    if expires_at < now:
        supabase.table("otp_verifications").delete().eq("identifier", req.mobile).execute()
        raise ValidationError("OTP has expired. Please request a new one.")

    if otp_record["attempts"] >= 3:
        supabase.table("otp_verifications").delete().eq("identifier", req.mobile).execute()
        raise ValidationError("Maximum OTP verification attempts exceeded.")

    if not verify_password(req.otp, otp_record["otp_hash"]):
        attempts = otp_record["attempts"] + 1
        supabase.table("otp_verifications").update({"attempts": attempts}).eq("identifier", req.mobile).execute()
        raise ValidationError(f"Invalid OTP. {3 - attempts} attempts remaining.")

    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        raise BusinessLogicError("Student role not found")
    role_id = role_res.data[0]["id"]

    new_user = {
        "ic_number": req.ic_number,
        "password_hash": hash_password(req.password),
        "full_name": req.full_name,
        "email": req.email,
        "mobile": req.mobile,
        "role_id": role_id,
        "is_active": True,
        "is_profile_completed": False,
        "must_change_password": False,
        "last_login": now.isoformat()
    }
    
    user_insert = supabase.table("users").insert(new_user).execute()
    user_id = user_insert.data[0]["id"]

    new_student = {
        "user_id": user_id,
        "department": "Computer Science",
        "year": 1,
        "semester": 1
    }
    supabase.table("students").insert(new_student).execute()
    
    supabase.table("activity_logs").insert({
        "user_id": user_id,
        "action": "register",
        "entity_type": "user",
        "entity_id": user_id,
        "details": {"method": "mobile_otp"}
    }).execute()
    
    supabase.table("otp_verifications").delete().eq("identifier", req.mobile).execute()

    access_token = create_access_token({"sub": str(user_id), "role": "student"})
    refresh_token = create_refresh_token({"sub": str(user_id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "is_profile_completed": False,
        "must_change_password": False
    }
