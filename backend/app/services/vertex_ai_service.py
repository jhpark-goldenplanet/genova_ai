"""
Vertex AI service for video analysis and summary generation using Gemini models.
"""

import asyncio
import logging
from typing import Any, Optional

from vertexai.generative_models import GenerativeModel, GenerationConfig, Part

from app.core.ai_config import ai_client_manager
from app.core.exceptions import ErrorCodes, VideoProcessingException

logger = logging.getLogger(__name__)


class VertexAIService:
    """Service for video analysis using Google Vertex AI Gemini models."""

    def __init__(self):
        self.model_name = ai_client_manager.config.vertex_model_name
        self._model: Optional[GenerativeModel] = None
        self.max_retries = 3  # Maximum retry attempts

        # Generation config for video analysis (gemini-2.5-pro optimized)
        self._generation_config = GenerationConfig(
            temperature=0.1,  # Low temperature for consistent analysis
            top_p=0.8,
            top_k=40,
            response_mime_type="application/json",  # Force JSON response
        )

    def _get_model(self) -> GenerativeModel:
        """Get or create Gemini model instance."""
        if self._model is None:
            # Initialization is now handled at application startup in main.py
            self._model = GenerativeModel(self.model_name)
        return self._model

    async def _generate_with_retry(self, content: list, model: GenerativeModel) -> Any:
        """
        Generate content with retry logic and exponential backoff.

        Args:
            content: Content to send to the model
            model: Generative model instance

        Returns:
            Model response

        Raises:
            VideoProcessingException: If all retry attempts fail
        """
        last_exception = None

        for attempt in range(self.max_retries):
            try:
                logger.info(f"Vertex AI generation attempt {attempt + 1}/{self.max_retries}")
                response = await model.generate_content_async(
                    contents=content,
                    generation_config=self._generation_config,
                )

                if not response or not response.text:
                    raise ValueError("Empty response from Vertex AI")

                logger.info(f"Vertex AI generation succeeded on attempt {attempt + 1}")
                return response

            except Exception as e:
                last_exception = e
                logger.warning(
                    f"Vertex AI request attempt {attempt + 1}/{self.max_retries} failed: {str(e)}"
                )

                if attempt < self.max_retries - 1:
                    # Exponential backoff: 2^attempt seconds
                    wait_time = 2 ** attempt
                    logger.info(f"Waiting {wait_time} seconds before retry...")
                    await asyncio.sleep(wait_time)
                    continue

        # All retries failed
        error_msg = f"All {self.max_retries} attempts failed. Last error: {str(last_exception)}"
        logger.error(error_msg)
        raise VideoProcessingException(
            ErrorCodes.AI_SERVICE_ERROR,
            error_msg
        )

    async def analyze_video(self, gcs_uri: str, source_language: str = "ko") -> dict[str, Any]:
        """
        Analyze video content from a GCS URI and generate a comprehensive summary.

        Args:
            gcs_uri: The GCS URI of the video file (e.g., "gs://bucket/video.mp4").
            source_language: Source language of the video content (ko, en, etc.)

        Returns:
            Dictionary containing analysis results.

        Raises:
            VideoProcessingException: If analysis fails.
        """
        try:
            logger.info(f"Starting video analysis with Vertex AI for GCS URI: {gcs_uri}, language: {source_language}")
            model = self._get_model()
            prompt = self._create_analysis_prompt(source_language)
            video_part = Part.from_uri(uri=gcs_uri, mime_type="video/mp4")
            content = [prompt, video_part]

            logger.info(f"Generating analysis from GCS URI: {gcs_uri}")
            response = await self._generate_with_retry(content, model)

            analysis_result = self._parse_analysis_response(response.text)
            analysis_result["model_used"] = self.model_name
            analysis_result["source_language"] = source_language

            logger.info(f"Video analysis completed for: {gcs_uri}")
            return analysis_result

        except Exception as e:
            logger.error(f"Failed to generate analysis from GCS URI: {str(e)}", exc_info=True)
            raise VideoProcessingException(
                ErrorCodes.AI_SERVICE_ERROR,
                f"AI analysis generation failed: {str(e)}"
            )

    def _create_analysis_prompt(self, source_language: str = "ko") -> str:
        """Create comprehensive analysis prompt for videos with transcript and segments."""

        # Language-specific instructions
        language_instructions = {
            "ko": "한국어로 분석을 작성해주세요. All analysis must be written in Korean.",
            "en": "Write the analysis in English.",
            "ja": "日本語で分析を作成してください。Write the analysis in Japanese.",
            "zh": "请用中文撰写分析。Write the analysis in Chinese."
        }

        lang_instruction = language_instructions.get(source_language, "한국어로 분석을 작성해주세요. Write the analysis in Korean.")

        return f"""
        Analyze this video and provide a comprehensive analysis in JSON format.

        IMPORTANT: {lang_instruction}

        Please provide:
        1. A descriptive title (50-100 characters)
        2. A comprehensive summary (200-400 words) that captures the main content and key messages
        3. 5-10 key keywords that represent the main topics and concepts
        4. **Segments**: Divide the video into 2-10 meaningful sections (choose optimal number based on content) with:
           - segment_no: Sequential number starting from 1
           - start_time: Start time in MM:SS format (minutes:seconds, e.g., "0:00", "2:30", "15:45")
           - end_time: End time in MM:SS format (e.g., "2:30", "5:15", "18:20")
           - title: Brief title for the segment (20-50 characters)
           - summary: 2-3 sentence summary of the segment content. Use BOTH visual content (screen text, slides, diagrams) AND audio narration to create a comprehensive understanding. This field should describe what the segment teaches/covers.
           - keywords: 3-5 key keywords specific to this segment
           - transcript: **AUDIO SPEECH ONLY** - Transcribe ONLY the spoken words/narration from the audio track for this segment. DO NOT include any text visible on screen (slides, captions, overlays). Only capture what is actually being spoken.

        **CRITICAL - Segment Timing Precision Rules:**
        - Start time of first segment MUST be "0:00"
        - End time of LAST segment MUST match the exact last frame of the video
        - NEVER use placeholder terms like "end" or estimated values for end times
        - Each segment's end_time must be a valid timestamp (e.g., "10:30"), not an approximation
        - Ensure NO gaps or overlaps between segments
        - Cross-check the final segment's end time with the total video duration for absolute accuracy

        **IMPORTANT - Time Format Examples:**
        - "0:00" for start (0 minutes 0 seconds)
        - "2:30" for 2 minutes 30 seconds
        - "15:45" for 15 minutes 45 seconds
        - "42:10" for 42 minutes 10 seconds

        Return the response in this exact JSON format:
        {{
            "title": "Descriptive title of the video content",
            "summary": "Comprehensive summary of the content...",
            "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
            "segments": [
                {{
                    "segment_no": 1,
                    "start_time": "0:00",
                    "end_time": "2:30",
                    "title": "Introduction",
                    "summary": "This segment introduces the main topic and presents the key learning objectives shown on screen...",
                    "keywords": ["intro", "overview", "topic"],
                    "transcript": "Welcome everyone. Today we're going to learn about..."
                }},
                {{
                    "segment_no": 2,
                    "start_time": "2:30",
                    "end_time": "5:15",
                    "title": "Main Content",
                    "summary": "Explains the core concept with diagrams and examples displayed on screen while the instructor narrates...",
                    "keywords": ["main", "detail", "explanation"],
                    "transcript": "As you can see in this diagram, the process works by..."
                }},
                {{
                    "segment_no": 3,
                    "start_time": "5:15",
                    "end_time": "8:00",
                    "title": "Conclusion",
                    "summary": "Summarizes the key takeaways presented in bullet points on screen...",
                    "keywords": ["conclusion", "summary", "recap"],
                    "transcript": "To summarize what we've learned today..."
                }}
            ]
        }}

        Remember:
        - The entire analysis MUST be in {source_language.upper()} language.
        - Use MM:SS format for all time values (e.g., "0:00", "2:30", "15:45").
        - Choose 2-10 segments based on the video content structure.
        - **TRANSCRIPT vs SUMMARY distinction:**
          * transcript: ONLY spoken audio (narration/speech) - DO NOT include screen text
          * summary: Comprehensive understanding using BOTH visual (screen text, slides) AND audio
        - Each segment must have its own transcript - the full video transcript will be reconstructed by combining all segment transcripts.
        """

    def _parse_analysis_response(self, response_text: str) -> dict[str, Any]:
        """
        Parse Gemini response and extract structured analysis data with transcript and segments.
        Combines segment transcripts to create full transcript.
        """
        try:
            import json
            import re

            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                analysis_data = json.loads(json_str)

                # Validate required fields
                if "title" not in analysis_data or "summary" not in analysis_data:
                    logger.warning("Missing required fields in Vertex AI response")
                    return self._create_fallback_analysis(response_text)

                # Ensure segments have required fields
                if "segments" in analysis_data:
                    validated_segments = []
                    for seg in analysis_data["segments"]:
                        if all(key in seg for key in ["segment_no", "start_time", "end_time", "title"]):
                            # Add default values for optional fields
                            seg.setdefault("summary", "")
                            seg.setdefault("transcript", "")
                            seg.setdefault("keywords", [])
                            validated_segments.append(seg)
                    analysis_data["segments"] = validated_segments

                    # Combine all segment transcripts to create full transcript
                    full_transcript = " ".join(
                        seg.get("transcript", "").strip()
                        for seg in validated_segments
                        if seg.get("transcript")
                    )
                    analysis_data["transcript"] = full_transcript
                    logger.info(f"Combined transcript from {len(validated_segments)} segments: {len(full_transcript)} chars")
                else:
                    # If no segments provided, create empty list
                    analysis_data["segments"] = []
                    analysis_data["transcript"] = ""

                # Decode HTML entities in all text fields
                from app.core.text_utils import decode_html_entities_in_dict
                analysis_data = decode_html_entities_in_dict(analysis_data)

                logger.info(f"Successfully parsed Vertex AI response with {len(analysis_data.get('segments', []))} segments")
                return analysis_data
            else:
                logger.warning("Could not parse JSON from Gemini response, using fallback.")
                return self._create_fallback_analysis(response_text)

        except Exception as e:
            logger.error(f"Failed to parse analysis response: {str(e)}", exc_info=True)
            return self._create_fallback_analysis(response_text)

    def _create_fallback_analysis(self, response_text: str) -> dict[str, Any]:
        """
        Create fallback analysis structure when JSON parsing fails.
        """
        return {
            "title": "Analysis Failed",
            "summary": response_text,
            "keywords": [],
            "transcript": "",
            "segments": [],
            "fallback_used": True
        }


# Global Vertex AI service instance
vertex_ai_service = VertexAIService()
