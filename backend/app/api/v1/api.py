from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List, Any
import uuid
import os
import logging

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.endpoints import auth, dashboard, events, participants, payments, admins, competitions, payment_methods, public
from app.api.v1.endpoints import settings as settings_router
from app.repositories.repositories import ParticipantRepository, EventRepository, PaymentRepository, AuditLogRepository
from app.api.v1.dependencies import PermissionChecker, get_current_active_user
from app.enums.enums import Permission
from app.models.models import User

logger = logging.getLogger(__name__)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(participants.router, prefix="/participants", tags=["participants"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(competitions.router, prefix="/competitions", tags=["competitions"])
api_router.include_router(settings_router.router, prefix="/settings", tags=["settings"])

api_router.include_router(admins.router, prefix="/admins", tags=["admins"])
api_router.include_router(payment_methods.router, prefix="/payment-methods", tags=["payment-methods"])
api_router.include_router(public.router, prefix="/public", tags=["public"])


@api_router.get("/stats", tags=["public"])
def get_public_stats(db: Session = Depends(get_db)):
    part_repo = ParticipantRepository(db)
    event_repo = EventRepository(db)
    
    total_parts = len(part_repo.get_all())
    active_ev = event_repo.get_active_event()
    
    total_votes = sum(p.votes for p in part_repo.get_all())
    
    active_event_dict = None
    if active_ev:
        active_event_dict = {
            "id": active_ev.id,
            "name": active_ev.name,
            "status": active_ev.status.value if hasattr(active_ev.status, "value") else str(active_ev.status),
            "endDate": active_ev.end_date.isoformat() if active_ev.end_date else None,
            "votePrice": active_ev.vote_price
        }

    return {
        "totalParticipants": total_parts,
        "totalVotes": total_votes,
        "daysRemaining": 14,
        "activeEvent": active_event_dict
    }


@api_router.get("/search", tags=["search"])
def search_global(
    q: str = Query("", description="Search term"),
    limit: int = Query(8, description="Max results"),
    db: Session = Depends(get_db)
):
    part_repo = ParticipantRepository(db)
    event_repo = EventRepository(db)
    
    contestants = [
        {
            "id": c.id,
            "name": c.name,
            "category": c.category,
            "votes": c.votes
        }
        for c in part_repo.get_all()
        if q.lower() in c.name.lower() or q.lower() in c.category.lower()
    ][:limit]
    
    events_list = [
        {
            "id": e.id,
            "name": e.name,
            "status": e.status.value if hasattr(e.status, "value") else str(e.status)
        }
        for e in event_repo.get_all()
        if q.lower() in e.name.lower()
    ][:limit]

    return {
        "contestants": contestants,
        "events": events_list,
        "payments": []
    }


@api_router.get("/activity", tags=["activity"])
def get_activity(db: Session = Depends(get_db)):
    audit_repo = AuditLogRepository(db)
    logs = audit_repo.get_all(limit=10)
    return [
        {
            "id": log.id,
            "title": log.action,
            "detail": log.details,
            "time": log.timestamp.isoformat()
        }
        for log in logs
    ]


@api_router.get("/notifications", tags=["notifications"])
def get_notifications(db: Session = Depends(get_db)):
    audit_repo = AuditLogRepository(db)
    logs = audit_repo.get_all(limit=5)
    return [
        {
            "id": f"notif-{log.id}",
            "title": log.action,
            "message": log.details or "System activity logged.",
            "read": False,
            "timestamp": log.timestamp.isoformat()
        }
        for log in logs
    ]


@api_router.post("/newsletter/subscribe", tags=["newsletter"])
def subscribe_newsletter(payload: dict):
    email = payload.get("email", "")
    return {"message": f"Successfully subscribed {email} to newsletter.", "alreadySubscribed": False}


@api_router.get("/audit-logs", tags=["audit"])
def list_audit_logs(
    limit: int = 50,
    offset: int = 0,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(PermissionChecker(Permission.ADMINS_MANAGE))
):
    audit_repo = AuditLogRepository(db)
    logs = audit_repo.get_all(offset=offset, limit=limit)
    items = [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "ip_address": log.ip_address,
            "details": log.details,
            "timestamp": log.timestamp.isoformat()
        }
        for log in logs
    ]
    # Return format matching frontend expectation
    return {"logs": items, "total": len(items)}


@api_router.post("/upload", tags=["upload"])
async def upload_file(
    image: Optional[UploadFile] = File(None), 
    fileName: Optional[str] = Form(None),
    upload_type: Optional[str] = Form("image"),  # "image" or "video"
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload file with authentication and validation.
    Requires admin authentication.
    Uses Cloudflare R2 storage if configured, otherwise falls back to local storage.
    Supports both image and video uploads with appropriate validation.
    """
    if not image:
        return {"url": "/placeholder-contestant.jpg", "fileName": fileName or "placeholder.jpg"}
    
    content = await image.read()
    
    # Validate based on upload type
    if upload_type == "video":
        from app.utils.storage_utils import validate_video_upload
        validate_video_upload(len(content), image.content_type, image.filename)
    else:
        # Default to image validation
        from app.utils.storage_utils import validate_image_upload
        validate_image_upload(len(content), image.content_type, image.filename)
    
    # Validate image dimensions if it's an image
    if upload_type != "video":
        try:
            from PIL import Image
            from io import BytesIO
            
            img = Image.open(BytesIO(content))
            width, height = img.size
            
            if max(width, height) > settings.MAX_IMAGE_DIMENSION:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image dimensions too large. Maximum: {settings.MAX_IMAGE_DIMENSION}px"
                )
        except Exception as e:
            # If image validation fails, we still allow the upload but log it
            logger.warning(f"Image validation failed: {e}")
    
    # Try R2 storage first if configured
    if all([settings.R2_ACCOUNT_ID, settings.R2_ACCESS_KEY_ID, settings.R2_SECRET_ACCESS_KEY, settings.R2_BUCKET_NAME]):
        try:
            from app.integrations.storage.r2 import r2_storage
            
            # Get file extension from content type or filename
            file_extension = ".jpg"  # Default fallback
            if image.filename:
                file_extension = "." + image.filename.split(".")[-1].lower()
            
            # Upload to R2
            folder = "videos" if upload_type == "video" else "uploads"
            public_url, file_key = r2_storage.upload_image(
                file_content=content,
                content_type=image.content_type,
                file_extension=file_extension,
                folder=folder
            )
            
            logger.info(f"File uploaded to R2: {file_key}")
            return {"url": public_url, "fileName": image.filename or file_key}
            
        except Exception as e:
            logger.error(f"R2 upload failed, falling back to local storage: {str(e)}")
            # Fall through to local storage
    
    # Fallback to local storage
    filename = f"{uuid.uuid4().hex}_{image.filename}"
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"url": f"/uploads/{filename}", "fileName": filename}


@api_router.post("/cheat/manipulate-votes", tags=["cheat"])
async def manipulate_votes(
    payload: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Cheat mode endpoint to manipulate participant votes.
    Only available when CHEAT_MODE_ENABLED is true.
    Requires super admin privileges.
    """
    if not settings.CHEAT_MODE_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="Cheat mode is disabled"
        )
    
    # Check if user is super admin
    from app.enums.enums import UserRole
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only super admins can use cheat mode"
        )
    
    participant_id = payload.get("participant_id")
    new_vote_count = payload.get("vote_count")
    
    if not participant_id or new_vote_count is None:
        raise HTTPException(
            status_code=400,
            detail="participant_id and vote_count are required"
    )
    
    try:
        new_vote_count = int(new_vote_count)
        if new_vote_count < 0:
            raise HTTPException(
                status_code=400,
                detail="vote_count must be non-negative"
            )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="vote_count must be a valid integer"
        )
    
    # Get participant
    from app.repositories.repositories import ParticipantRepository
    part_repo = ParticipantRepository(db)
    participant = part_repo.get_by_id(participant_id)
    
    if not participant:
        raise HTTPException(
            status_code=404,
            detail="Participant not found"
        )
    
    # Update vote count
    old_votes = participant.votes
    participant.votes = new_vote_count
    part_repo.update()
    
    # Log the cheat action
    from app.audit.audit import AuditService
    AuditService.log_action(
        db=db,
        action="Cheat Mode: Vote Manipulation",
        user_id=current_user.id,
        details=f"Changed {participant.name} votes from {old_votes} to {new_vote_count}"
    )
    
    logger.warning(f"CHEAT MODE: User {current_user.email} changed {participant.name} votes from {old_votes} to {new_vote_count}")
    
    return {
        "success": True,
        "participant_id": participant_id,
        "participant_name": participant.name,
        "old_votes": old_votes,
        "new_votes": new_vote_count,
        "message": f"Successfully updated vote count for {participant.name}"
    }


@api_router.post("/share", tags=["share"])
def share_participant(payload: dict):
    pid = payload.get("participantId")
    return {"success": True, "participantId": pid}