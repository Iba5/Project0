from fastapi import APIRouter
from app.api.v1.endpoints import auth, dashboard, events, participants, payments, settings, social, admins

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(participants.router, prefix="/participants", tags=["participants"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(social.router, prefix="/social-router", tags=["social-router"])
api_router.include_router(admins.router, prefix="/admins", tags=["admins"])
