"""
Google GenAI service for video analysis using Gemini models.
Uses GenAI SDK with API key for GCS video access via signed URLs.
"""

import asyncio
import logging
from typing import Any

from google.genai import types

from app.core.ai_config import ai_client_manager
from app.core.exceptions import ErrorCodes, VideoProcessingException

logger = logging.getLogger(__name__)


class GenAIService:
    """Service for video analysis using Google GenAI SDK."""

    def __init__(self):
        self.model_name = ai_client_manager.config.vertex_model_name
        self.max_retries = 3

    def _get_client(self):
        """Get GenAI client instance."""
        return ai_client_manager.get_genai_client()

    async def _generate_with_retry(self, content: list) -> Any:
        """
        Generate content with retry logic and exponential backoff.

        Args:
            content: Content to send to the model

        Returns:
            Model response

        Raises:
            VideoProcessingException: If all retry attempts fail
        """
        last_exception = None
        client = self._get_client()

        for attempt in range(self.max_retries):
            try:
                logger.info(f"GenAI generation attempt {attempt + 1}/{self.max_retries}")

                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=self.model_name,
                    contents=content,
                )

                if not response or not response.text:
                    raise ValueError("Empty response from GenAI")

                logger.info(f"GenAI generation succeeded on attempt {attempt + 1}")
                return response

            except Exception as e:
                last_exception = e
                logger.warning(
                    f"GenAI request attempt {attempt + 1}/{self.max_retries} failed: {str(e)}"
                )

                if attempt < self.max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"Waiting {wait_time} seconds before retry...")
                    await asyncio.sleep(wait_time)
                    continue

        error_msg = f"All {self.max_retries} attempts failed. Last error: {str(last_exception)}"
        logger.error(error_msg)
        raise VideoProcessingException(
            ErrorCodes.AI_SERVICE_ERROR,
            error_msg
        )

    async def analyze_video(self, gcs_uri: str, source_language: str = "ko", duration_seconds: int = None) -> dict[str, Any]:
        """
        Analyze video content from a GCS URI using Google GenAI SDK.
        Converts GCS URI to signed URL for GenAI access.

        Args:
            gcs_uri: The GCS URI of the video file (e.g., "gs://bucket/video.mp4").
            source_language: Source language of the video content (ko, en, etc.)
            duration_seconds: Total video duration in seconds (required for full coverage)

        Returns:
            Dictionary containing analysis results.

        Raises:
            VideoProcessingException: If analysis fails.
        """
        try:
            logger.info(f"Starting video analysis with GenAI for GCS URI: {gcs_uri}, language: {source_language}, duration: {duration_seconds}s")

            # Extract GCS path from URI and generate signed URL
            from app.services.gcs_service import gcs_service

            if gcs_uri.startswith("gs://"):
                parts = gcs_uri[5:].split("/", 1)
                if len(parts) >= 2:
                    gcs_path = parts[1]
                else:
                    raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
            else:
                raise ValueError(f"Expected GCS URI starting with 'gs://': {gcs_uri}")

            # Generate signed URL for GenAI access
            signed_url = gcs_service.generate_signed_url(gcs_path, expiration_hours=1)

            # Download video and upload to GenAI Files API
            import httpx
            import tempfile
            import os as os_module

            logger.info(f"Downloading video from signed URL...")

            # Download video to temp file
            temp_file_path = None
            try:
                with httpx.Client(timeout=300) as http_client:
                    response = http_client.get(signed_url)
                    response.raise_for_status()

                    # Save to temp file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
                        temp_file.write(response.content)
                        temp_file_path = temp_file.name

                # Upload to GenAI Files API
                client = self._get_client()
                logger.info(f"Uploading video to GenAI Files API...")

                uploaded_file = await asyncio.to_thread(
                    client.files.upload,
                    file=temp_file_path,
                    config={"mime_type": "video/mp4"}
                )

                # Wait for file to become ACTIVE
                max_wait_seconds = 120
                wait_interval = 2
                elapsed = 0

                while elapsed < max_wait_seconds:
                    file_status = await asyncio.to_thread(
                        client.files.get,
                        name=uploaded_file.name
                    )

                    if file_status.state.name == "ACTIVE":
                        logger.info(f"File is now ACTIVE")
                        uploaded_file = file_status
                        break
                    elif file_status.state.name == "FAILED":
                        raise ValueError(f"File processing failed: {file_status.state}")

                    await asyncio.sleep(wait_interval)
                    elapsed += wait_interval

                if elapsed >= max_wait_seconds:
                    raise ValueError(f"File processing timed out after {max_wait_seconds} seconds")

                # Format duration as MM:SS for the prompt
                duration_str = ""
                if duration_seconds:
                    minutes = duration_seconds // 60
                    seconds = duration_seconds % 60
                    duration_str = f"{minutes}:{seconds:02d}"

                # Build prompt with duration requirement
                duration_requirement = ""
                if duration_str:
                    duration_requirement = f"""
**CRITICAL - Video Duration: {duration_str}**
- The LAST segment's end_time MUST be exactly {duration_str}
- Segments MUST cover the ENTIRE video from 0:00 to {duration_str}
- Do NOT stop analysis early - analyze the COMPLETE video"""

                prompt = f"""Analyze this video and provide analysis in JSON format.

Language: {source_language}
{duration_requirement}

Return JSON with this structure:
{{
  "title": "Video title",
  "summary": "Video summary (200-400 words)",
  "keywords": ["keyword1", "keyword2"],
  "segments": [
    {{
      "segment_no": 1,
      "start_time": "0:00",
      "end_time": "2:30",
      "title": "Segment title",
      "summary": "Segment summary",
      "keywords": ["keyword"],
      "transcript": "Spoken words in this segment"
    }}
  ]
}}

Rules:
- Use MM:SS format for timestamps
- First segment MUST start at 0:00
- Last segment MUST end at the exact video duration ({duration_str if duration_str else 'end of video'})
- Create 2-10 segments based on content structure
- Ensure NO gaps between segments - every second must be covered
- transcript: ONLY spoken audio, not screen text"""

                # Generate content using uploaded file
                logger.info(f"Generating analysis using GenAI SDK with uploaded file")
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=self.model_name,
                    contents=[prompt, uploaded_file],
                )

            finally:
                # Clean up temp file
                if temp_file_path and os_module.path.exists(temp_file_path):
                    os_module.remove(temp_file_path)

            if not response or not response.text:
                raise ValueError("Empty response from GenAI")

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

    async def extract_segment_timings(self, gcs_uri: str, source_language: str = "ko", duration_seconds: int = None) -> list[dict[str, Any]]:
        """
        Extract segment timing information from video using GenAI SDK.

        Args:
            gcs_uri: GCS URI of the video
            source_language: Source language for analysis
            duration_seconds: Total video duration in seconds (required for full coverage)

        Returns:
            List of segment dictionaries with timing and title
        """
        try:
            from app.services.gcs_service import gcs_service
            import json
            import re

            logger.info(f"Extracting segment timings from: {gcs_uri}, duration: {duration_seconds}s")

            # Convert GCS URI to signed URL
            if gcs_uri.startswith("gs://"):
                parts = gcs_uri[5:].split("/", 1)
                if len(parts) >= 2:
                    gcs_path = parts[1]
                else:
                    raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
            else:
                raise ValueError(f"Expected GCS URI starting with 'gs://': {gcs_uri}")

            signed_url = gcs_service.generate_signed_url(gcs_path, expiration_hours=1)

            # Format duration as MM:SS for the prompt
            duration_str = ""
            if duration_seconds:
                minutes = duration_seconds // 60
                seconds = duration_seconds % 60
                duration_str = f"{minutes}:{seconds:02d}"

            # Build duration requirement
            duration_requirement = ""
            if duration_str:
                duration_requirement = f"""
**CRITICAL - Video Duration: {duration_str}**
- The LAST segment's end_time MUST be exactly {duration_str}
- Segments MUST cover the ENTIRE video from 0:00 to {duration_str}
- Do NOT stop analysis early - analyze the COMPLETE video"""

            prompt = f"""Analyze this video and divide it into logical segments based on content structure.
{duration_requirement}

IMPORTANT: Provide ONLY the timing information and segment titles. Do NOT generate summaries or transcripts.

Divide the video into 3-8 segments based on natural content breaks (introduction, main topics, conclusion).

Return ONLY a JSON array with this format:
[
  {{
    "segment_no": 1,
    "start_time": "0:00",
    "end_time": "2:30",
    "title": "Introduction"
  }},
  ...
]

Requirements:
- Use MM:SS format for timestamps
- Provide descriptive titles for each segment (20-50 characters)
- First segment MUST start at 0:00
- Last segment MUST end at exactly {duration_str if duration_str else 'the end of video'}
- Ensure NO gaps between segments - every second must be covered
- No overlapping segments
- Language: {source_language}

Return ONLY the JSON array, no additional text."""

            video_part = types.Part.from_uri(file_uri=signed_url, mime_type="video/mp4")

            client = self._get_client()
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model_name,
                contents=[prompt, video_part],
            )

            if not response or not response.text:
                raise ValueError("Empty response from GenAI")

            response_text = response.text.strip()
            json_match = re.search(r'\[[\s\S]*\]', response_text)
            if json_match:
                segments = json.loads(json_match.group())
            else:
                segments = json.loads(response_text)

            if not segments or not isinstance(segments, list):
                raise ValueError("Invalid segments structure")

            logger.info(f"Extracted {len(segments)} segment timings from video")
            return segments

        except Exception as e:
            logger.error(f"Failed to extract segment timings: {str(e)}")
            raise

    async def generate_caption_analysis(
        self,
        full_transcript: str,
        segments: list[dict[str, Any]],
        source_language: str,
    ) -> dict[str, Any]:
        """
        Generate analysis from captions and segment information using GenAI SDK.

        Args:
            full_transcript: Full video transcript from captions
            segments: Video segments with timing and caption text
            source_language: Source language

        Returns:
            Analysis results with summaries and keywords
        """
        try:
            import json
            import re
            import os

            logger.info("Generating caption-based analysis with GenAI SDK")

            segments_info = []
            for seg in segments:
                segments_info.append({
                    "segment_no": seg.get("segment_no"),
                    "time": f"{seg.get('start_time')} - {seg.get('end_time')}",
                    "title": seg.get("title"),
                    "scripts": seg.get("scripts", "")[:500]
                })

            prompt = f"""Analyze this video based on the transcript and segment information provided.

FULL TRANSCRIPT:
{full_transcript[:3000]}

SEGMENTS:
{json.dumps(segments_info, ensure_ascii=False, indent=2)}

Generate a comprehensive analysis in {source_language} with the following structure:
{{
  "title": "Video title (50-100 characters)",
  "summary": "Comprehensive video summary (200-400 words)",
  "keywords": ["keyword1", "keyword2", ...],  // 5-10 keywords
  "segments": [
    {{
      "segment_no": 1,
      "summary": "2-3 sentence summary of this segment",
      "keywords": ["keyword1", "keyword2", ...]  // 3-5 keywords for this segment
    }},
    ...
  ]
}}

Return ONLY the JSON object, no additional text."""

            client = self._get_client()

            summarization_model = os.getenv("SUMMARIZATION_MODEL", self.model_name)

            response = await asyncio.to_thread(
                client.models.generate_content,
                model=summarization_model,
                contents=[prompt],
            )

            if not response or not response.text:
                raise ValueError("Empty response from GenAI")

            response_text = response.text.strip()
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                analysis = json.loads(json_match.group())
            else:
                analysis = json.loads(response_text)

            # Merge segment analysis back into segment objects
            analysis_segments = analysis.get("segments", [])
            for i, seg in enumerate(segments):
                if i < len(analysis_segments):
                    seg["summary"] = analysis_segments[i].get("summary", "")
                    seg["keywords"] = analysis_segments[i].get("keywords", [])
                    seg["source_language"] = source_language
                    seg["confidence_score"] = 0.95
                    seg["source"] = "youtube_captions"

            result = {
                "title": analysis.get("title", "Video Analysis"),
                "summary": analysis.get("summary", ""),
                "keywords": analysis.get("keywords", []),
                "segments": segments,
                "transcript": full_transcript,
                "model_used": summarization_model,
                "source_language": source_language,
            }

            logger.info("Caption-based analysis completed successfully")
            return result

        except Exception as e:
            logger.error(f"Failed to generate caption-based analysis: {str(e)}")
            return {
                "title": "Video Analysis",
                "summary": full_transcript[:400] if full_transcript else "",
                "keywords": [],
                "segments": segments,
                "transcript": full_transcript,
                "model_used": "fallback",
                "source_language": source_language,
                "error": str(e),
            }

    def _parse_analysis_response(self, response_text: str) -> dict[str, Any]:
        """
        Parse Gemini response and extract structured analysis data with transcript and segments.
        """
        try:
            import json
            import re

            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                analysis_data = json.loads(json_str)

                if "title" not in analysis_data or "summary" not in analysis_data:
                    logger.warning("Missing required fields in GenAI response")
                    return self._create_fallback_analysis(response_text)

                if "segments" in analysis_data:
                    validated_segments = []
                    for seg in analysis_data["segments"]:
                        if all(key in seg for key in ["segment_no", "start_time", "end_time", "title"]):
                            seg.setdefault("summary", "")
                            seg.setdefault("transcript", "")
                            seg.setdefault("keywords", [])
                            validated_segments.append(seg)
                    analysis_data["segments"] = validated_segments

                    full_transcript = " ".join(
                        seg.get("transcript", "").strip()
                        for seg in validated_segments
                        if seg.get("transcript")
                    )
                    analysis_data["transcript"] = full_transcript
                    logger.info(f"Combined transcript from {len(validated_segments)} segments: {len(full_transcript)} chars")
                else:
                    analysis_data["segments"] = []
                    analysis_data["transcript"] = ""

                from app.core.text_utils import decode_html_entities_in_dict
                analysis_data = decode_html_entities_in_dict(analysis_data)

                logger.info(f"Successfully parsed GenAI response with {len(analysis_data.get('segments', []))} segments")
                return analysis_data
            else:
                logger.warning("Could not parse JSON from GenAI response, using fallback.")
                return self._create_fallback_analysis(response_text)

        except Exception as e:
            logger.error(f"Failed to parse analysis response: {str(e)}", exc_info=True)
            return self._create_fallback_analysis(response_text)

    def _create_fallback_analysis(self, response_text: str) -> dict[str, Any]:
        """Create fallback analysis structure when JSON parsing fails."""
        return {
            "title": "Analysis Failed",
            "summary": response_text,
            "keywords": [],
            "transcript": "",
            "segments": [],
            "fallback_used": True
        }


# Global GenAI service instance
genai_service = GenAIService()
