"""
FastAPI dependencies for dependency injection.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.redis import redis_manager
from app.services.video_status_service import VideoStatusService


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency to get database session."""
    async for session in db_manager.get_session():
        yield session


async def get_video_status_service() -> VideoStatusService:
    """FastAPI dependency to get video status service."""
    if not redis_manager.is_initialized:
        raise RuntimeError("Redis manager not initialized")

    return VideoStatusService()


async def get_redis_client():
    """FastAPI dependency to get Redis client."""
    if not redis_manager.client:
        raise RuntimeError("Redis client not initialized")
    return redis_manager.client
