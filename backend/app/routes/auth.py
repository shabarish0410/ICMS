from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone, timedelta
import random
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, get_current_user
)
from app.schemas import (
    LoginRequest, TokenResponse, RefreshRequest, UserOut,
    CompleteProfileRequest, ChangePasswordRequest,
    ForgotPasswordRequest, VerifyOTPRequest, RequestOTPRequest, RegisterRequest
)
from app.core.sms import send_otp_sms

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """Authenticate user with IC Number and password using Supabase."""
    from app.core.supabase import get_supabase
    from app.core.security import verify_password, create_access_token, create_refresh_token
    
    # Sanitize IC number
    raw_ic = str(req.ic_number).strip()
    if raw_ic.endswith(".0"):
        raw_ic = raw_ic[:-2]
    req.ic_number = raw_ic
    
    supabase = get_supabase()
    
    # Query user and include role relation
    response = supabase.table("users").select("*, role:roles(name)").eq("ic_number", req.ic_number).execute()
    
    if not response.data:
        raise HTTPException(status_code=401, detail="Invalid IC Number or password")
        
    user_data = response.data[0]
    
    if not verify_password(req.password, user_data.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid IC Number or password")

    if not user_data.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update({"last_login": now}).eq("id", user_data["id"]).execute()

    # Extract role name safely, fallback to 'student'
    role_info = user_data.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    access_token = create_access_token({"sub": str(user_data["id"]), "role": role_name})
    refresh_token = create_refresh_token({"sub": str(user_data["id"])})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        is_profile_completed=user_data.get("is_profile_completed", False),
        must_change_password=user_data.get("must_change_password", False),
    )


@router.get("/test-query")
def test_query():
    from app.core.supabase import get_supabase
    supabase = get_supabase()
    try:
        res = supabase.table("users").select("*, role:roles(id, name), student:students(*)").limit(1).execute()
        return {"status": "ok", "data": res.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/me", response_model=dict)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    # Ensure password hash is excluded from profile
    if "password_hash" in current_user:
        del current_user["password_hash"]
    
    return {
        "success": True,
        "user": current_user
    }


@router.put("/complete-profile", response_model=UserOut)
def complete_profile(
    req: CompleteProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    """Complete user profile on first login."""
    from app.core.supabase import get_supabase
    supabase = get_supabase()
    
    update_data = {
        "full_name": req.full_name,
        "email": req.email,
        "mobile": req.mobile,
        "is_profile_completed": True
    }
    if req.avatar_url:
        update_data["avatar_url"] = req.avatar_url
        
    res = supabase.table("users").update(update_data).eq("id", current_user["id"]).execute()
    
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to update profile")
        
    updated_user = res.data[0]
    
    # Activity log
    log_data = {
        "user_id": current_user["id"],
        "action": "profile_completed",
        "entity_type": "user",
        "entity_id": current_user["id"]
    }
    supabase.table("activity_logs").insert(log_data).execute()
    
    return updated_user


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """Change password (required on first login)."""
    from app.core.supabase import get_supabase
    supabase = get_supabase()
    
    update_data = {
        "password_hash": hash_password(req.new_password),
        "must_change_password": False
    }
    
    supabase.table("users").update(update_data).eq("id", current_user["id"]).execute()
    return {"message": "Password changed successfully"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest):
    """Refresh access token."""
    from app.core.supabase import get_supabase
    supabase = get_supabase()
    
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id_str = payload.get("sub")
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        user_id = user_id_str
        
    res = supabase.table("users").select("*, role:roles(name)").eq("id", user_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user = res.data[0]
    role_info = user.get("role")
    role_name = role_info.get("name") if isinstance(role_info, dict) else "student"

    access_token = create_access_token({"sub": str(user["id"]), "role": role_name})
    new_refresh = create_refresh_token({"sub": str(user["id"])})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        is_profile_completed=user.get("is_profile_completed", False),
        must_change_password=user.get("must_change_password", False),
    )


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """Request password reset OTP."""
    from app.core.supabase import get_supabase
    from app.core.email import send_otp_email
    from app.core.security import hash_password
    import random
    from datetime import datetime, timezone, timedelta
    
    supabase = get_supabase()
    
    try:
        res = supabase.table("users").select("id, email, mobile, full_name").eq("ic_number", req.ic_number).execute()
        if not res.data:
            return {"message": "If the IC Number exists, a reset OTP has been sent"}
            
        user = res.data[0]
        email = user.get("email")
        mobile = user.get("mobile")
        full_name = user.get("full_name", "User")
        
        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))
        
        if req.method == "mobile":
            if not mobile:
                raise HTTPException(status_code=400, detail="User does not have a registered mobile number.")
            success = send_otp_sms(mobile, otp)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to send OTP SMS.")
        else:
            if not email:
                raise HTTPException(status_code=400, detail="User does not have a registered email.")
            # This will raise a ValueError if SMTP fails, which is caught by the global try-except below
            send_otp_email(email, otp, full_name)
            
        # Save OTP to database using ic_number in the 'mobile' column for lookup ONLY after email success
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        otp_data = {
            "mobile": req.ic_number,
            "otp_hash": hash_password(otp),
            "expires_at": expires_at,
            "attempts": 0
        }
        
        # Upsert OTP (since mobile is unique)
        existing_otp = supabase.table("otp_verifications").select("id").eq("mobile", req.ic_number).execute()
        if existing_otp.data:
            supabase.table("otp_verifications").update(otp_data).eq("id", existing_otp.data[0]["id"]).execute()
        else:
            supabase.table("otp_verifications").insert(otp_data).execute()
        
        response = {"message": "If the IC Number exists, a reset OTP has been sent"}
        from app.core.config import settings
        if req.method == "mobile" and settings.SMS_PROVIDER.lower() == "mock":
            response["demo_otp"] = otp
            
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")


@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest):
    """Verify OTP and reset password."""
    from app.core.supabase import get_supabase
    from app.core.security import verify_password, hash_password
    from datetime import datetime, timezone
    
    supabase = get_supabase()
    
    res = supabase.table("users").select("id").eq("ic_number", req.ic_number).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user = res.data[0]
    
    otp_res = supabase.table("otp_verifications").select("*").eq("mobile", req.ic_number).execute()
    if not otp_res.data:
        raise HTTPException(status_code=400, detail="No OTP requested for this user")
        
    otp_record = otp_res.data[0]
    
    # Check expiry
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    # Verify hash
    if not verify_password(req.otp, otp_record["otp_hash"]):
        # Increment attempts
        attempts = otp_record.get("attempts", 0) + 1
        supabase.table("otp_verifications").update({"attempts": attempts}).eq("id", otp_record["id"]).execute()
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # Success - delete OTP
    supabase.table("otp_verifications").delete().eq("id", otp_record["id"]).execute()

    update_data = {
        "password_hash": hash_password(req.new_password),
        "must_change_password": False
    }
    supabase.table("users").update(update_data).eq("id", user["id"]).execute()
    
    return {"message": "Password reset successfully"}


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    """Logout current user."""
    return {"message": "Successfully logged out"}


# ─── Public Student Registration & OTP ────────────────────────────────────────

@router.post("/register/request-otp")
def request_otp(req: RequestOTPRequest):
    """Generate and send SMS OTP for registration."""
    from app.core.supabase import get_supabase
    supabase = get_supabase()
    
    # Check if mobile exists
    res = supabase.table("users").select("id").eq("mobile", req.mobile).execute()
    if res.data:
        raise HTTPException(status_code=400, detail="Mobile number is already registered")

    now = datetime.now(timezone.utc)
    
    # Check OTP record
    otp_res = supabase.table("otp_verifications").select("*").eq("mobile", req.mobile).execute()
    
    if otp_res.data:
        otp_record = otp_res.data[0]
        created_at = datetime.fromisoformat(otp_record["created_at"].replace("Z", "+00:00"))
        time_elapsed = now - created_at
        if time_elapsed < timedelta(seconds=30):
            cooldown_left = 30 - int(time_elapsed.total_seconds())
            raise HTTPException(
                status_code=429, 
                detail=f"Please wait {cooldown_left} seconds before requesting a new OTP."
            )
            
    otp = f"{random.randint(100000, 999999)}"
    otp_hash = hash_password(otp)
    expires_at = (now + timedelta(minutes=5)).isoformat()
    
    if otp_res.data:
        supabase.table("otp_verifications").update({
            "otp_hash": otp_hash,
            "attempts": 0,
            "expires_at": expires_at,
            "created_at": now.isoformat()
        }).eq("mobile", req.mobile).execute()
    else:
        supabase.table("otp_verifications").insert({
            "mobile": req.mobile,
            "otp_hash": otp_hash,
            "attempts": 0,
            "expires_at": expires_at,
            "created_at": now.isoformat()
        }).execute()
        
    sms_sent = send_otp_sms(req.mobile, otp)
    if not sms_sent:
        raise HTTPException(status_code=500, detail="Failed to dispatch SMS OTP. Please try again.")
        
    response = {"message": "OTP sent successfully"}
    from app.core.config import settings
    if settings.SMS_PROVIDER.lower() == "mock":
        response["demo_otp"] = otp
        
    return response


@router.post("/register", response_model=TokenResponse)
def register_student(req: RegisterRequest):
    """Verify OTP and register new student user."""
    from app.core.supabase import get_supabase
    supabase = get_supabase()
    
    ic_res = supabase.table("users").select("id").eq("ic_number", req.ic_number).execute()
    if ic_res.data:
        raise HTTPException(status_code=400, detail="IC Number is already registered")
        
    email_res = supabase.table("users").select("id").eq("email", req.email).execute()
    if email_res.data:
        raise HTTPException(status_code=400, detail="Email is already registered")

    mobile_res = supabase.table("users").select("id").eq("mobile", req.mobile).execute()
    if mobile_res.data:
        raise HTTPException(status_code=400, detail="Mobile number is already registered")

    otp_res = supabase.table("otp_verifications").select("*").eq("mobile", req.mobile).execute()
    if not otp_res.data:
        raise HTTPException(status_code=400, detail="No OTP requested for this mobile number")
        
    otp_record = otp_res.data[0]
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    
    if expires_at < now:
        supabase.table("otp_verifications").delete().eq("mobile", req.mobile).execute()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    if otp_record["attempts"] >= 3:
        supabase.table("otp_verifications").delete().eq("mobile", req.mobile).execute()
        raise HTTPException(status_code=400, detail="Maximum OTP verification attempts exceeded.")

    if not verify_password(req.otp, otp_record["otp_hash"]):
        attempts = otp_record["attempts"] + 1
        supabase.table("otp_verifications").update({"attempts": attempts}).eq("mobile", req.mobile).execute()
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {3 - attempts} attempts remaining.")

    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        raise HTTPException(status_code=500, detail="Student role not found")
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
    
    log = {
        "user_id": user_id,
        "action": "register",
        "entity_type": "user",
        "entity_id": user_id,
        "details": {"method": "mobile_otp"}
    }
    supabase.table("activity_logs").insert(log).execute()
    
    supabase.table("otp_verifications").delete().eq("mobile", req.mobile).execute()

    access_token = create_access_token({"sub": str(user_id), "role": "student"})
    refresh_token = create_refresh_token({"sub": str(user_id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        is_profile_completed=False,
        must_change_password=False
    )


# Google login is temporarily disabled.
# @router.post("/google", response_model=TokenResponse)
# def google_login(req: dict):
#     pass

