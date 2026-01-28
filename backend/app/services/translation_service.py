"""
Google Translation API service for multi-language support.
"""

import logging
from typing import Any, Optional

from google.cloud import translate_v2 as translate

from app.core.ai_config import ai_client_manager
from app.core.exceptions import ErrorCodes, VideoProcessingException

logger = logging.getLogger(__name__)


class TranslationService:
    """Service for translating content using Google Translation API."""

    def __init__(self):
        self.config = ai_client_manager.config
        self._client: Optional[translate.Client] = None

    def _get_client(self) -> translate.Client:
        """Get or create Translation API client."""
        if self._client is None:
            self._client = ai_client_manager.get_translate_client()
        return self._client

    async def translate_video_analysis(
        self, 
        analysis_data: dict[str, Any], 
        target_language: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Translate video analysis results to target language.

        Args:
            analysis_data: Original analysis data to translate
            target_language: Target language code (defaults to English)

        Returns:
            Dictionary containing translated analysis data

        Raises:
            VideoProcessingException: If translation fails
        """
        try:
            target_lang = target_language or self.config.default_target_language
            logger.info(f"Translating video analysis to {target_lang}")

            client = self._get_client()
            translated_data = {}

            # Detect source language from title or summary
            source_language = await self._detect_language(
                analysis_data.get("title", "") + " " + analysis_data.get("summary", "")
            )

            # Skip translation if already in target language
            if source_language == target_lang:
                logger.info(f"Content already in target language {target_lang}")
                return analysis_data.copy()

            # Translate title
            if analysis_data.get("title"):
                translated_data["title"] = await self._translate_text(
                    analysis_data["title"], target_lang, source_language
                )

            # Translate summary
            if analysis_data.get("summary"):
                translated_data["summary"] = await self._translate_text(
                    analysis_data["summary"], target_lang, source_language
                )

            # Translate keywords
            if analysis_data.get("keywords") and isinstance(analysis_data["keywords"], list):
                translated_keywords = []
                for keyword in analysis_data["keywords"]:
                    if isinstance(keyword, str) and keyword.strip():
                        translated_keyword = await self._translate_text(
                            keyword, target_lang, source_language
                        )
                        translated_keywords.append(translated_keyword)
                translated_data["keywords"] = translated_keywords

            # Translate main topics
            if analysis_data.get("main_topics") and isinstance(analysis_data["main_topics"], list):
                translated_topics = []
                for topic in analysis_data["main_topics"]:
                    if isinstance(topic, str) and topic.strip():
                        translated_topic = await self._translate_text(
                            topic, target_lang, source_language
                        )
                        translated_topics.append(translated_topic)
                translated_data["main_topics"] = translated_topics

            # Translate subject area
            if analysis_data.get("subject_area"):
                translated_data["subject_area"] = await self._translate_text(
                    analysis_data["subject_area"], target_lang, source_language
                )

            # Translate teaching methods
            if analysis_data.get("teaching_methods") and isinstance(analysis_data["teaching_methods"], list):
                translated_methods = []
                for method in analysis_data["teaching_methods"]:
                    if isinstance(method, str) and method.strip():
                        translated_method = await self._translate_text(
                            method, target_lang, source_language
                        )
                        translated_methods.append(translated_method)
                translated_data["teaching_methods"] = translated_methods

            # Translate practical applications
            if analysis_data.get("practical_applications") and isinstance(analysis_data["practical_applications"], list):
                translated_applications = []
                for application in analysis_data["practical_applications"]:
                    if isinstance(application, str) and application.strip():
                        translated_application = await self._translate_text(
                            application, target_lang, source_language
                        )
                        translated_applications.append(translated_application)
                translated_data["practical_applications"] = translated_applications

            # Add translation metadata
            translated_data["translation_info"] = {
                "source_language": source_language,
                "target_language": target_lang,
                "translated_fields": list(translated_data.keys())
            }

            logger.info(f"Translation completed for video analysis")
            return translated_data

        except VideoProcessingException:
            raise
        except Exception as e:
            logger.error(f"Video analysis translation failed: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Translation failed: {str(e)}"
            )

    async def translate_segments(
        self, 
        segments: list[dict[str, Any]], 
        target_language: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """
        Translate video segments to target language.

        Args:
            segments: List of segment dictionaries to translate
            target_language: Target language code

        Returns:
            List of translated segment dictionaries
        """
        try:
            target_lang = target_language or self.config.default_target_language
            logger.info(f"Translating {len(segments)} segments to {target_lang}")

            translated_segments = []

            for segment in segments:
                translated_segment = segment.copy()
                
                # Detect source language from segment content
                segment_text = (segment.get("title", "") + " " + 
                               segment.get("summary", "") + " " + 
                               segment.get("scripts", ""))
                
                if not segment_text.strip():
                    translated_segments.append(translated_segment)
                    continue

                source_language = await self._detect_language(segment_text)

                # Skip if already in target language
                if source_language == target_lang:
                    translated_segments.append(translated_segment)
                    continue

                # Translate segment fields
                if segment.get("title"):
                    translated_segment["translated_title"] = await self._translate_text(
                        segment["title"], target_lang, source_language
                    )

                if segment.get("summary"):
                    translated_segment["translated_summary"] = await self._translate_text(
                        segment["summary"], target_lang, source_language
                    )

                if segment.get("scripts"):
                    translated_segment["translated_scripts"] = await self._translate_text(
                        segment["scripts"], target_lang, source_language
                    )

                # Translate keywords
                if segment.get("keywords") and isinstance(segment["keywords"], list):
                    translated_keywords = []
                    for keyword in segment["keywords"]:
                        if isinstance(keyword, str) and keyword.strip():
                            translated_keyword = await self._translate_text(
                                keyword, target_lang, source_language
                            )
                            translated_keywords.append(translated_keyword)
                    translated_segment["translated_keywords"] = translated_keywords

                # Add translation metadata to segment
                translated_segment["translation_info"] = {
                    "source_language": source_language,
                    "target_language": target_lang
                }

                translated_segments.append(translated_segment)

            logger.info(f"Segment translation completed")
            return translated_segments

        except Exception as e:
            logger.error(f"Segment translation failed: {str(e)}")
            # Return original segments if translation fails
            return segments

    async def translate_transcript(
        self, 
        transcript_data: dict[str, Any], 
        target_language: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Translate transcript data to target language.

        Args:
            transcript_data: Original transcript data
            target_language: Target language code

        Returns:
            Translated transcript data
        """
        try:
            target_lang = target_language or self.config.default_target_language
            
            if not transcript_data.get("transcript"):
                return transcript_data.copy()

            logger.info(f"Translating transcript to {target_lang}")

            # Detect source language
            source_language = await self._detect_language(transcript_data["transcript"])

            # Skip if already in target language
            if source_language == target_lang:
                return transcript_data.copy()

            translated_data = transcript_data.copy()

            # Translate main transcript
            translated_data["translated_transcript"] = await self._translate_text(
                transcript_data["transcript"], target_lang, source_language
            )

            # Translate segments if available
            if transcript_data.get("segments"):
                translated_segments = []
                for segment in transcript_data["segments"]:
                    translated_segment = segment.copy()
                    if segment.get("text"):
                        translated_segment["translated_text"] = await self._translate_text(
                            segment["text"], target_lang, source_language
                        )
                    translated_segments.append(translated_segment)
                translated_data["translated_segments"] = translated_segments

            # Add translation metadata
            translated_data["translation_info"] = {
                "source_language": source_language,
                "target_language": target_lang,
                "transcript_translated": True
            }

            logger.info(f"Transcript translation completed")
            return translated_data

        except Exception as e:
            logger.error(f"Transcript translation failed: {str(e)}")
            return transcript_data.copy()

    async def _detect_language(self, text: str) -> str:
        """
        Detect the language of given text.

        Args:
            text: Text to analyze

        Returns:
            Detected language code
        """
        try:
            if not text or not text.strip():
                return "unknown"

            client = self._get_client()
            
            # Use only first 1000 characters for detection
            sample_text = text[:1000]
            
            result = client.detect_language(sample_text)
            detected_language = result["language"]
            confidence = result.get("confidence", 0.0)

            # Return detected language if confidence is reasonable
            if confidence > 0.5:
                logger.debug(f"Detected language: {detected_language} (confidence: {confidence})")
                return detected_language
            else:
                logger.warning(f"Low confidence language detection: {detected_language} ({confidence})")
                return "unknown"

        except Exception as e:
            logger.warning(f"Language detection failed: {str(e)}")
            return "unknown"

    async def _translate_text(
        self,
        text: str,
        target_language: str,
        source_language: Optional[str] = None
    ) -> str:
        """
        Translate text to target language.

        Args:
            text: Text to translate
            target_language: Target language code
            source_language: Source language code (optional)

        Returns:
            Translated text
        """
        try:
            if not text or not text.strip():
                return text

            client = self._get_client()

            # Prepare translation parameters
            translate_params = {
                "values": text,
                "target_language": target_language
            }

            if source_language and source_language != "unknown":
                translate_params["source_language"] = source_language

            # Perform translation
            result = client.translate(**translate_params)

            translated_text = result["translatedText"]

            # Decode HTML entities in translated text
            from app.core.text_utils import decode_html_entities
            translated_text = decode_html_entities(translated_text)

            logger.debug(f"Translated text from {source_language} to {target_language}")
            return translated_text

        except Exception as e:
            logger.warning(f"Text translation failed: {str(e)}")
            return text  # Return original text if translation fails

    async def get_supported_languages(self) -> list[dict[str, str]]:
        """
        Get list of supported languages for translation.

        Returns:
            List of supported language dictionaries
        """
        try:
            client = self._get_client()
            languages = client.get_languages()
            
            return [
                {
                    "code": lang["language"],
                    "name": lang.get("name", lang["language"])
                }
                for lang in languages
            ]

        except Exception as e:
            logger.error(f"Failed to get supported languages: {str(e)}")
            return [
                {"code": "en", "name": "English"},
                {"code": "ko", "name": "Korean"},
                {"code": "es", "name": "Spanish"},
                {"code": "fr", "name": "French"},
                {"code": "de", "name": "German"},
                {"code": "ja", "name": "Japanese"},
                {"code": "zh", "name": "Chinese"}
            ]

    async def batch_translate(
        self, 
        texts: list[str], 
        target_language: str, 
        source_language: Optional[str] = None
    ) -> list[str]:
        """
        Translate multiple texts in a single batch request.

        Args:
            texts: List of texts to translate
            target_language: Target language code
            source_language: Source language code (optional)

        Returns:
            List of translated texts
        """
        try:
            if not texts:
                return []

            client = self._get_client()

            # Filter out empty texts
            non_empty_texts = [text for text in texts if text and text.strip()]
            if not non_empty_texts:
                return texts

            # Prepare translation parameters
            translate_params = {
                "values": non_empty_texts,
                "target_language": target_language
            }

            if source_language and source_language != "unknown":
                translate_params["source_language"] = source_language

            # Perform batch translation
            results = client.translate(**translate_params)

            # Decode HTML entities in translated results
            from app.core.text_utils import decode_html_entities

            # Handle single result vs list of results
            if isinstance(results, list):
                translated_texts = [decode_html_entities(result["translatedText"]) for result in results]
            else:
                translated_texts = [decode_html_entities(results["translatedText"])]

            # Map back to original list (handling empty texts)
            final_results = []
            translated_index = 0

            for original_text in texts:
                if original_text and original_text.strip():
                    final_results.append(translated_texts[translated_index])
                    translated_index += 1
                else:
                    final_results.append(original_text)

            return final_results

        except Exception as e:
            logger.error(f"Batch translation failed: {str(e)}")
            return texts  # Return original texts if translation fails


# Global Translation service instance
translation_service = TranslationService()