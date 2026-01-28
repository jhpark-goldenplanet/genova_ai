"""
AI services orchestrator that coordinates Vertex AI and Translation services.
"""

import logging
from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_config import ai_client_manager
from app.core.exceptions import ErrorCodes, VideoProcessingException
from app.services.gcs_service import gcs_service
from app.services.translation_service import translation_service
from app.services.genai_service import genai_service
from app.services.video_service import VideoService
from app.utils.caption_parser import CaptionSegment

logger = logging.getLogger(__name__)


class AIOrchestrator:
    """
    Orchestrates all AI services for comprehensive video analysis.
    """

    def __init__(self):
        self.genai = genai_service
        self.translation = translation_service

    async def process_video_with_ai(
        self,
        video_id: UUID,
        video_path: str,
        session: AsyncSession,
        source_language: Optional[str] = "ko",
    ) -> dict[str, Any]:
        """
        Process video with Vertex AI and return analysis results (no translation).

        Args:
            video_id: Unique video identifier
            video_path: Path to the local video file for non-Vertex AI services
            session: The database session for fetching video metadata
            source_language: Source language of the video content (ko, en, etc.)

        Returns:
            Dictionary containing AI analysis results in source language only

        Raises:
            VideoProcessingException: If AI processing fails
        """
        try:
            logger.info(f"Starting GenAI processing for video {video_id} (source language: {source_language})")

            # Import video status service for progress updates
            from app.services.video_status_service import video_status_service

            results = {
                "video_id": str(video_id),
                "video_path": video_path,
                "source_language": source_language,
                "processing_steps": [],
            }

            # Update progress: AI analysis starting (55%)
            await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 55)

            # Step 1: Video Analysis with GenAI (includes transcript and segments)
            logger.info("Step 1: Analyzing video content with GenAI (includes transcript and segments)")
            try:
                video_service = VideoService(session)
                video = await video_service.get_video_by_id(video_id)
                if not video or not video.gcs_path:
                    raise VideoProcessingException(
                        ErrorCodes.VIDEO_NOT_FOUND,
                        "Video or GCS path not found in database for GenAI analysis.",
                    )

                gcs_uri = f"gs://{gcs_service.bucket_name}/{video.gcs_path}"
                analysis_result = await self.genai.analyze_video(
                    gcs_uri,
                    source_language=source_language,
                    duration_seconds=video.duration_seconds
                )
                results["analysis"] = analysis_result

                # Extract transcript from GenAI result
                genai_transcript = analysis_result.get("transcript", "")
                genai_segments = analysis_result.get("segments", [])

                # Create transcription result from GenAI
                results["transcription"] = {
                    "transcript": genai_transcript,
                    "confidence": 0.95,  # GenAI typically has high confidence
                    "language": source_language,
                    "source": "genai",
                    "words": []  # GenAI doesn't provide word-level timing
                }

                results["processing_steps"].append(
                    {
                        "step": "genai_analysis",
                        "status": "completed",
                        "timestamp": self._get_timestamp(),
                        "transcript_provided": bool(genai_transcript),
                        "segments_provided": len(genai_segments)
                    }
                )
                logger.info(f"GenAI analysis completed: transcript={len(genai_transcript)} chars, {len(genai_segments)} segments")

                # Update progress: GenAI analysis completed (70%)
                await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 70)
            except Exception as e:
                logger.error(f"GenAI analysis failed for video {video_id}: {str(e)}")
                results["analysis"] = self._create_fallback_analysis()
                results["transcription"] = self._create_fallback_transcription()
                results["processing_steps"].append(
                    {
                        "step": "genai_analysis",
                        "status": "failed",
                        "error": str(e),
                        "timestamp": self._get_timestamp(),
                    }
                )

            # DEBUG: Dump after genai_analysis
            self._dump_step_result(video_id, "genai_analysis", results["analysis"])

            # Step 2: Create Final Consolidated Results (no translation)
            logger.info(f"Step 2: Consolidating final results")

            # Update progress: Consolidating results (75%)
            await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 75)

            final_results = await self._consolidate_results(results, None)

            logger.info(f"AI processing completed successfully for video {video_id}")
            return final_results

        except Exception as e:
            logger.error(f"AI orchestration failed for video {video_id}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"AI processing failed: {str(e)}"
            )

    async def process_video_segments_with_ai(
        self,
        video_id: UUID,
        video_path: str,
        segments: list[dict[str, Any]],
        target_language: Optional[str] = None,
        full_transcription: Optional[dict[str, Any]] = None
    ) -> list[dict[str, Any]]:
        """
        Process video segments with AI services for detailed segment analysis (no translation).

        Args:
            video_id: Unique video identifier
            video_path: Path to the video file
            segments: List of video segments to analyze
            target_language: Not used (kept for compatibility)
            full_transcription: Full video transcription with segments (optional)

        Returns:
            List of segments with AI analysis results in source language only
        """
        try:
            logger.info(f"🚀 Processing {len(segments)} segments with AI in PARALLEL for video {video_id}")

            # Process all segments in parallel using asyncio.gather
            import asyncio

            async def process_single_segment(segment: dict[str, Any], index: int) -> dict[str, Any]:
                """Process a single segment with all AI enhancements."""
                try:
                    logger.info(f"Processing segment {index+1}/{len(segments)}")
                    enhanced_segment = segment.copy()

                    # Get segment timing
                    start_time = self._parse_time_to_seconds(segment.get("start_time", "0:00:00"))
                    end_time = self._parse_time_to_seconds(segment.get("end_time", "0:00:00"))

                    # Transcribe segment audio if not already available
                    if not segment.get("scripts"):
                        # First try to get from full_transcription if available
                        if full_transcription and full_transcription.get("words"):
                            matching_text = self._extract_text_from_words(
                                full_transcription["words"],
                                start_time,
                                end_time
                            )
                            if matching_text:
                                enhanced_segment["scripts"] = matching_text
                                enhanced_segment["transcription_confidence"] = full_transcription.get("confidence", 0.0)
                                logger.info(f"Segment {index+1} scripts populated from full transcription words")

                        # If still no scripts, leave empty (Vertex AI should have provided transcript)
                        if not enhanced_segment.get("scripts"):
                            logger.warning(f"Segment {index+1} has no transcript - Vertex AI may not have provided it")
                            enhanced_segment["scripts"] = ""
                            enhanced_segment["transcription_confidence"] = 0.0

                    # Enhance segment analysis if needed (summary and keywords in one call)
                    needs_summary = not segment.get("summary") or len(segment.get("summary", "")) < 50
                    needs_keywords = not segment.get("keywords") or len(segment.get("keywords", [])) == 0

                    if (needs_summary or needs_keywords) and enhanced_segment.get("scripts"):
                        analysis_result = await self._analyze_segment_content(
                            enhanced_segment["scripts"],
                            segment.get("title", f"Segment {index+1}"),
                            needs_summary=needs_summary,
                            needs_keywords=needs_keywords
                        )

                        if needs_summary and analysis_result.get("summary"):
                            enhanced_segment["summary"] = analysis_result["summary"]

                        if needs_keywords and analysis_result.get("keywords"):
                            enhanced_segment["keywords"] = analysis_result["keywords"]

                    logger.info(f"✓ Completed segment {index+1}/{len(segments)}")
                    return enhanced_segment

                except Exception as e:
                    logger.error(f"Segment {index+1} processing failed: {str(e)}")
                    # Return original segment with error info
                    error_segment = segment.copy()
                    error_segment["processing_error"] = str(e)
                    return error_segment

            # Process all segments in parallel
            enhanced_segments = await asyncio.gather(
                *[process_single_segment(seg, i) for i, seg in enumerate(segments)],
                return_exceptions=False
            )

            logger.info(f"✓ Parallel segment processing completed for video {video_id}: {len(enhanced_segments)} segments")

            # DEBUG: Dump segment processing results
            try:
                import json
                from pathlib import Path
                temp_dir = Path("/tmp")
                temp_dir.mkdir(exist_ok=True)

                segments_file = temp_dir / f"{video_id}_segments_enhanced.json"
                with open(segments_file, "w", encoding="utf-8") as f:
                    json.dump({
                        "video_id": str(video_id),
                        "original_segments": segments,
                        "enhanced_segments": list(enhanced_segments),
                        "full_transcription_available": full_transcription is not None,
                        "full_transcription_has_words": full_transcription.get("words") is not None if full_transcription else False,
                        "word_count": len(full_transcription.get("words", [])) if full_transcription else 0
                    }, f, indent=2, ensure_ascii=False, default=str)
                logger.info(f"DEBUG: Dumped segment results to {segments_file}")
            except Exception as dump_error:
                logger.warning(f"Failed to dump segment debug data: {str(dump_error)}")

            return list(enhanced_segments)

        except Exception as e:
            logger.error(f"Segment AI processing failed for video {video_id}: {str(e)}")
            return segments  # Return original segments if processing fails

    async def _create_enhanced_analysis(
        self, 
        video_analysis: dict[str, Any], 
        transcription: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Create enhanced analysis by combining video and audio analysis.

        Args:
            video_analysis: Results from Vertex AI video analysis
            transcription: Results from Speech-to-Text

        Returns:
            Enhanced analysis combining both sources
        """
        try:
            enhanced = video_analysis.copy()

            # Enhance summary with transcript insights
            if transcription.get("transcript") and len(transcription["transcript"]) > 100:
                # Extract key phrases from transcript
                transcript_keywords = await self._extract_keywords_from_text(
                    transcription["transcript"]
                )
                
                # Merge keywords
                existing_keywords = set(enhanced.get("keywords", []))
                new_keywords = set(transcript_keywords[:5])  # Top 5 from transcript
                enhanced["keywords"] = list(existing_keywords.union(new_keywords))[:10]

                # Enhance summary with transcript context
                if len(enhanced.get("summary", "")) < 200:
                    enhanced["summary"] = await self._enhance_summary_with_transcript(
                        enhanced.get("summary", ""), transcription["transcript"]
                    )

            # Add transcription metadata
            enhanced["transcription_available"] = bool(transcription.get("transcript"))
            enhanced["transcription_confidence"] = transcription.get("confidence", 0.0)
            enhanced["transcription_language"] = transcription.get("language", "unknown")
            enhanced["audio_duration"] = transcription.get("duration_seconds", 0.0)

            return enhanced

        except Exception as e:
            logger.error(f"Enhanced analysis creation failed: {str(e)}")
            return video_analysis

    async def _consolidate_results(
        self,
        processing_results: dict[str, Any],
        target_language: Optional[str]
    ) -> dict[str, Any]:
        """
        Consolidate AI processing results into final structure (source language only).

        Args:
            processing_results: All processing results
            target_language: Not used (kept for compatibility)

        Returns:
            Consolidated final results with source language data only
        """
        try:
            # Get original analysis from Vertex AI
            original_analysis = processing_results.get("analysis", {})
            original_transcription = processing_results.get("transcription", {})
            source_language = processing_results.get("source_language", "ko")

            # Clean transcription data: remove words arrays
            cleaned_transcription = self._clean_transcription_data(original_transcription)

            consolidated = {
                "video_id": processing_results["video_id"],
                "processing_completed": True,
                "source_language": source_language,

                # Main analysis results (original language only)
                "title": original_analysis.get("title", "Video Analysis"),
                "summary": original_analysis.get("summary", ""),
                "keywords": original_analysis.get("keywords", []),
                "main_topics": original_analysis.get("main_topics", []),
                "educational_level": original_analysis.get("educational_level", "unknown"),
                "subject_area": original_analysis.get("subject_area", "general"),

                # Segments from Vertex AI (for segmentation step)
                "segments": original_analysis.get("segments", []),

                # Transcription results (cleaned - no duplicate transcript, no words)
                "transcript": original_transcription.get("transcript", ""),
                "transcription_confidence": original_transcription.get("confidence", 0.0),
                "transcription_language": original_transcription.get("language", "unknown"),
                "transcription": cleaned_transcription,  # Keep cleaned transcription

                # Processing metadata
                "processing_steps": processing_results.get("processing_steps", []),
                "ai_services_used": self._get_services_used(processing_results),
                "processing_timestamp": self._get_timestamp(),

                # Quality metrics
                "analysis_quality": self._calculate_analysis_quality(original_analysis, original_transcription),

                # Raw results for separate storage (will be stored in raw_results column)
                "raw_results": {
                    "vertex_ai": processing_results.get("analysis"),
                    "speech_to_text": processing_results.get("transcription")
                }
            }

            # DEBUG: Dump all processing results to /tmp for debugging
            try:
                import json
                from pathlib import Path
                video_id_str = str(processing_results["video_id"])
                temp_dir = Path("/tmp")
                temp_dir.mkdir(exist_ok=True)

                # Save complete processing results
                dump_file = temp_dir / f"{video_id_str}_complete_processing.json"
                with open(dump_file, "w", encoding="utf-8") as f:
                    json.dump(processing_results, f, indent=2, ensure_ascii=False, default=str)

                # Save consolidated results
                consolidated_file = temp_dir / f"{video_id_str}_consolidated.json"
                with open(consolidated_file, "w", encoding="utf-8") as f:
                    json.dump(consolidated, f, indent=2, ensure_ascii=False, default=str)

                logger.info(f"DEBUG: Dumped processing results to {dump_file} and {consolidated_file}")
            except Exception as dump_error:
                logger.warning(f"Failed to dump debug data: {str(dump_error)}")

            return consolidated

        except Exception as e:
            logger.error(f"Results consolidation failed: {str(e)}")
            return {
                "video_id": processing_results.get("video_id", "unknown"),
                "processing_completed": False,
                "error": str(e),
                "processing_timestamp": self._get_timestamp()
            }

    def _clean_transcription_data(self, transcription: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        """
        Clean transcription data by removing words array and transcript to reduce size.

        The transcript field should only exist at the top level, not in the transcription object.
        The words array is removed from analysis_result but kept in raw_results.

        Args:
            transcription: Original transcription data

        Returns:
            Cleaned transcription without words array and transcript field
        """
        if not transcription:
            return None

        try:
            cleaned = transcription.copy()

            # Remove words array (it's large and stored in raw_results)
            if "words" in cleaned:
                del cleaned["words"]

            # Remove transcript field (it should only be at top level, not in transcription object)
            if "transcript" in cleaned:
                del cleaned["transcript"]

            return cleaned

        except Exception as e:
            logger.warning(f"Failed to clean transcription data: {str(e)}")
            return transcription

    def _create_fallback_analysis(self) -> dict[str, Any]:
        """Create fallback analysis when Vertex AI fails."""
        return {
            "title": "Video Analysis",
            "summary": "Analysis not available due to processing error",
            "keywords": [],
            "main_topics": [],
            "educational_level": "unknown",
            "subject_area": "general",
            "fallback_used": True
        }

    def _create_fallback_transcription(self) -> dict[str, Any]:
        """Create fallback transcription when Speech-to-Text fails."""
        return {
            "transcript": "",
            "confidence": 0.0,
            "language": "unknown",
            "duration_seconds": 0.0,
            "segments": [],
            "words": [],
            "transcription_failed": True
        }

    async def _analyze_segment_content(
        self,
        transcript: str,
        title: str,
        needs_summary: bool = True,
        needs_keywords: bool = True
    ) -> dict[str, Any]:
        """
        Analyze segment content to extract summary and keywords in a single AI call.

        Args:
            transcript: Segment transcript text
            title: Segment title
            needs_summary: Whether to generate summary
            needs_keywords: Whether to extract keywords

        Returns:
            Dictionary with 'summary' and 'keywords' fields
        """
        try:
            if not transcript or len(transcript) < 20:
                return {
                    "summary": f"Summary not available for {title}",
                    "keywords": []
                }

            # Use Vertex AI with function calling to analyze in one call
            try:
                from vertexai.generative_models import (
                    GenerativeModel,
                    FunctionDeclaration,
                    Tool,
                    Content,
                    Part
                )
                import os

                # Get model name from environment or use default
                model_name = os.getenv("VERTEX_AI_MODEL", "gemini-2.5-pro")

                # Define function declaration for segment analysis
                analyze_segment_func = FunctionDeclaration(
                    name="analyze_video_segment",
                    description="비디오 세그먼트의 스크립트를 분석하여 요약과 키워드를 추출합니다.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "summary": {
                                "type": "string",
                                "description": "세그먼트의 핵심 내용을 2-3문장으로 간결하게 요약한 텍스트"
                            },
                            "keywords": {
                                "type": "array",
                                "description": "세그먼트의 핵심 키워드 5-8개 (단어나 짧은 구문)",
                                "items": {
                                    "type": "string"
                                }
                            }
                        },
                        "required": ["summary", "keywords"]
                    }
                )

                # Create tool with the function
                analysis_tool = Tool(
                    function_declarations=[analyze_segment_func]
                )

                # Build prompt
                prompt = f"""다음 비디오 세그먼트의 스크립트를 분석해주세요.

스크립트:
{transcript[:1500]}

요구사항:
- summary: 세그먼트의 핵심 내용을 2-3문장으로 간결하게 요약
- keywords: 5-8개의 핵심 키워드를 추출 (단어나 짧은 구문)

analyze_video_segment 함수를 호출하여 결과를 반환해주세요."""

                # Create model with tools
                model = GenerativeModel(
                    model_name,
                    tools=[analysis_tool]
                )

                # Generation config for segment analysis
                from vertexai.generative_models import GenerationConfig

                generation_config = GenerationConfig()

                # Generate content with function calling
                response = model.generate_content(prompt, generation_config=generation_config)

                # Extract function call result
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if part.function_call and part.function_call.name == "analyze_video_segment":
                                args = dict(part.function_call.args)
                                return {
                                    "summary": args.get("summary", ""),
                                    "keywords": list(args.get("keywords", []))
                                }

                # If no function call found, try text response
                if response and response.text:
                    logger.warning("No function call in response, parsing text")
                    return {"summary": response.text[:200], "keywords": []}

            except Exception as ai_error:
                logger.warning(f"AI segment analysis failed, using fallback: {str(ai_error)}")

            # Fallback: use simple extraction methods
            result = {}

            if needs_summary:
                # Simple extractive summary
                sentences = transcript.split('.')
                summary_sentences = []
                char_count = 0

                for sentence in sentences[:5]:
                    sentence = sentence.strip()
                    if sentence and len(sentence) > 10:
                        summary_sentences.append(sentence)
                        char_count += len(sentence)
                        if char_count > 150 or len(summary_sentences) >= 2:
                            break

                if summary_sentences:
                    result["summary"] = '. '.join(summary_sentences) + '.'
                else:
                    result["summary"] = transcript[:200] + ("..." if len(transcript) > 200 else "")

            if needs_keywords:
                # Simple keyword extraction for Korean/English
                import re
                from collections import Counter

                korean_words = re.findall(r'[가-힣]{2,}', transcript)
                english_words = re.findall(r'\b[A-Za-z]{4,}\b', transcript.lower())

                korean_stop_words = {
                    '것', '수', '등', '및', '이', '그', '저', '때', '곳', '말', '점',
                    '위', '중', '내', '또', '또한', '그리고', '하지만', '그러나', '따라서',
                    '있습니다', '합니다', '됩니다', '입니다', '해야', '필요', '때문', '통해'
                }

                english_stop_words = {
                    'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
                    'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when'
                }

                filtered_korean = [w for w in korean_words if w not in korean_stop_words and len(w) > 1]
                filtered_english = [w for w in english_words if w not in english_stop_words and len(w) > 3]

                all_words = filtered_korean + filtered_english
                word_counts = Counter(all_words)
                result["keywords"] = [word for word, count in word_counts.most_common(8)]

            return result

        except Exception as e:
            logger.error(f"Segment content analysis failed: {str(e)}")
            return {
                "summary": f"Summary not available for {title}",
                "keywords": []
            }

    async def _generate_segment_summary(self, transcript: str, title: str) -> str:
        """Generate summary for a segment based on its transcript."""
        try:
            if not transcript or len(transcript) < 20:
                return f"Summary not available for {title}"

            # Use Vertex AI to generate a proper summary
            try:
                from google.cloud import aiplatform
                from vertexai.generative_models import GenerativeModel

                prompt = f"""다음 비디오 세그먼트의 스크립트를 간결하게 요약해주세요. 2-3문장으로 핵심 내용만 추출해주세요.

스크립트:
{transcript[:1000]}

요약:"""

                from vertexai.generative_models import GenerationConfig

                generation_config = GenerationConfig()

                model = GenerativeModel(ai_client_manager.config.vertex_model_name)
                response = model.generate_content(prompt, generation_config=generation_config)

                if response and response.text:
                    return response.text.strip()
            except Exception as ai_error:
                logger.warning(f"AI summary generation failed, using fallback: {str(ai_error)}")

            # Fallback: Simple extractive summary - take first 2-3 meaningful sentences
            sentences = transcript.split('.')
            summary_sentences = []
            char_count = 0

            for sentence in sentences[:5]:  # Check first 5 sentences
                sentence = sentence.strip()
                if sentence and len(sentence) > 10:
                    summary_sentences.append(sentence)
                    char_count += len(sentence)
                    if char_count > 150 or len(summary_sentences) >= 2:
                        break

            if summary_sentences:
                return '. '.join(summary_sentences) + '.'

            return transcript[:200] + ("..." if len(transcript) > 200 else "")

        except Exception as e:
            logger.error(f"Segment summary generation failed: {str(e)}")
            return f"Summary not available for {title}"

    async def _extract_segment_keywords(self, text: str) -> list[str]:
        """Extract keywords from segment text."""
        try:
            return await self._extract_keywords_from_text(text)
        except Exception:
            return []

    async def _extract_keywords_from_text(self, text: str) -> list[str]:
        """Extract keywords from text using AI or simple frequency analysis."""
        try:
            if not text or len(text) < 20:
                return []

            # Use Vertex AI to extract keywords
            try:
                from vertexai.generative_models import GenerativeModel

                prompt = f"""다음 텍스트에서 핵심 키워드 5-8개를 추출해주세요. 단어나 짧은 구문 형태로, 쉼표로 구분해서 나열해주세요.

텍스트:
{text[:800]}

키워드:"""

                from vertexai.generative_models import GenerationConfig

                generation_config = GenerationConfig()

                model = GenerativeModel(ai_client_manager.config.vertex_model_name)
                response = model.generate_content(prompt, generation_config=generation_config)

                if response and response.text:
                    # Parse keywords from response
                    keywords_text = response.text.strip()
                    keywords = [kw.strip() for kw in keywords_text.split(',')]
                    # Clean up and limit to 8 keywords
                    keywords = [kw for kw in keywords if kw and len(kw) > 1][:8]
                    if keywords:
                        return keywords
            except Exception as ai_error:
                logger.warning(f"AI keyword extraction failed, using fallback: {str(ai_error)}")

            # Fallback: Simple frequency analysis for both Korean and English
            import re
            from collections import Counter

            # Extract words (both English and Korean)
            # Korean: 2+ characters, English: 4+ characters
            korean_words = re.findall(r'[가-힣]{2,}', text)
            english_words = re.findall(r'\b[A-Za-z]{4,}\b', text.lower())

            # Korean stopwords
            korean_stop_words = {
                '것', '수', '등', '및', '이', '그', '저', '때', '곳', '말', '점',
                '위', '중', '내', '또', '또한', '그리고', '하지만', '그러나', '따라서',
                '있습니다', '합니다', '됩니다', '입니다', '해야', '필요', '때문', '통해'
            }

            # English stopwords
            english_stop_words = {
                'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
                'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
                'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over',
                'such', 'take', 'than', 'them', 'well', 'were', 'what'
            }

            # Filter words
            filtered_korean = [word for word in korean_words if word not in korean_stop_words and len(word) > 1]
            filtered_english = [word for word in english_words if word not in english_stop_words and len(word) > 3]

            # Combine and count
            all_words = filtered_korean + filtered_english
            word_counts = Counter(all_words)

            # Get most common words
            keywords = [word for word, count in word_counts.most_common(8)]

            return keywords

        except Exception:
            return []

    async def _enhance_summary_with_transcript(self, original_summary: str, transcript: str) -> str:
        """Enhance summary using transcript content."""
        try:
            if not transcript or len(transcript) < 50:
                return original_summary

            # If original summary is very short, use transcript beginning
            if len(original_summary) < 100:
                transcript_start = transcript[:300]
                return f"{original_summary} {transcript_start}..."[:400]
            
            return original_summary

        except Exception:
            return original_summary

    def _parse_time_to_seconds(self, time_str: str) -> float:
        """
        Parse time string to seconds. Supports MM:SS and HH:MM:SS formats.

        Examples:
            "0:00" -> 0.0
            "2:30" -> 150.0
            "15:45" -> 945.0
            "00:02:30" -> 150.0
        """
        try:
            if not time_str:
                return 0.0

            time_str = time_str.strip()

            if ':' in time_str:
                parts = time_str.split(':')
                if len(parts) == 3:  # HH:MM:SS format
                    return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
                elif len(parts) == 2:  # MM:SS format (preferred)
                    return float(parts[0]) * 60 + float(parts[1])

            # Fallback: assume it's just seconds
            return float(time_str)
        except (ValueError, IndexError, AttributeError):
            logger.warning(f"Failed to parse time string: {time_str}")
            return 0.0

    def _extract_text_from_words(
        self,
        words: list[dict[str, Any]],
        start_time: float,
        end_time: float
    ) -> Optional[str]:
        """
        Extract text from words that fall within the specified time range.

        Args:
            words: List of word objects with 'word', 'start_time', 'end_time' fields
            start_time: Video segment start time in seconds
            end_time: Video segment end time in seconds

        Returns:
            Combined text from words within the time range, or None if no words found
        """
        matching_words = []

        for word_obj in words:
            word_start = word_obj.get("start_time", 0)
            word_end = word_obj.get("end_time", 0)

            # Include word if it overlaps with the segment time range
            # Overlap occurs if: word_start < end_time AND word_end > start_time
            if word_start < end_time and word_end > start_time:
                word_text = word_obj.get("word", "").strip()
                if word_text:
                    matching_words.append(word_text)

        if matching_words:
            # Combine all words and clean up spacing
            combined = " ".join(matching_words)
            # Remove duplicate spaces and clean up
            combined = " ".join(combined.split())
            return combined

        return None

    def _get_services_used(self, results: dict[str, Any]) -> list[str]:
        """Get list of AI services that were successfully used."""
        services = []

        if results.get("analysis") and not results["analysis"].get("fallback_used"):
            services.append("vertex_ai")

        if results.get("transcription") and not results["transcription"].get("transcription_failed"):
            services.append("speech_to_text")

        if results.get("translated_analysis") or results.get("translated_transcription"):
            services.append("translation")

        return services

    def _dump_step_result(self, video_id: Any, step_name: str, result_data: dict[str, Any]) -> None:
        """
        Dump processing step result to /tmp for debugging.

        Args:
            video_id: Video UUID
            step_name: Name of the processing step
            result_data: Result data to dump
        """
        try:
            import json
            from pathlib import Path

            temp_dir = Path("/tmp")
            temp_dir.mkdir(exist_ok=True)

            dump_file = temp_dir / f"{video_id}_step_{step_name}.json"

            with open(dump_file, "w", encoding="utf-8") as f:
                json.dump({
                    "video_id": str(video_id),
                    "step": step_name,
                    "timestamp": self._get_timestamp(),
                    "result": result_data
                }, f, indent=2, ensure_ascii=False, default=str)

            logger.info(f"DEBUG: Dumped {step_name} result to {dump_file}")
        except Exception as e:
            logger.warning(f"Failed to dump {step_name} result: {str(e)}")

    def _calculate_analysis_quality(
        self, 
        analysis: dict[str, Any], 
        transcription: dict[str, Any]
    ) -> dict[str, Any]:
        """Calculate quality metrics for the analysis."""
        try:
            quality_score = 0.0
            quality_factors = []

            # Analysis quality factors
            if analysis.get("title") and len(analysis["title"]) > 10:
                quality_score += 0.2
                quality_factors.append("title_available")

            if analysis.get("summary") and len(analysis["summary"]) > 100:
                quality_score += 0.3
                quality_factors.append("comprehensive_summary")

            if analysis.get("keywords") and len(analysis["keywords"]) >= 3:
                quality_score += 0.2
                quality_factors.append("keywords_extracted")

            # Transcription quality factors
            if transcription.get("transcript") and len(transcription["transcript"]) > 50:
                quality_score += 0.2
                quality_factors.append("transcription_available")

            if transcription.get("confidence", 0) > 0.7:
                quality_score += 0.1
                quality_factors.append("high_transcription_confidence")

            return {
                "overall_score": min(quality_score, 1.0),
                "quality_factors": quality_factors,
                "analysis_completeness": len(quality_factors) / 5.0
            }

        except Exception:
            return {
                "overall_score": 0.0,
                "quality_factors": [],
                "analysis_completeness": 0.0
            }

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        from datetime import datetime
        return datetime.utcnow().isoformat()

    async def suggest_num_segments(self, duration: float) -> int:
        """
        Suggest the optimal number of segments for a video based on its duration.

        Args:
            duration: Video duration in seconds

        Returns:
            Suggested number of segments
        """
        if duration <= 60:
            return 1
        elif duration <= 300:
            return int(duration / 60)
        elif duration <= 600:
            return 5
        else:
            return 10

    async def process_youtube_video_with_captions(
        self,
        video_id: UUID,
        video_path: str,
        caption_segments: List[CaptionSegment],
        source_language: str,
        session: AsyncSession,
    ) -> dict[str, Any]:
        """
        Process YouTube video using captions for transcription and video analysis for segmentation.

        Workflow:
        1. Use video analysis (Vertex AI) to extract segment timings only
        2. Use caption segments for full transcript
        3. Extract caption text for each video segment based on timing
        4. Use LLM to generate summaries and keywords from caption text

        Args:
            video_id: Unique video identifier
            video_path: Path to the local video file
            caption_segments: Parsed caption segments with timestamps
            source_language: Source language of the video content
            session: Database session

        Returns:
            Dictionary containing AI analysis results based on captions

        Raises:
            VideoProcessingException: If processing fails
        """
        try:
            logger.info(
                f"Starting YouTube caption-based processing for video {video_id} "
                f"(source language: {source_language}, {len(caption_segments)} caption segments)"
            )

            # Import video status service for progress updates
            from app.services.video_status_service import video_status_service

            results = {
                "video_id": str(video_id),
                "video_path": video_path,
                "source_language": source_language,
                "processing_steps": [],
            }

            # Generate full transcript from captions
            from app.utils.caption_parser import CaptionParser
            full_transcript = CaptionParser.get_full_transcript(caption_segments)

            logger.info(f"Generated full transcript from captions: {len(full_transcript)} characters")

            # Update progress: AI analysis starting (55%)
            await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 55)

            # Step 1: Analyze video with Vertex AI to get SEGMENT TIMINGS ONLY
            logger.info("Step 1: Analyzing video with Vertex AI for segment timing extraction")
            try:
                video_service = VideoService(session)
                video = await video_service.get_video_by_id(video_id)
                if not video or not video.gcs_path:
                    raise VideoProcessingException(
                        ErrorCodes.VIDEO_NOT_FOUND,
                        "Video or GCS path not found in database for GenAI analysis.",
                    )

                gcs_uri = f"gs://{gcs_service.bucket_name}/{video.gcs_path}"

                # Use GenAI service to extract segment timings
                video_segments = await self.genai.extract_segment_timings(
                    gcs_uri,
                    source_language,
                    duration_seconds=video.duration_seconds
                )

                logger.info(f"Extracted {len(video_segments)} segment timings from video")

                # Update progress: Video segmentation completed (65%)
                await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 65)

            except Exception as e:
                logger.error(f"Video segment extraction failed for video {video_id}: {str(e)}")
                # Fallback: Create default segments based on duration
                video_segments = self._create_fallback_segments(video.duration_seconds if video else 600)
                logger.warning(f"Using fallback segmentation: {len(video_segments)} segments")

            # Step 2: Extract caption text for each video segment
            logger.info("Step 2: Extracting caption text for each video segment")
            for i, segment in enumerate(video_segments):
                start_time = self._parse_time_to_seconds(segment["start_time"])
                end_time = self._parse_time_to_seconds(segment["end_time"])

                # Extract caption text for this segment's time range
                segment_text = CaptionParser.get_segment_by_time(
                    caption_segments, start_time, end_time
                )
                video_segments[i]["scripts"] = segment_text
                logger.info(
                    f"Segment {i+1}: {segment['start_time']} - {segment['end_time']}, "
                    f"{len(segment_text)} characters"
                )

            # Update progress: Caption extraction completed (70%)
            await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 70)

            # Step 3: Generate summaries and keywords using GenAI
            logger.info("Step 3: Generating summaries and keywords from captions")
            analysis_result = await self.genai.generate_caption_analysis(
                full_transcript=full_transcript,
                segments=video_segments,
                source_language=source_language,
            )

            results["analysis"] = analysis_result
            results["transcription"] = {
                "transcript": full_transcript,
                "confidence": 0.95,  # YouTube captions are generally high quality
                "language": source_language,
                "source": "youtube_captions",
                "words": [],  # Caption segments don't provide word-level timing
            }

            results["processing_steps"].append(
                {
                    "step": "youtube_caption_based_analysis",
                    "status": "completed",
                    "timestamp": self._get_timestamp(),
                    "caption_segments_count": len(caption_segments),
                    "video_segments_count": len(video_segments),
                }
            )

            # Update progress: Analysis completed (75%)
            await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 75)

            # Step 4: Consolidate results
            logger.info("Step 4: Consolidating final results")
            final_results = await self._consolidate_results(results, None)

            logger.info(f"YouTube caption-based processing completed successfully for video {video_id}")
            return final_results

        except Exception as e:
            logger.error(f"YouTube caption-based processing failed for video {video_id}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED, f"YouTube caption processing failed: {str(e)}"
            )

    async def _extract_segment_timings_from_video(
        self, gcs_uri: str, source_language: str
    ) -> List[dict[str, Any]]:
        """
        Extract segment timing information from video using Vertex AI.
        Only extracts start_time, end_time, and title - no summaries or transcripts.

        Args:
            gcs_uri: GCS URI of the video
            source_language: Source language for analysis

        Returns:
            List of segment dictionaries with timing and title only
        """
        try:
            from vertexai.generative_models import GenerativeModel, Part
            import os

            model_name = os.getenv("VERTEX_AI_MODEL", "gemini-2.5-pro")
            model = GenerativeModel(model_name)

            # Specialized prompt for segment timing extraction only
            prompt = f"""Analyze this video and divide it into logical segments based on content structure.

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
- Ensure segments cover the entire video duration
- No overlapping segments
- Language: {source_language}

**CRITICAL - Segment Timing Precision Rules:**
- Start time of first segment MUST be "0:00"
- End time of LAST segment MUST match the exact last frame of the video
- NEVER use placeholder terms like "end" or estimated values for end times
- Each segment's end_time must be a valid timestamp (e.g., "10:30"), not an approximation
- Ensure NO gaps or overlaps between segments
- Cross-check the final segment's end time with the total video duration for absolute accuracy

Return ONLY the JSON array, no additional text."""

            # Generate content with generation config
            from vertexai.generative_models import GenerationConfig

            generation_config = GenerationConfig()

            video_part = Part.from_uri(gcs_uri, mime_type="video/mp4")
            response = model.generate_content(
                [prompt, video_part],
                generation_config=generation_config
            )

            if not response or not response.text:
                raise ValueError("Empty response from Vertex AI")

            # Parse JSON response
            import json
            import re

            response_text = response.text.strip()

            # Extract JSON array from response
            json_match = re.search(r'\[[\s\S]*\]', response_text)
            if json_match:
                segments = json.loads(json_match.group())
            else:
                segments = json.loads(response_text)

            # Validate segments structure
            if not segments or not isinstance(segments, list):
                raise ValueError("Invalid segments structure")

            logger.info(f"Extracted {len(segments)} segment timings from video")
            return segments

        except Exception as e:
            logger.error(f"Failed to extract segment timings from video: {str(e)}")
            raise

    async def _generate_caption_based_analysis(
        self,
        full_transcript: str,
        segments: List[dict[str, Any]],
        source_language: str,
    ) -> dict[str, Any]:
        """
        Generate comprehensive analysis using captions and segment information.

        Args:
            full_transcript: Full video transcript from captions
            segments: Video segments with timing and caption text
            source_language: Source language

        Returns:
            Analysis results with summaries and keywords
        """
        try:
            from vertexai.generative_models import GenerativeModel
            import os
            import json

            model_name = os.getenv("SUMMARIZATION_MODEL", "gemini-2.5-flash")
            model = GenerativeModel(model_name)

            # Build segments summary for prompt
            segments_info = []
            for seg in segments:
                segments_info.append({
                    "segment_no": seg.get("segment_no"),
                    "time": f"{seg.get('start_time')} - {seg.get('end_time')}",
                    "title": seg.get("title"),
                    "scripts": seg.get("scripts", "")[:500]  # Limit for prompt size
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

            # Generate with config
            from vertexai.generative_models import GenerationConfig

            generation_config = GenerationConfig(
                max_output_tokens=int(os.getenv("SUMMARIZATION_MAX_OUTPUT_TOKENS", "20000")),
                response_mime_type="application/json",
            )

            response = model.generate_content(prompt, generation_config=generation_config)

            if not response or not response.text:
                raise ValueError("Empty response from Vertex AI")

            # Parse JSON response
            import re
            response_text = response.text.strip()

            # Extract JSON from response
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
                    seg["class_type"] = self._classify_segment_type(i, len(segments))
                    seg["source_language"] = source_language
                    seg["confidence_score"] = 0.95
                    seg["source"] = "youtube_captions"

            # Build final analysis result
            result = {
                "title": analysis.get("title", "Video Analysis"),
                "summary": analysis.get("summary", ""),
                "keywords": analysis.get("keywords", []),
                "segments": segments,
                "transcript": full_transcript,
                "model_used": model_name,
                "source_language": source_language,
            }

            logger.info("Caption-based analysis completed successfully")
            return result

        except Exception as e:
            logger.error(f"Failed to generate caption-based analysis: {str(e)}")
            # Return basic analysis with segments as-is
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

    def _create_fallback_segments(self, duration_seconds: float) -> List[dict[str, Any]]:
        """
        Create fallback segments when video analysis fails.

        Args:
            duration_seconds: Video duration in seconds

        Returns:
            List of basic segment dictionaries
        """
        num_segments = min(5, max(1, int(duration_seconds / 60)))
        segment_duration = duration_seconds / num_segments

        segments = []
        for i in range(num_segments):
            start_time = i * segment_duration
            end_time = min((i + 1) * segment_duration, duration_seconds)

            segments.append({
                "segment_no": i + 1,
                "start_time": self._format_time_mm_ss(start_time),
                "end_time": self._format_time_mm_ss(end_time),
                "title": f"Segment {i + 1}",
                "scripts": "",
            })

        return segments

    def _classify_segment_type(self, index: int, total: int) -> str:
        """Classify segment as introduction, content, or conclusion."""
        if index == 0:
            return "introduction"
        elif index == total - 1:
            return "conclusion"
        else:
            return "content"

    def _format_time_mm_ss(self, seconds: float) -> str:
        """Format seconds to MM:SS format."""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"


# Global AI orchestrator instance
ai_orchestrator = AIOrchestrator()