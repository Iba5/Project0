import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, get_current_active_user
from app.enums.enums import Permission
from app.services.services import PaymentMethodConfigService
from app.schemas.schemas import (
    PaymentMethodConfigCreate, PaymentMethodConfigUpdate, PaymentMethodConfigResponse
)
from app.models.models import User

router = APIRouter()

@router.get(
    "/",
    response_model=List[PaymentMethodConfigResponse],
    summary="List all payment methods",
    description="Returns all payment method configurations (admin only)."
)
def list_payment_methods(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    payment_method_service = PaymentMethodConfigService(db, user_id=current_user.id)
    return payment_method_service.list_payment_methods()


@router.get(
    "/public",
    response_model=List[PaymentMethodConfigResponse],
    summary="List enabled payment methods",
    description="Returns only enabled payment methods for public display."
)
def list_enabled_payment_methods(
    db: Session = Depends(get_db)
):
    payment_method_service = PaymentMethodConfigService(db)
    return payment_method_service.list_enabled_payment_methods()


@router.get(
    "/{method_id}",
    response_model=PaymentMethodConfigResponse,
    summary="Get payment method by ID",
    description="Returns a specific payment method configuration."
)
def get_payment_method(
    method_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    payment_method_service = PaymentMethodConfigService(db, user_id=current_user.id)
    method = payment_method_service.get_payment_method(method_id)
    if not method:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Payment method not found"
        )
    return method


@router.post(
    "/",
    response_model=PaymentMethodConfigResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create payment method",
    description="Create a new payment method configuration."
)
def create_payment_method(
    method_in: PaymentMethodConfigCreate,
    current_user: User = Depends(PermissionChecker(Permission.SETTINGS_UPDATE)),
    db: Session = Depends(get_db)
):
    payment_method_service = PaymentMethodConfigService(db, user_id=current_user.id)
    return payment_method_service.create_payment_method(method_in)


@router.put(
    "/{method_id}",
    response_model=PaymentMethodConfigResponse,
    summary="Update payment method",
    description="Update an existing payment method configuration."
)
def update_payment_method(
    method_id: str,
    method_in: PaymentMethodConfigUpdate,
    current_user: User = Depends(PermissionChecker(Permission.SETTINGS_UPDATE)),
    db: Session = Depends(get_db)
):
    payment_method_service = PaymentMethodConfigService(db, user_id=current_user.id)
    return payment_method_service.update_payment_method(method_id, method_in)


@router.delete(
    "/{method_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete payment method",
    description="Delete a payment method configuration."
)
def delete_payment_method(
    method_id: str,
    current_user: User = Depends(PermissionChecker(Permission.SETTINGS_UPDATE)),
    db: Session = Depends(get_db)
):
    payment_method_service = PaymentMethodConfigService(db, user_id=current_user.id)
    payment_method_service.delete_payment_method(method_id)
    return None


@router.patch(
    "/{method_id}/toggle",
    response_model=PaymentMethodConfigResponse,
    summary="Toggle payment method",
    description="Quick toggle to enable/disable a payment method."
)
def toggle_payment_method(
    method_id: str,
    enabled: bool = True,
    current_user: User = Depends(PermissionChecker(Permission.SETTINGS_UPDATE)),
    db: Session = Depends(get_db)
):
    payment_method_service = PaymentMethodConfigService(db, user_id=current_user.id)
    return payment_method_service.toggle_payment_method(method_id, enabled)
