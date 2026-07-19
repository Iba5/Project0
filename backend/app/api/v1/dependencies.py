from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.config import settings
from app.models.models import User
from app.repositories.repositories import UserRepository
from app.enums.enums import Permission
from app.constants.constants import ROLE_PERMISSIONS

# OAuth2PasswordBearer configuration to extract Bearer token from headers.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Dependency to validate access tokens and load user info.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if user is None:
        raise credentials_exception
        
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency ensuring the authenticated user account is active.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

class PermissionChecker:
    """
    Enforces permission-based access control checking user roles against ROLE_PERMISSIONS maps.
    """
    def __init__(self, required_permission: Permission):
        self.required_permission = required_permission

    def __call__(
        self, current_user: User = Depends(get_current_active_user)
    ) -> User:
        user_permissions = ROLE_PERMISSIONS.get(current_user.role, [])
        if self.required_permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
            )
        return current_user


# --- Pagination Dependency ---

class PaginationParams:
    """
    Reusable dependency for page/size pagination.
    Clamps page_size to [1, MAX_PAGE_SIZE] with a sensible default.
    
    Usage in endpoints:
        def list_items(pagination: PaginationParams = Depends()):
            items, total = repo.get_all(pagination.offset, pagination.limit)
            return paginate_response(items, total, pagination)
    """
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(settings.DEFAULT_PAGE_SIZE, ge=1, le=settings.MAX_PAGE_SIZE, description="Items per page"),
    ):
        self.page = page
        self.page_size = min(page_size, settings.MAX_PAGE_SIZE)

    @property
    def offset(self) -> int:
        """SQL OFFSET value."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """SQL LIMIT value."""
        return self.page_size
