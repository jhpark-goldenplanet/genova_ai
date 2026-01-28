"""
Repository for GCS-related database operations.
"""

import uuid
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video


class GCSRepository:
    """Repository for GCS-related database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def update_video_gcs_path(
        self, 
        video_id: uuid.UUID, 
        gcs_path: str,
        file_metadata: Optional[dict] = None
    ) -> Video:
        """
        Update video record with GCS path and metadata.

        Args:
            video_id: Video UUID
            gcs_path: GCS storage path
            file_metadata: Optional file metadata dictionary

        Returns:
            Updated Video model

        Raises:
            ValueError: If video not found
        """
        # Update video record
        stmt = (
            update(Video)
            .where(Video.id == video_id)
            .values(gcs_path=gcs_path)
            .returning(Video)
        )
        
        # Add metadata to analysis_result if provided
        if file_metadata:
            # Get current video to preserve existing analysis_result
            current_video = await self.get_video_by_id(video_id)
            if current_video:
                existing_analysis = current_video.analysis_result or {}
                existing_analysis["gcs_metadata"] = file_metadata
                stmt = stmt.values(analysis_result=existing_analysis)
        
        result = await self.session.execute(stmt)
        updated_video = result.scalar_one_or_none()
        
        if not updated_video:
            raise ValueError(f"Video with ID {video_id} not found")
        
        await self.session.commit()
        return updated_video

    async def get_video_by_id(self, video_id: uuid.UUID) -> Optional[Video]:
        """
        Get video by ID.

        Args:
            video_id: Video UUID

        Returns:
            Video model or None if not found
        """
        stmt = select(Video).where(Video.id == video_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_video_gcs_path(self, video_id: uuid.UUID) -> Optional[str]:
        """
        Get GCS path for a video.

        Args:
            video_id: Video UUID

        Returns:
            GCS path string or None if not found
        """
        stmt = select(Video.gcs_path).where(Video.id == video_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_videos_by_gcs_prefix(self, gcs_prefix: str) -> list[Video]:
        """
        Get videos by GCS path prefix.

        Args:
            gcs_prefix: GCS path prefix to search

        Returns:
            List of Video models
        """
        stmt = select(Video).where(Video.gcs_path.like(f"{gcs_prefix}%"))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_video_file_metadata(
        self, 
        video_id: uuid.UUID, 
        file_size_bytes: Optional[int] = None,
        duration_seconds: Optional[int] = None,
        mime_type: Optional[str] = None
    ) -> Video:
        """
        Update video file metadata.

        Args:
            video_id: Video UUID
            file_size_bytes: File size in bytes
            duration_seconds: Video duration in seconds
            mime_type: MIME type

        Returns:
            Updated Video model

        Raises:
            ValueError: If video not found
        """
        update_values = {}
        
        if file_size_bytes is not None:
            update_values["file_size_bytes"] = file_size_bytes
        if duration_seconds is not None:
            update_values["duration_seconds"] = duration_seconds
        if mime_type is not None:
            update_values["mime_type"] = mime_type
        
        if not update_values:
            # No updates to make, just return current video
            return await self.get_video_by_id(video_id)
        
        stmt = (
            update(Video)
            .where(Video.id == video_id)
            .values(**update_values)
            .returning(Video)
        )
        
        result = await self.session.execute(stmt)
        updated_video = result.scalar_one_or_none()
        
        if not updated_video:
            raise ValueError(f"Video with ID {video_id} not found")
        
        await self.session.commit()
        return updated_video

    async def clear_video_gcs_path(self, video_id: uuid.UUID) -> Video:
        """
        Clear GCS path from video record (useful for cleanup).

        Args:
            video_id: Video UUID

        Returns:
            Updated Video model

        Raises:
            ValueError: If video not found
        """
        stmt = (
            update(Video)
            .where(Video.id == video_id)
            .values(gcs_path=None)
            .returning(Video)
        )
        
        result = await self.session.execute(stmt)
        updated_video = result.scalar_one_or_none()
        
        if not updated_video:
            raise ValueError(f"Video with ID {video_id} not found")
        
        await self.session.commit()
        return updated_video

    async def get_videos_without_gcs_path(self, limit: int = 100) -> list[Video]:
        """
        Get videos that don't have GCS path set.

        Args:
            limit: Maximum number of videos to return

        Returns:
            List of Video models
        """
        stmt = (
            select(Video)
            .where(Video.gcs_path.is_(None))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_video_storage_stats(self) -> dict:
        """
        Get storage statistics for videos.

        Returns:
            Dictionary with storage statistics
        """
        from sqlalchemy import func
        
        # Count videos with and without GCS paths
        stmt_with_gcs = select(func.count(Video.id)).where(Video.gcs_path.is_not(None))
        stmt_without_gcs = select(func.count(Video.id)).where(Video.gcs_path.is_(None))
        
        # Total file size
        stmt_total_size = select(func.sum(Video.file_size_bytes)).where(
            Video.file_size_bytes.is_not(None)
        )
        
        with_gcs_result = await self.session.execute(stmt_with_gcs)
        without_gcs_result = await self.session.execute(stmt_without_gcs)
        total_size_result = await self.session.execute(stmt_total_size)
        
        videos_with_gcs = with_gcs_result.scalar() or 0
        videos_without_gcs = without_gcs_result.scalar() or 0
        total_size_bytes = total_size_result.scalar() or 0
        
        return {
            "total_videos": videos_with_gcs + videos_without_gcs,
            "videos_with_gcs_path": videos_with_gcs,
            "videos_without_gcs_path": videos_without_gcs,
            "total_storage_bytes": total_size_bytes,
            "total_storage_mb": round(total_size_bytes / (1024 * 1024), 2),
            "total_storage_gb": round(total_size_bytes / (1024 * 1024 * 1024), 2),
        }