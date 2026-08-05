from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, decode_refresh_token
from app.services.services import AuthService
from app.schemas.schemas import (
    AuthResult,
    AdminInvitationResponse,
    UserRegister,
    UserLogin,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    AdminInvitationRequest,
    InvalidateAdminRequest,
)
from app.api.v1.dependencies import get_current_active_user, PermissionChecker
from app.enums.enums import Permission
from app.models.models import User
from app.exceptions.exceptions import ValidationException, AuthenticationException
from app.repositories.repositories import UserRepository
router = APIRouter()


class CompleteSignupBody(BaseModel):
    """Body schema for completing admin signup — password in body, NOT in query params."""
    token: str
    name: str
    password: str


@router.post(
    "/register",
    response_model=AuthResult,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Admin account",
    description=(
        "Creates a new administrative account in the platform and returns a session JWT token. "
        "Requires a valid BOOTSTRAP_TOKEN in the X-Bootstrap-Token header (or query param) "
        "when no admins exist yet. Once at least one admin exists, registration is disabled — "
        "use /invite-admin instead."
    ),
)
def register(
    request: Request,
    response: Response,
    user_in: UserRegister,
    db: Session = Depends(get_db),
) -> AuthResult:
    # H3 FIX: Require bootstrap token if no admins exist yet
    # This prevents open registration while allowing first-time setup
    from app.repositories.repositories import UserRepository
    user_repo = UserRepository(db)
    existing_admins = user_repo.get_all()
    active_admins = [u for u in existing_admins if u.is_active]

    if active_admins:
        # Registration is closed — use invite flow instead
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin registration is closed. Use /auth/invite-admin to invite new admins."
        )

    # No active admins exist — require bootstrap token
    bootstrap_token = request.headers.get("X-Bootstrap-Token") or request.query_params.get("bootstrap_token", "")
    if not settings.BOOTSTRAP_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server not configured for bootstrap. Set BOOTSTRAP_TOKEN in .env to allow initial admin creation."
        )
    if bootstrap_token != settings.BOOTSTRAP_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing bootstrap token. Provide X-Bootstrap-Token header."
        )

    auth_service = AuthService(db)
    # C3 FIX: Let VotingException subclasses (AuthenticationException=401, ValidationException=422)
    # propagate to the global handler instead of swallowing them as 400.
    auth_result = auth_service.register_admin(user_in)
    
    # Set refresh token in httpOnly cookie
    if auth_result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=auth_result.refresh_token,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="none",  # Required for cross-domain cookies
            domain=None,  # Allow browser to handle domain automatically
            path="/",
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60  # Convert days to seconds
        )
    
    return auth_result


@router.post(
    "/signup",
    response_model=AuthResult,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Admin account (alias for /register)",
)
def signup(
    request: Request,
    response: Response,
    user_in: UserRegister,
    db: Session = Depends(get_db),
) -> AuthResult:
    return register(request, response, user_in, db)


@router.get(
    "/signup/status",
    summary="Check if initial super admin setup is complete",
)
def signup_status(
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    from app.repositories.repositories import UserRepository
    user_repo = UserRepository(db)
    existing_admins = user_repo.get_all()
    active_admins = [u for u in existing_admins if u.is_active]
    return {
        "superAdminExists": len(active_admins) > 0,
        "has_admins": len(active_admins) > 0,
    }


@router.get(
    "/me",
    summary="Get currently authenticated user details",
)
def get_me(
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    from app.schemas.schemas import UserResponse
    user_resp = UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
    )
    return {"user": user_resp.model_dump(by_alias=True)}


@router.post(
    "/login",
    response_model=AuthResult,
    summary="Login to Admin account",
    description="Authenticates Admin email and password credentials, returning a JWT token."
)
def login(
    request: Request,
    response: Response,
    login_in: UserLogin,
    db: Session = Depends(get_db),
) -> AuthResult:
    auth_service = AuthService(db)
    client_ip = request.client.host if request.client else None
    auth_result = auth_service.login_admin(login_in, ip_address=client_ip)
    
    # Set refresh token in httpOnly cookie
    if auth_result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=auth_result.refresh_token,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="none",  # Required for cross-domain cookies
            domain=None,  # Allow browser to handle domain automatically
            path="/",
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60  # Convert days to seconds
        )
    
    return auth_result


@router.post(
    "/logout",
    summary="Logout from Admin account",
    description="Logs out the currently authenticated admin and records the audit event."
)
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    auth_service = AuthService(db)
    client_ip = request.client.host if request.client else None
    auth_service.logout_admin(current_user.id, ip_address=client_ip)
    
    # Clear refresh token cookie
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="none",  # Required for cross-domain cookies
        domain=None,  # Allow browser to handle domain automatically
        path="/"
    )
    
    return {"success": True, "message": "Successfully logged out."}


@router.post(
    "/forgot-password",
    summary="Forgot Password request",
    description="Submits a password reset request which sends an email with reset link."
)
def forgot_password(
    req: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    auth_service = AuthService(db)
    auth_service.request_password_reset(req.email)
    return {"message": "If the email is registered, a password reset link has been sent to your email."}


@router.post(
    "/reset-password",
    summary="Reset Password",
    description="Reset password using valid reset token from email."
)
def reset_password(
    reset_request: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    auth_service = AuthService(db)
    # C3 FIX: Let custom exceptions propagate with correct status codes.
    auth_service.reset_password(reset_request)
    return {"message": "Password reset successfully. You can now login with your new password."}


@router.post(
    "/invite-admin",
    response_model=AdminInvitationResponse,
    summary="Invite Admin (Super Admin only)",
    description="Create admin invitation with token and send email. Only super admins can use this endpoint."
)
def invite_admin(
    invitation_request: AdminInvitationRequest,
    current_user: User = Depends(PermissionChecker(Permission.ADMINS_MANAGE)),
    db: Session = Depends(get_db),
) -> AdminInvitationResponse:
    auth_service = AuthService(db)
    # C3 FIX: Let custom exceptions propagate with correct status codes.
    return auth_service.create_admin_invitation(invitation_request, current_user)


@router.post(
    "/complete-signup",
    response_model=AuthResult,
    summary="Complete Admin Signup",
)
def complete_signup(
    body: CompleteSignupBody,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResult:
    auth_service = AuthService(db)

    auth_result = auth_service.complete_admin_signup(
        body.token,
        body.name,
        body.password,
    )
    
    # Set refresh token in httpOnly cookie
    if auth_result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=auth_result.refresh_token,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="none",  # Required for cross-domain cookies
            domain=None,  # Allow browser to handle domain automatically
            path="/",
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60  # Convert days to seconds
        )
    
    return auth_result


@router.post(
    "/invalidate-admin",
    summary="Invalidate Admin (Super Admin only)",
    description="Invalidate (deactivate) another admin account. Only super admins can use this endpoint."
)
def invalidate_admin(
    invalidate_request: InvalidateAdminRequest,
    current_user: User = Depends(PermissionChecker(Permission.ADMINS_MANAGE)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    auth_service = AuthService(db)
    # C3 FIX: Let custom exceptions propagate with correct status codes.
    auth_service.invalidate_admin(invalidate_request, current_user)
    return {"message": "Admin account invalidated successfully."}


@router.get(
    "/google",
    summary="Google OAuth",
    description="Google OAuth is not yet implemented.",
    status_code=status.HTTP_501_NOT_IMPLEMENTED
)
def google_auth_placeholder() -> dict[str, bool | str]:
    return {
        "success": False,
        "message": "Google OAuth is not yet implemented."
    }


@router.get(
    "/invitation/{token}",
    summary="Verify invitation token"
)
def verify_invitation(
    token: str,
    db: Session = Depends(get_db),
) -> dict[str, bool | str]:
    auth_service = AuthService(db)

    try:
        invitation = auth_service.verify_invitation_token(token)

        return {
            "valid": True,
            "email": invitation.email,
            "role": invitation.role.value
            if hasattr(invitation.role, "value")
            else invitation.role,
        }
    except Exception as e:
        # Handle invalid or expired invitations
        return {
            "valid": False,
            "email": "",
            "role": ""
        }


@router.post(
    "/refresh",
    response_model=AuthResult,
    summary="Refresh access token using refresh token from cookie",
    description="Issues a new access token using a valid refresh token from httpOnly cookie."
)
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResult:
    """
    Refresh access token using refresh token from httpOnly cookie.
    Implements token rotation by issuing a new refresh token.
    """
    refresh_token_cookie = request.cookies.get("refresh_token")
    
    if not refresh_token_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found in cookies"
        )
    
    # Decode and validate refresh token
    payload = decode_refresh_token(refresh_token_cookie)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload"
        )
    
    # Get user from database
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Verify the refresh token matches the one stored in database
    if user.refresh_token != refresh_token_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token does not match stored token"
        )
    
    # Check if refresh token is expired
    from datetime import datetime, timezone
    if user.refresh_token_expires and user.refresh_token_expires < datetime.now(timezone.utc):
        # Clear the refresh token from database
        user.refresh_token = None
        user.refresh_token_expires = None
        user_repo.update()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated"
        )
    
    # Generate new access token
    access_token = create_access_token(user.id)
    
    # Token rotation: generate new refresh token
    new_refresh_token = create_refresh_token(user.id)
    
    # Update user with new refresh token
    from datetime import timedelta
    user.refresh_token = new_refresh_token
    user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    user_repo.update()
    
    # Set new refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="none",  # Required for cross-domain cookies
        domain=None,  # Allow browser to handle domain automatically
        path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60  # Convert days to seconds
    )
    
    # Return new access token and user info
    from app.schemas.schemas import UserResponse
    return AuthResult(
        token=access_token,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role
        ),
        message="Token refreshed successfully"
    )