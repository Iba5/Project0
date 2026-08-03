import logging
from datetime import datetime
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
from app.models.models import User, TestPayment

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
    # Read optional Idempotency-Key header from the client to persist and detect retries
    idempotency_key = request.headers.get("Idempotency-Key") or request.headers.get("Idempotency-Key".lower())
    result = payment_service.initiate_payment(payment_in, idempotency_key=idempotency_key)
    
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


# =============================================================================
# TEST PAYMENT ENDPOINTS (Development Only)
# =============================================================================

@router.post(
    "/test/{reference}/complete",
    summary="Complete a test payment (development only)",
    description="Simulates payment completion for test payments. Only works when TEST_PAYMENT_MODE=true."
)
def complete_test_payment(
    reference: str,
    db: Session = Depends(get_db)
):
    """
    Simulates payment completion for test payments in development mode.
    This endpoint creates a real Payment record and VoteTransaction to test the full payment flow.
    """
    from app.core.config import settings
    from app.repositories.repositories import TestPaymentRepository, ParticipantRepository, VoteTransactionRepository
    from app.enums.enums import PaymentStatus
    from app.models.models import Payment, VoteTransaction
    from app.audit.audit import AuditService
    
    if not settings.TEST_PAYMENT_MODE:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Test payment completion is only available in TEST_PAYMENT_MODE"
        )
    
    # Find the test payment
    test_payment_repo = TestPaymentRepository(db)
    test_payment = test_payment_repo.get_by_reference(reference)
    
    if not test_payment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Test payment with reference {reference} not found"
        )
    
    if test_payment.status != "created":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Test payment already has status: {test_payment.status}"
        )
    
    # Validate contestant exists
    part_repo = ParticipantRepository(db)
    contestant = part_repo.get_by_id(test_payment.contestant_id)
    if not contestant:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Contestant not found"
        )
    
    # Create real payment record
    real_payment = Payment(
        reference=test_payment.reference,
        contestant_id=test_payment.contestant_id,
        amount=test_payment.amount,
        payment_method=test_payment.payment_method,
        status=PaymentStatus.PAID,
        voter_phone=test_payment.voter_phone,
        voter_email=test_payment.voter_email,
        source_platform=test_payment.source_platform,
        competition_id=test_payment.competition_id,
        poll_url="test_mode",
        paynow_redirect_url=test_payment.test_redirect_url
    )
    db.add(real_payment)
    db.flush()
    
    # Create vote transaction
    vote_transaction = VoteTransaction(
        payment_id=real_payment.id,
        contestant_id=test_payment.contestant_id,
        votes_awarded=1,  # Default 1 vote per payment
        competition_id=test_payment.competition_id
    )
    db.add(vote_transaction)
    
    # Increment contestant votes
    contestant.votes += 1
    
    # Update test payment status
    test_payment.status = "completed"
    test_payment.updated_at = datetime.now()
    
    db.commit()
    
    # Log the test payment completion
    AuditService.log_action(
        db=db,
        action="Test Payment Completed",
        details=f"Test payment {reference} completed for contestant {contestant.name} (${test_payment.amount})"
    )
    
    logger.info(f"Test payment {reference} completed successfully for contestant {contestant.name}")
    
    return {
        "status": "completed",
        "reference": reference,
        "contestant_name": contestant.name,
        "amount": str(test_payment.amount),
        "votes_awarded": 1,
        "test_mode": True
    }


@router.get(
    "/test/list",
    summary="List all test payments (development only)",
    description="Returns all test payments for monitoring. Only works when TEST_PAYMENT_MODE=true.",
    dependencies=[allow_read_payments]
)
def list_test_payments(
    db: Session = Depends(get_db)
):
    """
    Lists all test payments for monitoring purposes.
    Only available in test payment mode.
    """
    from app.core.config import settings
    from app.repositories.repositories import TestPaymentRepository
    
    if not settings.TEST_PAYMENT_MODE:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Test payment monitoring is only available in TEST_PAYMENT_MODE"
        )
    
    test_payment_repo = TestPaymentRepository(db)
    test_payments = test_payment_repo.get_all_test_payments()
    
    return {
        "test_payments": [
            {
                "reference": tp.reference,
                "contestant_id": tp.contestant_id,
                "amount": str(tp.amount),
                "payment_method": tp.payment_method,
                "status": tp.status,
                "voter_phone": tp.voter_phone,
                "voter_email": tp.voter_email,
                "source_platform": tp.source_platform,
                "competition_id": tp.competition_id,
                "test_redirect_url": tp.test_redirect_url,
                "created_at": tp.created_at.isoformat() if tp.created_at else None,
                "updated_at": tp.updated_at.isoformat() if tp.updated_at else None,
                "auto_complete": tp.auto_complete,
                "test_completion_delay": tp.test_completion_delay
            }
            for tp in test_payments
        ],
        "total": len(test_payments)
    }


@router.delete(
    "/test/cleanup",
    summary="Delete all test payments (development only)",
    description="Deletes all test payments from the database. Only works when TEST_PAYMENT_MODE=true.",
    dependencies=[allow_read_payments]
)
def cleanup_test_payments(
    db: Session = Depends(get_db)
):
    """
    Deletes all test payments from the database.
    Only available in test payment mode for cleanup.
    """
    from app.core.config import settings
    from app.repositories.repositories import TestPaymentRepository
    from app.audit.audit import AuditService
    
    if not settings.TEST_PAYMENT_MODE:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Test payment cleanup is only available in TEST_PAYMENT_MODE"
        )
    
    test_payment_repo = TestPaymentRepository(db)
    test_payments = test_payment_repo.get_all_test_payments()
    
    deleted_count = 0
    for tp in test_payments:
        test_payment_repo.delete(tp)
        deleted_count += 1
    
    # Log the cleanup
    AuditService.log_action(
        db=db,
        action="Test Payments Cleanup",
        details=f"Deleted {deleted_count} test payments"
    )
    
    logger.info(f"Cleaned up {deleted_count} test payments")
    
    return {
        "status": "completed",
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} test payments"
    }