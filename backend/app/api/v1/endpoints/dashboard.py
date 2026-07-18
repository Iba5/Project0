from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.dependencies import PermissionChecker
from app.enums.enums import Permission
from app.services.services import DashboardService
from app.schemas.schemas import DashboardSummaryResponse

router = APIRouter()

# Enforce authorization: Valid JWT and Contestants Read permission
allow_voter_view = Depends(PermissionChecker(Permission.CONTESTANTS_READ))

@router.get(
    "/",
    response_model=DashboardSummaryResponse,
    summary="Get Dashboard statistics summary",
    description="Calculates active event status, total contestant counts, votes, successful payments, and lists audit logs.",
    dependencies=[allow_voter_view]
)
def get_dashboard_summary(db: Session = Depends(get_db)):
    dashboard_service = DashboardService(db)
    return dashboard_service.get_summary()
