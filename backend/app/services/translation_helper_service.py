"""
Translation helper service for on-demand translation generation.
"""

import logging
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Segment, Video
from app.models.video_translation import SegmentTranslation, VideoTranslation
from app.repositories.segment_translation_repository import SegmentTranslationRepository
from app.repositories.video_translation_repository import VideoTranslationRepository
from app.services.translation_service import translation_service

logger = logging.getLogger(__name__)


class TranslationHelperService:
    """Service for managing on-demand translations of videos and segments."""

    async def get_or_create_video_and_segments_translations(
        self,
        session: AsyncSession,
        video: Video,
        segments: List[Segment],
        target_language: str,
    ) -> Tuple[Optional[VideoTranslation], Dict[UUID, Optional[SegmentTranslation]]]:
        """
        Get or create translations for video and all segments in a single batch API call.

        This method translates the video and all its segments together to minimize
        API calls and avoid database session conflicts.

        Args:
            session: Database session
            video: Video model instance
            segments: List of Segment instances
            target_language: Target language code (e.g., 'en', 'ko', 'ja')

        Returns:
            Tuple of (VideoTranslation, Dict mapping segment_id to SegmentTranslation)
        """
        try:
            video_translation_repo = VideoTranslationRepository(session)
            segment_translation_repo = SegmentTranslationRepository(session)

            # Check if all translations already exist
            existing_video_translation = await video_translation_repo.get_by_video_and_language(
                video.id, target_language
            )

            existing_segment_translations = {}
            all_translations_exist = existing_video_translation and existing_video_translation.translation_status == "COMPLETED"

            if all_translations_exist and segments:
                for segment in segments:
                    existing_seg = await segment_translation_repo.get_by_segment_and_language(
                        segment.id, target_language
                    )
                    if existing_seg and existing_seg.translation_status == "COMPLETED":
                        existing_segment_translations[segment.id] = existing_seg
                    else:
                        all_translations_exist = False
                        break

            # Return cached translations if all exist
            if all_translations_exist:
                logger.info(
                    f"Using existing translations for video {video.id} and {len(segments)} segments in {target_language}"
                )
                return existing_video_translation, existing_segment_translations

            # Prepare all texts for batch translation
            logger.info(
                f"Generating batch translation for video {video.id} and {len(segments)} segments to {target_language}"
            )

            texts_to_translate = []
            translation_map = []  # Track what each text index represents

            # Add video texts
            if video.title:
                texts_to_translate.append(video.title)
                translation_map.append(("video", "title"))
            if video.summary:
                texts_to_translate.append(video.summary)
                translation_map.append(("video", "summary"))

            # Add video keywords
            video_keywords = video.keywords or []
            for i, keyword in enumerate(video_keywords):
                if keyword:
                    texts_to_translate.append(keyword)
                    translation_map.append(("video", "keyword", i))

            # Add segment texts
            for segment in segments:
                if segment.title:
                    texts_to_translate.append(segment.title)
                    translation_map.append(("segment", segment.id, "title"))
                if segment.summary:
                    texts_to_translate.append(segment.summary)
                    translation_map.append(("segment", segment.id, "summary"))

                # Add segment keywords
                seg_keywords = segment.keywords or []
                for i, keyword in enumerate(seg_keywords):
                    if keyword:
                        texts_to_translate.append(keyword)
                        translation_map.append(("segment", segment.id, "keyword", i))

                # Add segment scripts
                if segment.scripts:
                    texts_to_translate.append(segment.scripts)
                    translation_map.append(("segment", segment.id, "scripts"))

            if not texts_to_translate:
                logger.warning(f"No content to translate for video {video.id}")
                return None, {}

            # Single batch translation API call
            translated_texts = await translation_service.batch_translate(
                texts=texts_to_translate,
                target_language=target_language,
                source_language=video.source_language,
            )

            # Parse translated results
            video_data = {
                "translated_title": None,
                "translated_summary": None,
                "translated_keywords": [],
            }
            segment_data_map = {seg.id: {
                "translated_title": None,
                "translated_summary": None,
                "translated_keywords": [],
                "translated_scripts": None,
            } for seg in segments}

            for idx, mapping in enumerate(translation_map):
                if idx >= len(translated_texts):
                    break

                translated = translated_texts[idx]

                if mapping[0] == "video":
                    if mapping[1] == "title":
                        video_data["translated_title"] = translated
                    elif mapping[1] == "summary":
                        video_data["translated_summary"] = translated
                    elif mapping[1] == "keyword":
                        video_data["translated_keywords"].append(translated)
                elif mapping[0] == "segment":
                    segment_id = mapping[1]
                    field = mapping[2]

                    if field == "title":
                        segment_data_map[segment_id]["translated_title"] = translated
                    elif field == "summary":
                        segment_data_map[segment_id]["translated_summary"] = translated
                    elif field == "keyword":
                        segment_data_map[segment_id]["translated_keywords"].append(translated)
                    elif field == "scripts":
                        segment_data_map[segment_id]["translated_scripts"] = translated

            # Save video translation
            video_translation_data = {
                "video_id": video.id,
                "target_language": target_language,
                "translated_title": video_data["translated_title"],
                "translated_summary": video_data["translated_summary"],
                "translated_keywords": video_data["translated_keywords"],
                "translation_status": "COMPLETED",
                "translation_provider": "google_translate",
            }

            if existing_video_translation:
                video_translation = await video_translation_repo.update(
                    existing_video_translation.id, video_translation_data
                )
            else:
                video_translation = await video_translation_repo.create(video_translation_data)

            # Save segment translations
            segment_translations = {}
            for segment in segments:
                seg_data = segment_data_map[segment.id]

                segment_translation_data = {
                    "segment_id": segment.id,
                    "target_language": target_language,
                    "translated_title": seg_data["translated_title"],
                    "translated_summary": seg_data["translated_summary"],
                    "translated_keywords": seg_data["translated_keywords"],
                    "translated_scripts": seg_data["translated_scripts"],
                    "translation_status": "COMPLETED",
                    "translation_provider": "google_translate",
                }

                # Check if segment translation exists
                existing_seg = await segment_translation_repo.get_by_segment_and_language(
                    segment.id, target_language
                )

                if existing_seg:
                    seg_translation = await segment_translation_repo.update(
                        existing_seg.id, segment_translation_data
                    )
                else:
                    seg_translation = await segment_translation_repo.create(segment_translation_data)

                segment_translations[segment.id] = seg_translation

            logger.info(
                f"Batch translation completed for video {video.id} and {len(segments)} segments to {target_language}"
            )
            return video_translation, segment_translations

        except Exception as e:
            logger.error(
                f"Failed to batch translate video {video.id} and segments: {str(e)}",
                exc_info=True
            )
            # Return any existing translations as fallback
            return existing_video_translation if 'existing_video_translation' in locals() else None, {}

    async def get_or_create_video_translation(
        self,
        session: AsyncSession,
        video: Video,
        target_language: str,
    ) -> Optional[VideoTranslation]:
        """
        Get existing video translation or create a new one.

        Note: This method is kept for backward compatibility but it's recommended
        to use get_or_create_video_and_segments_translations for better performance.
        """
        video_translation, _ = await self.get_or_create_video_and_segments_translations(
            session, video, [], target_language
        )
        return video_translation

    async def get_or_create_all_segment_translations(
        self,
        session: AsyncSession,
        segments: List[Segment],
        target_language: str,
    ) -> Dict[UUID, Optional[SegmentTranslation]]:
        """
        Get or create translations for multiple segments.

        Note: This method is kept for backward compatibility but it's recommended
        to use get_or_create_video_and_segments_translations for better performance.
        """
        # For backward compatibility, we need to get the video
        if not segments:
            return {}

        # Get video from first segment
        video = segments[0].video
        _, segment_translations = await self.get_or_create_video_and_segments_translations(
            session, video, segments, target_language
        )
        return segment_translations


# Global translation helper service instance
translation_helper_service = TranslationHelperService()
