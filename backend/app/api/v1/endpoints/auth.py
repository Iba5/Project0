from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.database import get_db
from app.services.services import AuthService
from app.schemas.schemas import (
    UserRegister, UserLogin, AuthResult, ForgotPasswordRequest, 
    ResetPasswordRequest, AdminInvitationRequest, AdminInvitationResponse, 
    InvalidateAdminRequest
)
from app.api.v1.dependencies import get_current_active_user, PermissionChecker
from app.enums.enums import Permission
from app.models.models import User
from app.exceptions.exceptions import ValidationException, AuthenticationException

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
    user_in: UserRegister,
    db: Session = Depends(get_db)
):
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
    return auth_service.register_admin(user_in)


@router.post(
    "/login",
    response_model=AuthResult,
    summary="Login to Admin account",
    description="Authenticates Admin email and password credentials, returning a JWT token."
)
def login(request: Request, login_in: UserLogin, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    client_ip = request.client.host if request.client else None
    return auth_service.login_admin(login_in, ip_address=client_ip)


@router.post(
    "/logout",
    summary="Logout from Admin account",
    description="Logs out the currently authenticated admin and records the audit event."
)
def logout(request: Request, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    client_ip = request.client.host if request.client else None
    auth_service.logout_admin(current_user.id, ip_address=client_ip)
    return {"success": True, "message": "Successfully logged out."}


@router.post(
    "/forgot-password",
    summary="Forgot Password request",
    description="Submits a password reset request which sends an email with reset link."
)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    auth_service.request_password_reset(req.email)
    return {"message": "If the email is registered, a password reset link has been sent to your email."}


@router.post(
    "/reset-password",
    summary="Reset Password",
    description="Reset password using valid reset token from email."
)
def reset_password(reset_request: ResetPasswordRequest, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
):
    auth_service = AuthService(db)
    # C3 FIX: Let custom exceptions propagate with correct status codes.
    return auth_service.create_admin_invitation(invitation_request, current_user)


@router.post(
    "/complete-signup",
    response_model=AuthResult,
    summary="Complete Admin Signup",
    description="Complete admin signup using invitation token. Accepts token, name, and password in the request BODY (not query params)."
)
def complete_signup(
    body: CompleteSignupBody,
    db: Session = Depends(get_db)
):
    # H4 FIX: Password is now in the request body, not in query parameters.
    # Query parameters are logged in access logs, browser history, proxy logs, and CDN logs.
    auth_service = AuthService(db)
    # C3 FIX: Let custom exceptions propagate with correct status codes.
    return auth_service.complete_admin_signup(body.token, body.name, body.password)


@router.post(
    "/invalidate-admin",
    summary="Invalidate Admin (Super Admin only)",
    description="Invalidate (deactivate) another admin account. Only super admins can use this endpoint."
)
def invalidate_admin(
    invalidate_request: InvalidateAdminRequest,
    current_user: User = Depends(PermissionChecker(Permission.ADMINS_MANAGE)),
    db: Session = Depends(get_db)
):
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
def google_auth_placeholder():
    return {
        "success": False,
        "message": "Google OAuth is not yet implemented."
    }