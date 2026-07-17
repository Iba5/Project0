from typing import List
from fastapi import APIRouter, Depends, HTTPException, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker
from app.enums.enums import Permission
from app.services.services import PaymentService, DashboardService
from app.schemas.schemas import PaymentCreate, PaymentResponse

router = APIRouter()

allow_read_payments = Depends(PermissionChecker(Permission.PAYMENTS_READ))

@router.post(
    "/initiate",
    summary="Initiate vote payment",
    description="Registers a pending vote purchase transaction and generates a Paynow checkout link."
)
def initiate_payment(payment_in: PaymentCreate, db: Session = Depends(get_db)):
    payment_service = PaymentService(db)
    return payment_service.initiate_payment(payment_in)

@router.post(
    "/paynow/callback",
    summary="Paynow Callback listener",
    description="Public webhook for Paynow Zimbabwe to post transaction results. Performs signature verification and credits votes atomically."
)
def paynow_callback(
    reference: str = Form(...),
    status: str = Form(...),
    pollurl: str = Form(...),
    hash: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Validates webhook headers and credits vote transactions.
    """
    payment_service = PaymentService(db)
    callback_data = {
        "reference": reference,
        "status": status,
        "pollurl": pollurl,
        "hash": hash
    }
    payment_service.process_paynow_callback(callback_data)
    return {"status": "ok"}

@router.get(
    "/",
    response_model=List[PaymentResponse],
    summary="List all payment records",
    dependencies=[allow_read_payments]
)
def list_payments(db: Session = Depends(get_db)):
    payment_service = PaymentService(db)
    return payment_service.list_payments()
