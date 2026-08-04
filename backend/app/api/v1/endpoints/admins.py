from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker
from app.enums.enums import Permission
from app.models.models import User
from app.schemas.schemas import UserResponse
from app.repositories.repositories import UserRepository

router = APIRouter()

allow_manage_admins = Depends(PermissionChecker(Permission.ADMINS_MANAGE))

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
    description="Get list of all admin users. Requires admins.manage permission.",
    dependencies=[allow_manage_admins]
)
def list_admins(db: Session = Depends(get_db)):
    return fetch_and_format_admins(db)


@router.get(
    "/list",
    summary="List All Admins (alias)",
    description="Get list of all admin users.",
    dependencies=[allow_manage_admins]
)
def list_admins_alias(db: Session = Depends(get_db)):
    return fetch_and_format_admins(db)


@router.post(
    "",
    summary="Invite a new admin",
    dependencies=[allow_manage_admins]
)
def invite_admin(
    payload: dict,
    db: Session = Depends(get_db)
):
    return process_admin_invitation(payload, db)


@router.post(
    "/",
    summary="Invite a new admin (alias)",
    dependencies=[allow_manage_admins]
)
def invite_admin_alias(
    payload: dict,
    db: Session = Depends(get_db)
):
    return process_admin_invitation(payload, db)


# Helper logic for invitation to avoid code duplication
def process_admin_invitation(payload: dict, db: Session):
    from app.services.services import AuthService
    from app.schemas.schemas import AdminInvitationRequest
    from app.enums.enums import UserRole
    
    auth_service = AuthService(db)
    role_val = UserRole(payload.get("role", "admin"))
    req = AdminInvitationRequest(email=payload["email"], role=role_val)
    inv = auth_service.create_admin_invitation(req, current_user=None)
    
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