from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Use Python's standard logger instead of hardcoded Windows file paths
logger = logging.getLogger("icms.security")

# In-memory token blacklist (use Redis in production)
token_blacklist: set[str] = set()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": int(expire.timestamp()), "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode.update({"exp": int(expire.timestamp()), "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    logger.debug(f"decode_token called. Token snippet: {token[:15]}...")
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        logger.debug(f"decode_token success. Payload: {payload}")
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode error: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        import traceback
        logger.error(f"Unexpected decode error:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unexpected token error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def blacklist_token(token: str):
    token_blacklist.add(token)


def is_token_blacklisted(token: str) -> bool:
    return token in token_blacklist


def get_current_user(
    token: str = Depends(oauth2_scheme)
):
    from app.core.supabase import get_supabase

    if is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked"
        )

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type"
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    supabase = get_supabase()
    try:
        try:
            uid = int(user_id)
        except ValueError:
            uid = user_id
            
        res = supabase.table("users").select("*, role:roles(id, name)").eq("id", uid).execute()
        
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
            
        user = res.data[0]
        
        if not user.get("is_active"):
            if user.get("is_active") is False:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated"
                )

        # Normalize role from list to dict if PostgREST returns a list
        role_info = user.get("role")
        if isinstance(role_info, list) and len(role_info) > 0:
            user["role"] = role_info[0]
            role_info = user["role"]
        
        role_name = role_info.get("name") if isinstance(role_info, dict) else None
        
        if role_name == "student":
            student_res = supabase.table("students").select("*").eq("user_id", uid).execute()
            user["student"] = student_res.data
            
        # Ensure booleans are not None to prevent Pydantic ValidationError
        user["is_active"] = bool(user.get("is_active", True))
        user["is_profile_completed"] = bool(user.get("is_profile_completed", False))
        user["must_change_password"] = bool(user.get("must_change_password", False))

        return user
    except Exception as e:
        import traceback
        logger.error(f"Error in get_current_user: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Backend Error: {str(e)}"
        )


def require_roles(*allowed_roles: str):
    """Dependency factory for role-based access control."""

    def role_checker(current_user: dict = Depends(get_current_user)):
        role_info = current_user.get("role")
        role_name = None
        
        if isinstance(role_info, list) and len(role_info) > 0:
            role_name = role_info[0].get("name")
        elif isinstance(role_info, dict):
            role_name = role_info.get("name")
        elif isinstance(role_info, str):
            role_name = role_info
            
        if role_name and role_name in allowed_roles:
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
        )

    return role_checker
