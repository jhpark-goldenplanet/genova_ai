"""
Repository for segment database operations.
"""

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.video import Segment, Video

logger = logging.getLogger(__name__)


class SegmentRepository:
    """Repository for segment database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_segments(self, video_id: UUID, segments_data: list[dict]) -> list[Segment]:
        """
        Create multiple segments for a video.

        Args:
            video_id: Video identifier
            segments_data: List of segment data dictionaries

        Returns:
            List of created Segment objects
        """
        try:
            segments = []
            
            for segment_data in segments_data:
                segment = Segment(
                    video_id=video_id,
                    segment_no=segment_data["segment_no"],
                    start_time=segment_data["start_time"],
                    end_time=segment_data["end_time"],
                    title=segment_data["title"],
                    summary=segment_data.get("summary"),
                    keywords=segment_data.get("keywords"),
                    scripts=segment_data.get("scripts"),
                    class_type=segment_data.get("class_type"),
                    source_language=segment_data.get("source_language", "ko")
                )
                
                self.session.add(segment)
                segments.append(segment)
            
            await self.session.flush()
            logger.info(f"Created {len(segments)} segments for video {video_id}")
            return segments

        except Exception as e:
            logger.error(f"Failed to create segments for video {video_id}: {str(e)}")
            raise

    async def get_segments_by_video_id(self, video_id: UUID) -> list[Segment]:
        """
        Get all segments for a video.

        Args:
            video_id: Video identifier

        Returns:
            List of Segment objects
        """
        try:
            stmt = (
                select(Segment)
                .where(Segment.video_id == video_id)
                .order_by(Segment.segment_no)
            )
            
            result = await self.session.execute(stmt)
            segments = result.scalars().all()
            
            logger.debug(f"Retrieved {len(segments)} segments for video {video_id}")
            return list(segments)

        except Exception as e:
            logger.error(f"Failed to get segments for video {video_id}: {str(e)}")
            raise

    async def get_segment_by_id(self, segment_id: UUID) -> Optional[Segment]:
        """
        Get a segment by its ID.

        Args:
            segment_id: Segment identifier

        Returns:
            Segment object or None if not found
        """
        try:
            stmt = select(Segment).where(Segment.id == segment_id)
            result = await self.session.execute(stmt)
            segment = result.scalar_one_or_none()
            
            if segment:
                logger.debug(f"Retrieved segment {segment_id}")
            else:
                logger.debug(f"Segment {segment_id} not found")
            
            return segment

        except Exception as e:
            logger.error(f"Failed to get segment {segment_id}: {str(e)}")
            raise

    async def update_segment(self, segment_id: UUID, update_data: dict) -> Optional[Segment]:
        """
        Update a segment with new data.

        Args:
            segment_id: Segment identifier
            update_data: Dictionary of fields to update

        Returns:
            Updated Segment object or None if not found
        """
        try:
            segment = await self.get_segment_by_id(segment_id)
            if not segment:
                return None

            # Update allowed fields
            allowed_fields = {
                'title', 'summary', 'keywords', 'scripts', 'class_type',
                'translated_title', 'translated_summary', 'translated_keywords', 'translated_scripts'
            }
            
            for field, value in update_data.items():
                if field in allowed_fields and hasattr(segment, field):
                    setattr(segment, field, value)

            await self.session.flush()
            logger.info(f"Updated segment {segment_id}")
            return segment

        except Exception as e:
            logger.error(f"Failed to update segment {segment_id}: {str(e)}")
            raise

    async def delete_segments_by_video_id(self, video_id: UUID) -> int:
        """
        Delete all segments for a video.

        Args:
            video_id: Video identifier

        Returns:
            Number of deleted segments
        """
        try:
            segments = await self.get_segments_by_video_id(video_id)
            count = len(segments)
            
            for segment in segments:
                await self.session.delete(segment)
            
            await self.session.flush()
            logger.info(f"Deleted {count} segments for video {video_id}")
            return count

        except Exception as e:
            logger.error(f"Failed to delete segments for video {video_id}: {str(e)}")
            raise

    async def get_video_with_segments(self, video_id: UUID) -> Optional[Video]:
        """
        Get a video with all its segments loaded.

        Args:
            video_id: Video identifier

        Returns:
            Video object with segments loaded, or None if not found
        """
        try:
            stmt = (
                select(Video)
                .options(selectinload(Video.segments))
                .where(Video.id == video_id)
            )
            
            result = await self.session.execute(stmt)
            video = result.scalar_one_or_none()
            
            if video:
                logger.debug(f"Retrieved video {video_id} with {len(video.segments)} segments")
            else:
                logger.debug(f"Video {video_id} not found")
            
            return video

        except Exception as e:
            logger.error(f"Failed to get video with segments {video_id}: {str(e)}")
            raise

    async def update_segment_translations(
        self, 
        video_id: UUID, 
        translations: list[dict]
    ) -> list[Segment]:
        """
        Update translation data for all segments of a video.

        Args:
            video_id: Video identifier
            translations: List of translation data for each segment

        Returns:
            List of updated Segment objects
        """
        try:
            segments = await self.get_segments_by_video_id(video_id)
            updated_segments = []
            
            # Create a mapping of segment_no to translation data
            translation_map = {t.get("segment_no"): t for t in translations}
            
            for segment in segments:
                translation_data = translation_map.get(segment.segment_no)
                if translation_data:
                    segment.translated_title = translation_data.get("translated_title")
                    segment.translated_summary = translation_data.get("translated_summary")
                    segment.translated_keywords = translation_data.get("translated_keywords")
                    segment.translated_scripts = translation_data.get("translated_scripts")
                    updated_segments.append(segment)
            
            await self.session.flush()
            logger.info(f"Updated translations for {len(updated_segments)} segments of video {video_id}")
            return updated_segments

        except Exception as e:
            logger.error(f"Failed to update segment translations for video {video_id}: {str(e)}")
            raise

    async def get_segments_by_class_type(
        self, 
        video_id: UUID, 
        class_type: str
    ) -> list[Segment]:
        """
        Get segments of a specific class type for a video.

        Args:
            video_id: Video identifier
            class_type: Segment class type (introduction, content, conclusion)

        Returns:
            List of Segment objects
        """
        try:
            stmt = (
                select(Segment)
                .where(Segment.video_id == video_id)
                .where(Segment.class_type == class_type)
                .order_by(Segment.segment_no)
            )
            
            result = await self.session.execute(stmt)
            segments = result.scalars().all()
            
            logger.debug(f"Retrieved {len(segments)} {class_type} segments for video {video_id}")
            return list(segments)

        except Exception as e:
            logger.error(f"Failed to get {class_type} segments for video {video_id}: {str(e)}")
            raise

    async def count_segments_by_video_id(self, video_id: UUID) -> int:
        """
        Count the number of segments for a video.

        Args:
            video_id: Video identifier

        Returns:
            Number of segments
        """
        try:
            segments = await self.get_segments_by_video_id(video_id)
            count = len(segments)
            
            logger.debug(f"Video {video_id} has {count} segments")
            return count

        except Exception as e:
            logger.error(f"Failed to count segments for video {video_id}: {str(e)}")
            raise