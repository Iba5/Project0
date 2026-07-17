from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.services import AuthService
from app.schemas.schemas import UserRegister, UserLogin, AuthResult, ForgotPasswordRequest
from app.api.v1.dependencies import get_current_active_user
from app.models.models import User

router = APIRouter()

@router.post(
    "/register",
    response_model=AuthResult,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Admin account",
    description="Creates a new administrative account in the platform and returns a session JWT token."
)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    try:
        return auth_service.register_admin(user_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

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
    description="Submits a password reset request which logs the audit action."
)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    auth_service.request_password_reset(req.email)
    return {"message": "If the email is registered, a password reset link has been dispatched."}

@router.get(
    "/google",
    summary="Google OAuth placeholder",
    description="Returns a redirect URL for initiating the Google OAuth flow."
)
def google_auth_placeholder():
    return {
        "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=placeholder&redirect_uri=placeholder&response_type=code&scope=email%20profile"
    }
