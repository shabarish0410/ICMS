from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import random
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, get_current_user
)
from app.models import User, Role, ActivityLog, OtpVerification, Student
from app.schemas import (
    LoginRequest, TokenResponse, RefreshRequest, UserOut,
    CompleteProfileRequest, ChangePasswordRequest,
    ForgotPasswordRequest, VerifyOTPRequest, RequestOTPRequest, RegisterRequest
)
from app.core.sms import send_otp_sms

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with IC Number and password."""
    user = db.query(User).filter(User.ic_number == req.ic_number).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid IC Number or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token({"sub": str(user.id), "role": user.role.name})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        is_profile_completed=user.is_profile_completed,
        must_change_password=user.must_change_password,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    return current_user


@router.put("/complete-profile", response_model=UserOut)
def complete_profile(
    req: CompleteProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Complete user profile on first login."""
    current_user.full_name = req.full_name
    current_user.email = req.email
    current_user.mobile = req.mobile
    if req.avatar_url:
        current_user.avatar_url = req.avatar_url
    current_user.is_profile_completed = True
    db.commit()
    db.refresh(current_user)

    log = ActivityLog(user_id=current_user.id, action="profile_completed",
                      entity_type="user", entity_id=current_user.id)
    db.add(log)
    db.commit()

    return current_user


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password (required on first login)."""
    current_user.password_hash = hash_password(req.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh access token."""
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = create_access_token({"sub": str(user.id), "role": user.role.name})
    new_refresh = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        is_profile_completed=user.is_profile_completed,
        must_change_password=user.must_change_password,
    )


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset OTP."""
    user = db.query(User).filter(User.ic_number == req.ic_number).first()
    if not user:
        return {"message": "If the IC Number exists, a reset OTP has been sent"}
    # TODO: Generate OTP, send via email or SMS based on req.method
    # For demo, OTP is always 123456
    return {"message": "If the IC Number exists, a reset OTP has been sent", "demo_otp": "123456"}


@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP and reset password."""
    user = db.query(User).filter(User.ic_number == req.ic_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # TODO: Verify OTP against stored value
    # For demo, accept 123456
    if req.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user.password_hash = hash_password(req.new_password)
    user.must_change_password = False
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """Logout current user."""
    return {"message": "Successfully logged out"}


# ─── Public Student Registration & OTP ────────────────────────────────────────

@router.post("/register/request-otp")
def request_otp(req: RequestOTPRequest, db: Session = Depends(get_db)):
    """Generate and send SMS OTP for registration."""
    # Check if this mobile is already registered
    existing_user = db.query(User).filter(User.mobile == req.mobile).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Mobile number is already registered")

    # Check for existing OTP request
    otp_record = db.query(OtpVerification).filter(OtpVerification.mobile == req.mobile).first()
    now = datetime.now(timezone.utc)
    
    if otp_record:
        # Check cooldown (30 seconds)
        time_elapsed = now - otp_record.created_at.replace(tzinfo=timezone.utc)
        if time_elapsed < timedelta(seconds=30):
            cooldown_left = 30 - int(time_elapsed.total_seconds())
            raise HTTPException(
                status_code=429, 
                detail=f"Please wait {cooldown_left} seconds before requesting a new OTP."
            )
    
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    otp_hash = hash_password(otp)
    
    if otp_record:
        otp_record.otp_hash = otp_hash
        otp_record.attempts = 0
        otp_record.expires_at = now + timedelta(minutes=5)
        otp_record.created_at = now
    else:
        otp_record = OtpVerification(
            mobile=req.mobile,
            otp_hash=otp_hash,
            attempts=0,
            expires_at=now + timedelta(minutes=5),
            created_at=now
        )
        db.add(otp_record)
        
    db.commit()
    
    # Dispatch OTP via SMS service
    sms_sent = send_otp_sms(req.mobile, otp)
    if not sms_sent:
        raise HTTPException(status_code=500, detail="Failed to dispatch SMS OTP. Please try again.")
        
    response = {"message": "OTP sent successfully"}
    # In development/test mock mode, we can expose the OTP to the API for easier local testing
    from app.core.config import settings
    if settings.SMS_PROVIDER.lower() == "mock":
        response["demo_otp"] = otp
        
    return response


@router.post("/register", response_model=TokenResponse)
def register_student(req: RegisterRequest, db: Session = Depends(get_db)):
    """Verify OTP and register new student user."""
    # Check if user with IC Number already exists
    existing_ic = db.query(User).filter(User.ic_number == req.ic_number).first()
    if existing_ic:
        raise HTTPException(status_code=400, detail="IC Number is already registered")
        
    existing_email = db.query(User).filter(User.email == req.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered")

    existing_mobile = db.query(User).filter(User.mobile == req.mobile).first()
    if existing_mobile:
        raise HTTPException(status_code=400, detail="Mobile number is already registered")

    # Fetch OTP record
    otp_record = db.query(OtpVerification).filter(OtpVerification.mobile == req.mobile).first()
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP requested for this mobile number")

    now = datetime.now(timezone.utc)
    if otp_record.expires_at.replace(tzinfo=timezone.utc) < now:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    if otp_record.attempts >= 3:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="Maximum OTP verification attempts exceeded. Please request a new one.")

    # Verify OTP
    if not verify_password(req.otp, otp_record.otp_hash):
        otp_record.attempts += 1
        db.commit()
        attempts_left = 3 - otp_record.attempts
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid OTP. {attempts_left} attempts remaining."
        )

    # Fetch student role
    student_role = db.query(Role).filter(Role.name == "student").first()
    if not student_role:
        raise HTTPException(status_code=500, detail="Student role not found")

    # Create new User
    new_user = User(
        ic_number=req.ic_number,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        email=req.email,
        mobile=req.mobile,
        role_id=student_role.id,
        is_active=True,
        is_profile_completed=False,
        must_change_password=False,  # They set it themselves during registration
        last_login=now
    )
    db.add(new_user)
    db.flush()

    # Create new Student profile
    new_student = Student(
        user_id=new_user.id,
        department="Computer Science",  # Default department, user can change later
        year=1,
        semester=1
    )
    db.add(new_student)
    
    # Audit log
    log = ActivityLog(
        user_id=new_user.id,
        action="register",
        entity_type="user",
        entity_id=new_user.id,
        details={"method": "mobile_otp"}
    )
    db.add(log)
    
    # Clean up OTP record
    db.delete(otp_record)
    db.commit()

    # Create tokens for auto-login
    access_token = create_access_token({"sub": str(new_user.id), "role": "student"})
    refresh_token = create_refresh_token({"sub": str(new_user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        is_profile_completed=False,
        must_change_password=False
    )


from pydantic import BaseModel

class GoogleLoginRequest(BaseModel):
    id_token: str


@router.post("/google", response_model=TokenResponse)
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Authenticate or register user using Google Sign-In."""
    # Mock Google Auth Token validation
    # In production, we'd verify OAuth2 token via Google SDK.
    # In mock, we assume success for demo.
    email = "google_user@icms.edu"
    name = "Google User"
    
    if req.id_token.startswith("valid_token_"):
        email = req.id_token.replace("valid_token_", "")
        name = email.split("@")[0].replace(".", " ").title()
        
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        student_role = db.query(Role).filter(Role.name == "student").first()
        if not student_role:
            raise HTTPException(status_code=500, detail="Student role not found")
            
        ic_suffix = random.randint(1000000, 9999999)
        ic_number = f"IC{ic_suffix}"
        
        user = User(
            ic_number=ic_number,
            password_hash=hash_password(f"google@{ic_number}"),
            full_name=name,
            email=email,
            role_id=student_role.id,
            is_active=True,
            is_profile_completed=False,
            must_change_password=False,
            last_login=datetime.now(timezone.utc)
        )
        db.add(user)
        db.flush()
        
        student = Student(
            user_id=user.id,
            department="Computer Science",
            year=1,
            semester=1
        )
        db.add(student)
        
        log = ActivityLog(
            user_id=user.id,
            action="register",
            entity_type="user",
            entity_id=user.id,
            details={"method": "google"}
        )
        db.add(log)
        db.commit()
    else:
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        
    access_token = create_access_token({"sub": str(user.id), "role": user.role.name})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        is_profile_completed=user.is_profile_completed,
        must_change_password=user.must_change_password
    )
