from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.v1.dependencies import get_current_active_user
from app.models.models import User
from app.schemas.schemas import UserResponse
from app.repositories.repositories import UserRepository
from app.enums.enums import UserRole

router = APIRouter()

@router.get(
    "/list",
    response_model=List[UserResponse],
    summary="List All Admins (Super Admin only)",
    description="Get list of all admin users. Only super admins can access this endpoint."
)
def list_admins(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can list admins"
        )
    
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