import pytest
from app.services.fraud import FraudDetectionService
from app.exceptions.exceptions import FraudException
from sqlalchemy.orm import Session

@pytest.mark.anyio
async def test_verify_request_replay(db_session: Session):
    service = FraudDetectionService(db_session)
    
    # First time using this request ID should succeed
    await service.verify_request_replay("unique-request-id-1")
    
    # Second time using the same request ID should raise FraudException
    with pytest.raises(FraudException) as exc_info:
        await service.verify_request_replay("unique-request-id-1")
    assert "Replay detected" in str(exc_info.value)
    
    # A different request ID should succeed
    await service.verify_request_replay("unique-request-id-2")
