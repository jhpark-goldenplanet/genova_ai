"""
Video translation repository for database operations.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DatabaseException
from app.models.video_translation import VideoTranslation


class VideoTranslationRepository:
    """Repository for video translation database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_video_and_language(
        self, video_id: uuid.UUID, target_language: str
    ) -> Optional[VideoTranslation]:
        """
        Get video translation by video ID and target language.

        Args:
            video_id: Video UUID
            target_language: Target language code (e.g., 'en', 'ko', 'ja')

        Returns:
            VideoTranslation instance or None if not found
        """
        try:
            stmt = select(VideoTranslation).where(
                VideoTranslation.video_id == video_id,
                VideoTranslation.target_language == target_language,
            )
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()

        except Exception as e:
            raise DatabaseException(
                f"Failed to get video translation: {str(e)}"
            )

    async def create(self, data: Dict[str, Any]) -> VideoTranslation:
        """
        Create a new video translation record.

        Args:
            data: Translation data dictionary

        Returns:
            Created VideoTranslation instance

        Raises:
            DatabaseException: If creation fails
        """
        try:
            translation = VideoTranslation(**data)
            self.session.add(translation)
            await self.session.commit()
            await self.session.refresh(translation)

            return translation

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to create video translation: {str(e)}")

    async def update(
        self, translation_id: uuid.UUID, data: Dict[str, Any]
    ) -> VideoTranslation:
        """
        Update video translation.

        Args:
            translation_id: Translation UUID
            data: Dictionary of fields to update

        Returns:
            Updated VideoTranslation instance

        Raises:
            DatabaseException: If update fails
        """
        try:
            # Add updated_at timestamp
            data["updated_at"] = datetime.utcnow()

            stmt = (
                update(VideoTranslation)
                .where(VideoTranslation.id == translation_id)
                .values(**data)
                .returning(VideoTranslation)
            )

            result = await self.session.execute(stmt)
            translation = result.scalar_one_or_none()

            if not translation:
                raise DatabaseException(
                    f"VideoTranslation with ID {translation_id} not found"
                )

            await self.session.commit()
            return translation

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to update video translation: {str(e)}")

    async def get_all_by_video(self, video_id: uuid.UUID) -> List[VideoTranslation]:
        """
        Get all translations for a video.

        Args:
            video_id: Video UUID

        Returns:
            List of VideoTranslation instances
        """
        try:
            stmt = select(VideoTranslation).where(
                VideoTranslation.video_id == video_id
            )
            result = await self.session.execute(stmt)
            return list(result.scalars().all())

        except Exception as e:
            raise DatabaseException(
                f"Failed to get video translations: {str(e)}"
            )

    async def delete_by_video_and_language(
        self, video_id: uuid.UUID, target_language: str
    ) -> bool:
        """
        Delete a specific video translation.

        Args:
            video_id: Video UUID
            target_language: Target language code

        Returns:
            True if deleted, False if not found
        """
        try:
            translation = await self.get_by_video_and_language(
                video_id, target_language
            )
            if not translation:
                return False

            await self.session.delete(translation)
            await self.session.commit()
            return True

        except Exception as e:
            await self.session.rollback()
            raise DatabaseException(f"Failed to delete video translation: {str(e)}")

    async def upsert(self, data: Dict[str, Any]) -> VideoTranslation:
        """
        Create or update video translation (upsert operation).

        Args:
            data: Translation data dictionary with 'video_id' and 'target_language'

        Returns:
            VideoTranslation instance

        Raises:
            DatabaseException: If operation fails
        """
        try:
            existing = await self.get_by_video_and_language(
                data["video_id"], data["target_language"]
            )

            if existing:
                # Update existing
                return await self.update(existing.id, data)
            else:
                # Create new
                return await self.create(data)

        except Exception as e:
            raise DatabaseException(f"Failed to upsert video translation: {str(e)}")
