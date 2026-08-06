import logging
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form, Query, Request, status as http_status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker, PaginationParams, get_current_active_user
from app.enums.enums import Permission
from app.services.services import PaymentService, DashboardService
from app.exceptions.exceptions import VotingException, NotFoundException
from app.schemas.schemas import (
    PaymentCreate, PaymentEnvelopeResponse, PaymentInitiationResponse, PaymentResponse, PaymentSummaryResponse,
    VoterCheckResponse, VoterDetailsUpdate, PaymentStatusCheckResponse,
    CallbackAckResponse, PaymentListResponse,
)
from app.repositories.repositories import paginate_response
from app.models.models import User

router = APIRouter()

allow_read_payments = Depends(PermissionChecker(Permission.PAYMENTS_READ))


def format_payment_initiation_response(
    result: PaymentInitiationResponse,
    ) -> PaymentEnvelopeResponse:
        return PaymentEnvelopeResponse(
            payment=PaymentSummaryResponse(
                id=result.id or result.reference,
                reference=result.reference,
                contestant_id=result.contestant_id,
                amount=result.amount,
                payment_method=result.payment_method,
                status=result.status,
                voter_name=result.voter_name,
                voter_email=result.voter_email,
                date=result.date,
                created_at=result.created_at,
                poll_url=result.poll_url,
                paynowRedirectUrl=result.redirect_url,
                instructions=result.instructions,
                test_mode=result.test_mode,
            ),
        idempotent=result.idempotent,
    )


@router.get(
    "/check-voter",
    response_model=VoterCheckResponse,
    summary="Check if voter phone has already voted",
    description="Pre-payment check: returns a warning if the phone number has already "
                "successfully voted in the current event. Frontend should show this "
                "warning and require acknowledgement before proceeding.",
)
def check_voter(
    phone: str = Query(..., description="Voter phone number to check"),
    event_id: Optional[str] = Query(None, description="Optional event ID (defaults to active)"),
    db: Session = Depends(get_db)
):
    # Normalize phone to match what the PaymentCreate validator does
    cleaned_phone = phone.strip().replace(" ", "").replace("+", "")
    payment_service = PaymentService(db)
    return payment_service.check_voter_duplicate(cleaned_phone, event_id)


@router.post(
    "",
    summary="Initiate vote payment",
)
@router.post(
    "/",
    summary="Initiate vote payment (alias)",
)
@router.post(
    "/initiate",
    summary="Initiate vote payment (enhanced)",
    description=(
        "Registers a pending vote purchase and calls the Paynow SDK to generate a checkout. "
        "Requires voter_phone. Checks for duplicate voters and rate-limits by phone. "
        "Saves poll_url for dual verification. Returns redirect URL or mobile instructions. "
        "The amount is determined SERVER-SIDE from the event vote_price — "
        "any client-supplied amount is IGNORED to prevent price manipulation."
    ),
    response_model=PaymentEnvelopeResponse
)
def initiate_payment(payment_in: PaymentCreate, request: Request, db: Session = Depends(get_db)):
    payment_service = PaymentService(db)
    # Read optional Idempotency-Key header from the client to persist and detect retries
    idempotency_key = request.headers.get("Idempotency-Key") or request.headers.get("Idempotency-Key".lower())
    result = payment_service.initiate_payment(payment_in, idempotency_key=idempotency_key)
    
    # If duplicate warning, return 409 to signal frontend to show warning
    if result.has_voted and result.warning:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=http_status.HTTP_409_CONFLICT,
            content=result.model_dump(by_alias=True),
        )
    return format_payment_initiation_response(result)


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
    response_model=CallbackAckResponse,
    summary="Paynow Webhook Callback",
    description=(
        "Public webhook for Paynow Zimbabwe to post transaction results. "
        "Performs: 1) Signature verification, 2) Idempotency check, "
        "3) Dual verification via poll_url, 4) ACID vote crediting."
    ),
)
async def paynow_callback(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Validates webhook signatures and credits vote transactions.
    
    IMPORTANT: Receives ALL fields from Paynow callback as form data.
    According to Paynow docs, all fields must be included in hash verification,
    except the 'hash' field itself.
    """
    payment_service = PaymentService(db)
    
    # Parse form data from request
    form_data = await request.form()
    
    # Convert to dictionary, including ALL fields Paynow sends
    # This ensures hash verification includes all fields
    callback_data = {key: value for key, value in form_data.items()}
    
    # Log received fields for debugging
    logger.info(f"Paynow callback received for reference: {callback_data.get('reference')}")
    logger.debug(f"Callback fields: {list(callback_data.keys())}")
    
    if not callback_data.get("reference"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Missing required 'reference' field in callback."
        )
    
    if not callback_data.get("status"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Missing required 'status' field in callback."
        )
    
    # Fix: Wrap in try/except to prevent Paynow retry loops on exceptions
    # Paynow retries on HTTP error status codes (up to 10 times)
    # We always return 200 to acknowledge receipt, even if processing fails
    try:
        payment_service.process_paynow_callback(callback_data)
    except (VotingException, NotFoundException) as e:
        # Log the error but return 200 to prevent Paynow retries
        logger.error(f"Callback processing error (domain exception): {str(e)}")
        # Still return 200 - we've logged the error and can investigate
        # The payment can be manually verified via poll_url
    except Exception as e:
        # Log unexpected errors but return 200 to prevent Paynow retries
        logger.error(f"Callback processing error (unexpected): {str(e)}", exc_info=True)
        # Still return 200 - we've logged the error and can investigate
    
    return CallbackAckResponse(status="ok")


@router.get(
    "/",
    response_model=PaymentListResponse,
    summary="List all payment records (paginated)",
    description="Returns paginated payment history. Voter phone numbers and emails are NOT exposed.",
    dependencies=[allow_read_payments]
)
def list_payments(pagination: PaginationParams = Depends(), db: Session = Depends(get_db)):
    payment_service = PaymentService(db)
    items, total = payment_service.list_payments(pagination.offset, pagination.limit)
    res = paginate_response(items, total, pagination.page, pagination.page_size)
    # Add payments key for backward compatibility with the frontend
    res["payments"] = res["items"]
    return res



