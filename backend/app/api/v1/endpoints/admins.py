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

# M3 FIX: Use PermissionChecker instead of manual role check
allow_manage_admins = Depends(PermissionChecker(Permission.ADMINS_MANAGE))

@router.get(
    "/list",
    response_model=List[UserResponse],
    summary="List All Admins",
    description="Get list of all admin users. Requires admins.manage permission (Super Admin only).",
    dependencies=[allow_manage_admins]
)
def list_admins(db: Session = Depends(get_db)):
    user_repo = UserRepository(db)
    admins = user_repo.get_all_active_admins()
    
    return [
        UserResponse(
            id=admin.id,
            name=admin.name,
            email=admin.email,
            role=admin.role
        )
        for admin in admins
    ]