"""
Video repository for database operations.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import DatabaseException
from app.models.video import Segment, Video


class VideoRepository:
    """Repository for video database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        video_data: Dict[str, Any],
        duration_seconds: Optional[int] = None,
        file_size_bytes: Optional[int] = None,
        source_url: Optional[str] = None,
    ) -> Video:
        """
        Create a new video record.

        Args:
            video_data: Video data dictionary
            duration_seconds: Video duration in seconds
            file_size_bytes: File size in bytes
            source_url: Source URL for URL uploads

        Returns:
            Created video instance

        Raises:
            DatabaseException: If creation fails
        """
        try:
            video = Video(
                **video_data,
                duration_seconds=duration_seconds,
                file_size_bytes=file_size_bytes,
            )

            # Store source URL in analysis_result for URL uploads
            if source_url:
                video.analysis_result = {"source_url": source_url}

            self.session.add(video)
            await self.session.commit()
            await self.session.refresh(video)

            return video

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to create video: {str(e)}")

    async def get_by_id(self, video_id: uuid.UUID) -> Optional[Video]:
        """
        Get video by ID.

        Args:
            video_id: Video UUID

        Returns:
            Video instance or None if not found
        """
        try:
            stmt = select(Video).where(Video.id == video_id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()

        except Exception as e:
            raise DatabaseException(f"Failed to get video by ID: {str(e)}")

    async def get_by_id_with_segments(self, video_id: uuid.UUID) -> Optional[Video]:
        """
        Get video by ID with segments loaded.

        Args:
            video_id: Video UUID

        Returns:
            Video instance with segments or None if not found
        """
        try:
            stmt = (
                select(Video)
                .options(selectinload(Video.segments))
                .where(Video.id == video_id)
            )
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()

        except Exception as e:
            raise DatabaseException(f"Failed to get video with segments: {str(e)}")

    async def update_status(
        self, video_id: uuid.UUID, status: str, progress: int = 0
    ) -> Video:
        """
        Update video processing status.

        Args:
            video_id: Video UUID
            status: New status
            progress: Processing progress (0-100)

        Returns:
            Updated video instance

        Raises:
            DatabaseException: If update fails
        """
        try:
            stmt = (
                update(Video)
                .where(Video.id == video_id)
                .values(
                    status=status,
                    processing_progress=progress,
                    updated_at=datetime.utcnow(),
                )
                .returning(Video)
            )

            result = await self.session.execute(stmt)
            video = result.scalar_one_or_none()

            if not video:
                raise DatabaseException(f"Video with ID {video_id} not found")

            await self.session.commit()
            return video

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to update video status: {str(e)}")

    async def update_processing_results(
        self,
        video_id: uuid.UUID,
        gcs_path: Optional[str] = None,
        summary: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        analysis_result: Optional[Dict[str, Any]] = None,
        raw_results: Optional[Dict[str, Any]] = None,
    ) -> Video:
        """
        Update video with processing results.

        Args:
            video_id: Video UUID
            gcs_path: Google Cloud Storage path
            summary: Video summary
            keywords: Extracted keywords
            analysis_result: Full analysis results (cleaned, without raw_results)
            raw_results: Raw AI service results for separate storage

        Returns:
            Updated video instance
        """
        try:
            update_data = {"updated_at": datetime.utcnow()}

            if gcs_path is not None:
                update_data["gcs_path"] = gcs_path
            if summary is not None:
                update_data["summary"] = summary
            if keywords is not None:
                update_data["keywords"] = keywords

            # Separate handling for analysis_result and raw_results
            if analysis_result is not None:
                # Extract raw_results if present in analysis_result
                cleaned_analysis = analysis_result.copy()
                if "raw_results" in cleaned_analysis:
                    # Move raw_results to separate column
                    if raw_results is None:
                        raw_results = cleaned_analysis.pop("raw_results")
                    else:
                        cleaned_analysis.pop("raw_results")

                update_data["analysis_result"] = cleaned_analysis

            if raw_results is not None:
                update_data["raw_results"] = raw_results

            stmt = (
                update(Video)
                .where(Video.id == video_id)
                .values(**update_data)
                .returning(Video)
            )

            result = await self.session.execute(stmt)
            video = result.scalar_one_or_none()

            if not video:
                raise DatabaseException(f"Video with ID {video_id} not found")

            await self.session.commit()
            return video

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(
                f"Failed to update video processing results: {str(e)}"
            )

    async def list_videos(
        self, limit: int = 50, offset: int = 0, status: Optional[str] = None
    ) -> List[Video]:
        """
        List videos with optional filtering.

        Args:
            limit: Maximum number of videos to return
            offset: Number of videos to skip
            status: Optional status filter

        Returns:
            List of video instances
        """
        try:
            stmt = select(Video).order_by(Video.created_at.desc())

            if status:
                stmt = stmt.where(Video.status == status)

            stmt = stmt.limit(limit).offset(offset)

            result = await self.session.execute(stmt)
            return list(result.scalars().all())

        except Exception as e:
            raise DatabaseException(f"Failed to list videos: {str(e)}")

    async def delete_video(self, video_id: uuid.UUID) -> bool:
        """
        Delete video and all associated segments.

        Args:
            video_id: Video UUID

        Returns:
            True if deleted, False if not found
        """
        try:
            video = await self.get_by_id(video_id)
            if not video:
                return False

            await self.session.delete(video)
            await self.session.commit()
            return True

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to delete video: {str(e)}")
    async def update_analysis_result(
        self, video_id: uuid.UUID, analysis_result: Dict[str, Any]
    ) -> Video:
        """
        Update video analysis result.

        Args:
            video_id: Video UUID
            analysis_result: Analysis result data

        Returns:
            Updated video instance
        """
        return await self.update_processing_results(
            video_id=video_id, analysis_result=analysis_result
        )

    async def update_gcs_path(self, video_id: uuid.UUID, gcs_path: str) -> Video:
        """
        Update video GCS path.

        Args:
            video_id: Video UUID
            gcs_path: Google Cloud Storage path

        Returns:
            Updated video instance
        """
        return await self.update_processing_results(
            video_id=video_id, gcs_path=gcs_path
        )

    async def update(
        self, video_id: uuid.UUID, update_data: Dict[str, Any]
    ) -> Video:
        """
        Update video with arbitrary fields.

        Args:
            video_id: Video UUID
            update_data: Dictionary of fields to update

        Returns:
            Updated video instance

        Raises:
            DatabaseException: If update fails
        """
        try:
            # Add updated_at timestamp
            update_data["updated_at"] = datetime.utcnow()

            stmt = (
                update(Video)
                .where(Video.id == video_id)
                .values(**update_data)
                .returning(Video)
            )

            result = await self.session.execute(stmt)
            video = result.scalar_one_or_none()

            if not video:
                raise DatabaseException(f"Video with ID {video_id} not found")

            await self.session.commit()
            return video

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to update video: {str(e)}")