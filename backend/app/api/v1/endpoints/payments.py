import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form, Query, Request, status as http_status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, PaginationParams, get_current_active_user
from app.enums.enums import Permission, ALLOWED_SOURCE_PLATFORMS
from app.services.services import PaymentService, DashboardService
from app.schemas.schemas import (
    PaymentCreate, PaymentResponse, 
    VoterCheckResponse, VoterDetailsUpdate, PaymentStatusCheckResponse
)
from app.repositories.repositories import paginate_response
from app.models.models import User

router = APIRouter()

allow_read_payments = Depends(PermissionChecker(Permission.PAYMENTS_READ))


@router.get(
    "/check-voter",
    response_model=VoterCheckResponse,
    summary="Check if voter phone has already voted",
    description="Pre-payment check: returns a warning if the phone number has already "
                "successfully voted in the current competition. Frontend should show this "
                "warning and require acknowledgement before proceeding.",
)
def check_voter(
    phone: str = Query(..., description="Voter phone number to check"),
    competition_id: Optional[str] = Query(None, description="Optional competition ID (defaults to active)"),
    db: Session = Depends(get_db)
):
    # Normalize phone to match what the PaymentCreate validator does
    cleaned_phone = phone.strip().replace(" ", "").replace("+", "")
    payment_service = PaymentService(db)
    return payment_service.check_voter_duplicate(cleaned_phone, competition_id)


@router.post(
    "/initiate",
    summary="Initiate vote payment (enhanced)",
    description=(
        "Registers a pending vote purchase and calls the Paynow SDK to generate a checkout. "
        "Requires voter_phone. Checks for duplicate voters and rate-limits by phone. "
        "Saves poll_url for dual verification. Returns redirect URL or mobile instructions. "
        "The amount is determined SERVER-SIDE from the competition/event vote_price — "
        "any client-supplied amount is IGNORED to prevent price manipulation."
    ),
)
def initiate_payment(payment_in: PaymentCreate, request: Request, db: Session = Depends(get_db)):
    # Track source_platform from URL query parameter if not in body
    src = request.query_params.get("src")
    if src and not payment_in.source_platform:
        # Validate src against whitelist
        if src.lower() in ALLOWED_SOURCE_PLATFORMS:
            payment_in.source_platform = src.lower()
        else:
            logger.warning(f"Invalid source_platform query param: {src}")

    payment_service = PaymentService(db)
    result = payment_service.initiate_payment(payment_in)
    
    # If duplicate warning, return 409 to signal frontend to show warning
    if result.get("has_voted") and result.get("warning"):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=http_status.HTTP_409_CONFLICT,
            content=result
        )
    
    return result


@router.get(
    "/check-status/{reference}",
    response_model=PaymentStatusCheckResponse,
    summary="Manually check payment status",
    description="Uses the saved poll_url to actively verify payment status with Paynow. "
                "Can be called by the frontend for real-time status updates.",
)
def check_payment_status(reference: str, db: Session = Depends(get_db)):
    payment_service = PaymentService(db)
    return payment_service.check_payment_status(reference)


@router.post(
    "/voter-details",
    summary="Update voter details after payment",
    description=(
        "After a successful payment, the voter can provide their name/email "
        "if they were paying on behalf of someone else. "
        "Requires authentication."
    ),
)
def update_voter_details(
    details_in: VoterDetailsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    payment_service = PaymentService(db)
    return payment_service.update_voter_details(details_in)


@router.post(
    "/paynow/callback",
    summary="Paynow Webhook Callback",
    description=(
        "Public webhook for Paynow Zimbabwe to post transaction results. "
        "Performs: 1) Signature verification, 2) Idempotency check, "
        "3) Dual verification via poll_url, 4) ACID vote crediting."
    ),
)
def paynow_callback(
    reference: str = Form(...),
    paynow_status: str = Form(..., alias="status"),
    pollurl: str = Form(""),
    hash_value: str = Form("", alias="hash"),
    amount: Optional[str] = Form(""),
    paynowreference: Optional[str] = Form(""),
    db: Session = Depends(get_db)
):
    """
    Validates webhook signatures and credits vote transactions.

    FIX NOTES:
    - Bug 1: Removed duplicate `default=` arg from Form() calls.
    - Bug 2: Renamed `status` param to `paynow_status` to avoid shadowing
      FastAPI's `status` module. Uses `alias="status"` so Paynow's
      `status` field is still accepted.
    - Bug 4: Now accepts ALL fields Paynow sends (amount, paynowreference)
      so the signature can be correctly verified over the complete payload.
    """
    if not reference or not reference.strip():
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Missing required 'reference' field in callback."
        )
    if not paynow_status or not paynow_status.strip():
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Missing required 'status' field in callback."
        )

    payment_service = PaymentService(db)
    # Bug 4 FIX: Include ALL fields from Paynow's webhook payload.
    # Paynow signs over every field (sorted alphabetically, excluding 'hash').
    # If we omit fields here, our computed hash will never match theirs.
    callback_data = {
        "reference": reference.strip(),
        "status": paynow_status.strip(),
        "pollurl": pollurl.strip() if pollurl else "",
        "amount": amount.strip() if amount else "",
        "paynowreference": paynowreference.strip() if paynowreference else "",
        "hash": hash_value.strip() if hash_value else "",
    }
    payment_service.process_paynow_callback(callback_data)
    return {"status": "ok"}


@router.get(
    "/",
    summary="List all payment records (paginated)",
    description="Returns paginated payment history. Voter phone numbers and emails are NOT exposed.",
    dependencies=[allow_read_payments]
)
def list_payments(pagination: PaginationParams = Depends(), db: Session = Depends(get_db)):
    payment_service = PaymentService(db)
    items, total = payment_service.list_payments(pagination.offset, pagination.limit)
    return paginate_response(items, total, pagination.page, pagination.page_size)