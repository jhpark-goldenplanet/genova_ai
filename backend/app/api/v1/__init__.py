"""
API v1 package initialization.
"""

from fastapi import APIRouter

from app.api.v1.video import router as video_router
from app.api.v1.monitoring import router as monitoring_router
from app.api.v1.error_management import router as error_management_router
from app.api.v1.youtube_cookies import router as youtube_cookies_router

# Create main v1 router
router = APIRouter()

# Include sub-routers
router.include_router(video_router)
router.include_router(monitoring_router)
router.include_router(error_management_router)
router.include_router(youtube_cookies_router)

__all__ = ["router"]
