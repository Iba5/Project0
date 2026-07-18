from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker
from app.enums.enums import Permission, SocialPlatform, SocialSyncStatus, ALLOWED_SOURCE_PLATFORMS
from app.repositories.repositories import SocialPlatformRepository
from app.schemas.schemas import SocialPlatformResponse

router = APIRouter()

allow_read = Depends(PermissionChecker(Permission.CONTESTANTS_READ))

@router.get(
    "/",
    summary="Get social platforms sync status",
    description="Returns synchronization status for all configured social media connectors (TikTok, Facebook, Instagram, YouTube).",
    dependencies=[allow_read]
)
def get_social_status(db: Session = Depends(get_db)):
    repo = SocialPlatformRepository(db)
    platforms = repo.get_all()
    
    # H7 FIX: Return actual data only — no fabricated mock data.
    # If no platforms are configured, return an empty list (not fake data).
    return {"items": platforms if platforms else []}


@router.get(
    "/voting-link",
    summary="Generate a tracked voting link for social media",
    description=(
        "Generates a voting page URL with a ?src= query parameter to track "
        "which social media platform the voter came from. These links are "
        "designed to be shared in social media comment sections."
    ),
)
def generate_voting_link(
    src: str = Query(..., description="Source platform: tiktok, facebook, instagram, youtube"),
    contestant_id: Optional[str] = Query(None, description="Optional contestant ID to pre-select"),
):
    """
    Generates a tracked voting link.
    Example output: https://platform.com/?src=tiktok&cid=abc123
    """
    # STRICT VALIDATION of source_platform
    if src.lower() not in ALLOWED_SOURCE_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid source platform '{src}'. Allowed: {', '.join(sorted(ALLOWED_SOURCE_PLATFORMS))}"
        )
    
    # Build the frontend voting URL with tracking parameter
    from app.core.config import settings
    base_url = settings.FRONTEND_URL or "http://localhost:3000"
    
    link = f"{base_url}/?src={src.lower()}"
    if contestant_id:
        link += f"&cid={contestant_id}"
    
    return {
        "votingLink": link,
        "sourcePlatform": src.lower(),
        "contestantId": contestant_id,
        "message": f"Share this link in {src.capitalize()} comment sections to track traffic."
    }


@router.get(
    "/traffic",
    summary="Get traffic analytics by source platform",
    description="Returns aggregated traffic/vote counts by source_platform.",
    dependencies=[allow_read]
)
def get_traffic_analytics(db: Session = Depends(get_db)):
    """
    Returns analytics on how many votes came from each social media platform.
    """
    from app.models.models import Payment
    from app.enums.enums import PaymentStatus
    from sqlalchemy import func
    
    results = db.query(
        Payment.source_platform,
        func.count(Payment.id).label("total_payments"),
        func.sum(Payment.amount).label("total_amount"),
    ).filter(
        Payment.status == PaymentStatus.PAID,
        Payment.source_platform.isnot(None),
    ).group_by(Payment.source_platform).all()
    
    return {
        "analytics": [
            {
                "sourcePlatform": row.source_platform,
                "totalPayments": row.total_payments,
                "totalAmount": float(row.total_amount) if row.total_amount else 0.0,
            }
            for row in results
        ]
    }