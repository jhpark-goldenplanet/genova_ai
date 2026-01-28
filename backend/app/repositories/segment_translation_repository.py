"""
Segment translation repository for database operations.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DatabaseException
from app.models.video import Segment
from app.models.video_translation import SegmentTranslation


class SegmentTranslationRepository:
    """Repository for segment translation database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_segment_and_language(
        self, segment_id: uuid.UUID, target_language: str
    ) -> Optional[SegmentTranslation]:
        """
        Get segment translation by segment ID and target language.

        Args:
            segment_id: Segment UUID
            target_language: Target language code (e.g., 'en', 'ko', 'ja')

        Returns:
            SegmentTranslation instance or None if not found
        """
        try:
            stmt = select(SegmentTranslation).where(
                SegmentTranslation.segment_id == segment_id,
                SegmentTranslation.target_language == target_language,
            )
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()

        except Exception as e:
            raise DatabaseException(f"Failed to get segment translation: {str(e)}")

    async def create(self, data: Dict[str, Any]) -> SegmentTranslation:
        """
        Create a new segment translation record.

        Args:
            data: Translation data dictionary

        Returns:
            Created SegmentTranslation instance

        Raises:
            DatabaseException: If creation fails
        """
        try:
            translation = SegmentTranslation(**data)
            self.session.add(translation)
            await self.session.commit()
            await self.session.refresh(translation)

            return translation

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to create segment translation: {str(e)}")

    async def update(
        self, translation_id: uuid.UUID, data: Dict[str, Any]
    ) -> SegmentTranslation:
        """
        Update segment translation.

        Args:
            translation_id: Translation UUID
            data: Dictionary of fields to update

        Returns:
            Updated SegmentTranslation instance

        Raises:
            DatabaseException: If update fails
        """
        try:
            # Add updated_at timestamp
            data["updated_at"] = datetime.utcnow()

            stmt = (
                update(SegmentTranslation)
                .where(SegmentTranslation.id == translation_id)
                .values(**data)
                .returning(SegmentTranslation)
            )

            result = await self.session.execute(stmt)
            translation = result.scalar_one_or_none()

            if not translation:
                raise DatabaseException(
                    f"SegmentTranslation with ID {translation_id} not found"
                )

            await self.session.commit()
            return translation

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to update segment translation: {str(e)}")

    async def get_all_by_video(self, video_id: uuid.UUID) -> List[SegmentTranslation]:
        """
        Get all segment translations for a video.

        Args:
            video_id: Video UUID

        Returns:
            List of SegmentTranslation instances
        """
        try:
            stmt = (
                select(SegmentTranslation)
                .join(Segment)
                .where(Segment.video_id == video_id)
            )
            result = await self.session.execute(stmt)
            return list(result.scalars().all())

        except Exception as e:
            raise DatabaseException(
                f"Failed to get segment translations for video: {str(e)}"
            )

    async def batch_get_by_segments_and_language(
        self, segment_ids: List[uuid.UUID], target_language: str
    ) -> Dict[uuid.UUID, SegmentTranslation]:
        """
        Get translations for multiple segments in a specific language.

        Args:
            segment_ids: List of segment UUIDs
            target_language: Target language code

        Returns:
            Dictionary mapping segment_id to SegmentTranslation
        """
        try:
            stmt = select(SegmentTranslation).where(
                SegmentTranslation.segment_id.in_(segment_ids),
                SegmentTranslation.target_language == target_language,
            )
            result = await self.session.execute(stmt)
            translations = result.scalars().all()

            return {t.segment_id: t for t in translations}

        except Exception as e:
            raise DatabaseException(
                f"Failed to batch get segment translations: {str(e)}"
            )

    async def delete_by_segment_and_language(
        self, segment_id: uuid.UUID, target_language: str
    ) -> bool:
        """
        Delete a specific segment translation.

        Args:
            segment_id: Segment UUID
            target_language: Target language code

        Returns:
            True if deleted, False if not found
        """
        try:
            translation = await self.get_by_segment_and_language(
                segment_id, target_language
            )
            if not translation:
                return False

            await self.session.delete(translation)
            await self.session.commit()
            return True

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to delete segment translation: {str(e)}")

    async def upsert(self, data: Dict[str, Any]) -> SegmentTranslation:
        """
        Create or update segment translation (upsert operation).

        Args:
            data: Translation data dictionary with 'segment_id' and 'target_language'

        Returns:
            SegmentTranslation instance

        Raises:
            DatabaseException: If operation fails
        """
        try:
            existing = await self.get_by_segment_and_language(
                data["segment_id"], data["target_language"]
            )

            if existing:
                # Update existing
                return await self.update(existing.id, data)
            else:
                # Create new
                return await self.create(data)

        except Exception as e:
            raise DatabaseException(f"Failed to upsert segment translation: {str(e)}")

    async def get_all_by_segment(
        self, segment_id: uuid.UUID
    ) -> List[SegmentTranslation]:
        """
        Get all translations for a specific segment.

        Args:
            segment_id: Segment UUID

        Returns:
            List of SegmentTranslation instances
        """
        try:
            stmt = select(SegmentTranslation).where(
                SegmentTranslation.segment_id == segment_id
            )
            result = await self.session.execute(stmt)
            return list(result.scalars().all())

        except Exception as e:
            raise DatabaseException(
                f"Failed to get translations for segment: {str(e)}"
            )
