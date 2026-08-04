"""
Storage protection utilities for file uploads and video handling.
"""

from typing import Optional
from fastapi import HTTPException
from app.core.config import settings


def validate_video_upload(
    file_size: int,
    content_type: str,
    filename: Optional[str] = None
) -> None:
    """
    Validate video upload before processing.
    
    Args:
        file_size: Size of the file in bytes
        content_type: MIME type of the file
        filename: Original filename (optional)
    
    Raises:
        HTTPException: If validation fails
    """
    # Check file size
    if file_size > settings.MAX_VIDEO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Video file too large. Maximum size: {settings.MAX_VIDEO_SIZE / (1024*1024):.1f}MB"
        )
    
    # Check file type
    file_extension = None
    if filename:
        file_extension = filename.split(".")[-1].lower()
    
    # Validate against content type and extension
    valid = False
    if content_type:
        content_type = content_type.lower()
        if "video" in content_type:
            valid = True
    
    if file_extension and file_extension in settings.ALLOWED_VIDEO_FORMATS:
        valid = True
    
    if not valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid video format. Allowed formats: {', '.join(settings.ALLOWED_VIDEO_FORMATS)}"
        )


def validate_image_upload(
    file_size: int,
    content_type: str,
    filename: Optional[str] = None
) -> None:
    """
    Validate image upload before processing.
    
    Args:
        file_size: Size of the file in bytes
        content_type: MIME type of the file
        filename: Original filename (optional)
    
    Raises:
        HTTPException: If validation fails
    """
    # Check file size
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Image file too large. Maximum size: {settings.MAX_UPLOAD_SIZE / (1024*1024):.1f}MB"
        )
    
    # Check file type
    file_extension = None
    if filename:
        file_extension = filename.split(".")[-1].lower()
    
    # Validate against content type and extension
    valid = False
    if content_type:
        content_type = content_type.lower()
        if "image" in content_type:
            valid = True
    
    if file_extension and file_extension in [t.split('/')[1] for t in settings.ALLOWED_IMAGE_TYPES]:
        valid = True
    
    if not valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image format. Allowed formats: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
        )


def is_video_enabled_for_event(event_enable_videos: bool) -> bool:
    """
    Check if videos are enabled for a specific event.
    
    Args:
        event_enable_videos: Event's enable_videos setting
    
    Returns:
        bool: True if videos are enabled for this event
    """
    return event_enable_videos


def check_video_availability(
    event_enable_videos: bool,
    participant_has_video: bool
) -> str:
    """
    Determine the video availability message for a participant.
    
    Cases:
    - Event supports videos + Participant has video → Show "Watch Video"
    - Event supports videos + Participant has no video → Show "No promotional video has been uploaded"
    - Event does not support videos → Hide video components
    
    Args:
        event_enable_videos: Event's enable_videos setting
        participant_has_video: Whether participant has uploaded a video
    
    Returns:
        str: Video availability status or None if videos are disabled
    """
    if not event_enable_videos:
        return None  # Hide video components
    
    if participant_has_video:
        return "available"  # Show "Watch Video"
    
    return "not_uploaded"  # Show "No promotional video has been uploaded"
