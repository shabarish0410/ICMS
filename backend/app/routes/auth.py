from fastapi import APIRouter, Depends
from app.core.security import get_current_user, oauth2_scheme, blacklist_token
from app.schemas import (
    LoginRequest, TokenResponse, RefreshRequest, UserOut,
    CompleteProfileRequest, ChangePasswordRequest,
    ForgotPasswordRequest, VerifyOTPRequest, RequestOTPRequest, RegisterRequest, Verify2FARequest
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """Authenticate user with IC Number and password."""
    # Sanitize IC number
    raw_ic = str(req.ic_number).strip()
    if raw_ic.endswith(".0"):
        raw_ic = raw_ic[:-2]
    req.ic_number = raw_ic
    
    return auth_service.authenticate_user(req.ic_number, req.password)


@router.post("/verify-2fa", response_model=TokenResponse)
def verify_login_2fa(req: Verify2FARequest):
    """Verify 2FA OTP and issue tokens."""
    return auth_service.verify_login_2fa(req.ic_number, req.otp)


@router.get("/me", response_model=dict)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user's profile."""
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
    return auth_service.complete_user_profile(
        user_id=current_user["id"],
        full_name=req.full_name,
        email=req.email,
        mobile=req.mobile,
        avatar_url=req.avatar_url
    )


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """Change password (required on first login)."""
    auth_service.change_user_password(current_user["id"], req.new_password)
    return {"message": "Password changed successfully"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest):
    """Refresh access token."""
    return auth_service.refresh_user_token(req.refresh_token)


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """Request password reset OTP."""
    return auth_service.process_forgot_password(req.ic_number, req.method)


@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest):
    """Verify OTP and reset password."""
    auth_service.verify_password_reset_otp(req.ic_number, req.otp, req.new_password)
    return {"message": "Password reset successfully"}


@router.post("/logout")
def logout(
    token: str = Depends(oauth2_scheme),
    current_user: dict = Depends(get_current_user)
):
    """Logout current user by blacklisting their access token."""
    blacklist_token(token)
    return {"message": "Successfully logged out"}


# ─── Public Student Registration & OTP ────────────────────────────────────────

@router.post("/register/request-otp")
def request_otp(req: RequestOTPRequest):
    """Generate and send SMS OTP for registration."""
    return auth_service.request_registration_otp(req.mobile)


@router.post("/register", response_model=TokenResponse)
def register_student(req: RegisterRequest):
    """Verify OTP and register new student user."""
    return auth_service.register_new_student(req)

