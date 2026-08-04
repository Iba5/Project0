from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user
from app.enums.enums import Permission
from app.models.models import User
from app.schemas.schemas import UserResponse
from app.repositories.repositories import UserRepository

router = APIRouter()

allow_manage_admins = Depends(PermissionChecker(Permission.ADMINS_MANAGE))
allow_authenticated = Depends(get_current_active_user)

# Helper logic to avoid code duplication
def fetch_and_format_admins(db: Session):
    user_repo = UserRepository(db)
    admins = user_repo.get_all_active_admins()

    admin_list = [
        UserResponse(
            id=admin.id,
            name=admin.name,
            email=admin.email,
            role=admin.role
        )
        for admin in admins
    ]
    return {"admins": [a.model_dump(by_alias=True) for a in admin_list]}


@router.get(
    "",
    summary="List All Admins",
    description="Get list of all admin users. Requires authentication."
)
def list_admins(current_user: User = allow_authenticated, db: Session = Depends(get_db)):
    return fetch_and_format_admins(db)


@router.get(
    "/list",
    summary="List All Admins (alias)",
    description="Get list of all admin users. Requires authentication."
)
def list_admins_alias(current_user: User = allow_authenticated, db: Session = Depends(get_db)):
    return fetch_and_format_admins(db)


@router.post(
    "",
    summary="Invite a new admin",
    description="Requires admins.manage permission (super admin only)",
    dependencies=[allow_manage_admins]
)
def invite_admin(
    payload: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return process_admin_invitation(payload, current_user, db)


@router.post(
    "/",
    summary="Invite a new admin (alias)",
    description="Requires admins.manage permission (super admin only)",
    dependencies=[allow_manage_admins]
)
def invite_admin_alias(
    payload: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return process_admin_invitation(payload, current_user, db)


# Helper logic for invitation to avoid code duplication
def process_admin_invitation(payload: dict, current_user: User, db: Session):
    from app.services.services import AuthService
    from app.schemas.schemas import AdminInvitationRequest
    from app.enums.enums import UserRole
    
    auth_service = AuthService(db)
    role_val = UserRole(payload.get("role", "admin"))
    req = AdminInvitationRequest(email=payload["email"], role=role_val)
    inv = auth_service.create_admin_invitation(req, current_user)
    
    return {
        "admin": {
            "id": inv.email,
            "email": inv.email,
            "name": payload.get("name", inv.email.split("@")[0]),
            "role": inv.role.value if hasattr(inv.role, "value") else str(inv.role),
            "isActive": True,
            "createdAt": inv.expires_at.isoformat()
        }
    }