"""
Video segmentation and analysis service for automatic video splitting and content analysis.
"""

import logging
import tempfile
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

import ffmpeg

from app.core.exceptions import ErrorCodes, VideoProcessingException
from app.services.ai_orchestrator_service import ai_orchestrator

logger = logging.getLogger(__name__)


class VideoSegmentationService:
    """
    Service for video segmentation, metadata extraction, and segment analysis.
    """

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "genova_segmentation"
        self.temp_dir.mkdir(exist_ok=True)

    async def extract_video_metadata(self, video_path: str) -> dict[str, Any]:
        """
        Extract comprehensive video metadata using FFmpeg.

        Args:
            video_path: Path to the video file

        Returns:
            Dictionary containing video metadata

        Raises:
            VideoProcessingException: If metadata extraction fails
        """
        try:
            logger.info(f"Extracting video metadata from {video_path}")

            # Use ffmpeg.probe to get detailed video information
            probe_data = ffmpeg.probe(video_path)

            # Extract video stream information
            video_streams = [
                stream for stream in probe_data["streams"] if stream["codec_type"] == "video"
            ]
            audio_streams = [
                stream for stream in probe_data["streams"] if stream["codec_type"] == "audio"
            ]

            if not video_streams:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_FILE_FORMAT,
                    "No video streams found in the file"
                )

            video_stream = video_streams[0]
            audio_stream = audio_streams[0] if audio_streams else None

            # Extract basic metadata
            duration = float(video_stream.get("duration", 0))
            if duration == 0 and "format" in probe_data:
                duration = float(probe_data["format"].get("duration", 0))

            width = int(video_stream.get("width", 0))
            height = int(video_stream.get("height", 0))
            fps = self._parse_frame_rate(video_stream.get("r_frame_rate", "0/1"))
            bitrate = int(video_stream.get("bit_rate", 0))

            # Calculate total frames
            total_frames = int(duration * fps) if fps > 0 else 0

            # Extract format information
            format_info = probe_data.get("format", {})
            file_size = int(format_info.get("size", 0))
            format_name = format_info.get("format_name", "unknown")

            metadata = {
                "duration_seconds": duration,
                "width": width,
                "height": height,
                "fps": fps,
                "total_frames": total_frames,
                "bitrate": bitrate,
                "file_size_bytes": file_size,
                "format_name": format_name,
                "video_codec": video_stream.get("codec_name", "unknown"),
                "pixel_format": video_stream.get("pix_fmt", "unknown"),
                "has_audio": bool(audio_stream),
                "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
                "audio_sample_rate": int(audio_stream.get("sample_rate", 0)) if audio_stream else 0,
                "audio_channels": int(audio_stream.get("channels", 0)) if audio_stream else 0,
                "aspect_ratio": f"{width}:{height}" if width and height else "unknown",
                "video_quality": self._determine_video_quality(width, height),
                "estimated_segments": min(5, max(1, int(duration / 60)))  # 1 segment per minute, max 5
            }

            logger.info(f"Successfully extracted metadata: duration={duration}s, resolution={width}x{height}")
            return metadata

        except ffmpeg.Error as e:
            logger.error(f"FFmpeg error during metadata extraction: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to extract video metadata: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error during metadata extraction: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Metadata extraction failed: {str(e)}"
            )

    async def generate_video_segments(
        self,
        video_id: UUID,
        video_path: str,
        metadata: dict[str, Any],
        ai_analysis: Optional[dict[str, Any]] = None,
        transcription: Optional[dict[str, Any]] = None
    ) -> list[dict[str, Any]]:
        """
        Generate video segments using AI analysis results or automatic segmentation.

        Args:
            video_id: Unique video identifier
            video_path: Path to the video file
            metadata: Video metadata from extract_video_metadata
            ai_analysis: Optional AI analysis results (may include segments from Vertex AI)
            transcription: Optional transcription results

        Returns:
            List of video segments with analysis

        Raises:
            VideoProcessingException: If segmentation fails
        """
        try:
            logger.info(f"Generating segments for video {video_id}")

            duration = metadata.get("duration_seconds", 0)
            if duration <= 0:
                raise VideoProcessingException(
                    ErrorCodes.PROCESSING_FAILED,
                    "Invalid video duration for segmentation"
                )

            # Check if Vertex AI provided segments
            if ai_analysis and ai_analysis.get("segments"):
                vertex_segments = ai_analysis["segments"]
                source_language = ai_analysis.get("source_language", "ko")
                logger.info(f"Using {len(vertex_segments)} segments from Vertex AI (source language: {source_language})")

                # Convert Vertex AI segments to our format
                base_segments = []
                for seg in vertex_segments:
                    start_seconds = self._parse_time_to_seconds(seg.get("start_time", "00:00:00"))
                    end_seconds = self._parse_time_to_seconds(seg.get("end_time", "00:00:00"))

                    # Convert time to HH:MM:SS format required by schema
                    start_time_formatted = self._format_time_hh_mm_ss(start_seconds)
                    end_time_formatted = self._format_time_hh_mm_ss(end_seconds)

                    segment = {
                        "segment_no": seg.get("segment_no", len(base_segments) + 1),
                        "start_time": start_time_formatted,
                        "end_time": end_time_formatted,
                        "duration_seconds": end_seconds - start_seconds,
                        "title": seg.get("title", f"Segment {seg.get('segment_no', len(base_segments) + 1)}"),
                        "summary": seg.get("summary", ""),
                        "keywords": seg.get("keywords", []),
                        "scripts": seg.get("scripts") or seg.get("transcript", ""),
                        "source_language": source_language,
                        "class_type": self._classify_segment_position(
                            seg.get("segment_no", 1) - 1,
                            len(vertex_segments)
                        ),
                        "confidence_score": 0.95,  # Vertex AI segments have high confidence
                        "source": "vertex_ai"
                    }
                    base_segments.append(segment)

                logger.info(f"Converted {len(base_segments)} segments from Vertex AI format")

            else:
                # Fallback to duration-based segmentation if Vertex AI didn't provide segments
                logger.info("Vertex AI segments not available, using duration-based segmentation")

                # Determine optimal number of segments
                if ai_analysis and "optimal_segments" in ai_analysis:
                    num_segments = int(ai_analysis["optimal_segments"])
                else:
                    num_segments = min(5, max(1, int(duration / 60)))  # 1 segment per minute, max 5

                segment_duration = duration / num_segments
                logger.info(f"Creating {num_segments} segments of ~{segment_duration:.1f}s each")

                base_segments = []
                for i in range(num_segments):
                    start_time = i * segment_duration
                    end_time = min((i + 1) * segment_duration, duration)

                    segment = {
                        "segment_no": i + 1,
                        "start_time": self._format_time_hh_mm_ss(start_time),
                        "end_time": self._format_time_hh_mm_ss(end_time),
                        "duration_seconds": end_time - start_time,
                        "title": f"Segment {i + 1}",
                        "summary": "",
                        "keywords": [],
                        "scripts": "",
                        "class_type": self._classify_segment_position(i, num_segments),
                        "confidence_score": 0.0,
                        "source": "duration_based"
                    }
                    base_segments.append(segment)

            # Only enhance with AI if segments need additional processing
            # (Vertex AI segments already have most of the data)
            if base_segments and base_segments[0].get("source") != "vertex_ai":
                logger.info("Enhancing segments with AI")
                enhanced_segments = await ai_orchestrator.process_video_segments_with_ai(
                    video_id=video_id,
                    video_path=video_path,
                    segments=base_segments,
                    target_language="en",  # or get from request
                    full_transcription=transcription
                )
            else:
                logger.info("Using Vertex AI segments without additional AI enhancement")
                enhanced_segments = base_segments

            logger.info(f"Successfully generated {len(enhanced_segments)} segments for video {video_id}")
            return enhanced_segments

        except Exception as e:
            logger.error(f"Segment generation failed for video {video_id}: {str(e)}")
            # Return single segment covering entire video as fallback
            return self._create_fallback_segment(metadata)

    async def analyze_segment_content(
        self, 
        video_path: str, 
        segment: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Analyze individual segment content for enhanced metadata.

        Args:
            video_path: Path to the video file
            segment: Segment information

        Returns:
            Enhanced segment with analysis results
        """
        try:
            logger.info(f"Analyzing content for segment {segment['segment_no']}")

            enhanced_segment = segment.copy()
            start_seconds = self._parse_time_to_seconds(segment["start_time"])
            end_seconds = self._parse_time_to_seconds(segment["end_time"])

            # Extract key frames from segment for visual analysis
            key_frames = await self._extract_segment_keyframes(
                video_path, start_seconds, end_seconds
            )
            enhanced_segment["key_frames_count"] = len(key_frames)

            # Analyze visual content if frames available
            if key_frames:
                visual_analysis = await self._analyze_visual_content(key_frames)
                enhanced_segment.update(visual_analysis)

            # Calculate segment complexity score
            enhanced_segment["complexity_score"] = self._calculate_segment_complexity(
                enhanced_segment
            )

            # Determine segment importance
            enhanced_segment["importance_score"] = self._calculate_segment_importance(
                enhanced_segment, segment["segment_no"]
            )

            return enhanced_segment

        except Exception as e:
            logger.warning(f"Segment analysis failed: {str(e)}")
            return segment

    def _parse_frame_rate(self, frame_rate_str: str) -> float:
        """Parse frame rate string like '30/1' to float."""
        try:
            if "/" in frame_rate_str:
                numerator, denominator = frame_rate_str.split("/")
                return float(numerator) / float(denominator)
            return float(frame_rate_str)
        except (ValueError, ZeroDivisionError):
            return 0.0

    def _determine_video_quality(self, width: int, height: int) -> str:
        """Determine video quality based on resolution."""
        if width >= 3840 and height >= 2160:
            return "4K"
        elif width >= 1920 and height >= 1080:
            return "1080p"
        elif width >= 1280 and height >= 720:
            return "720p"
        elif width >= 854 and height >= 480:
            return "480p"
        else:
            return "low"

    def _classify_segment_position(self, index: int, total_segments: int) -> str:
        """Classify segment based on its position in the video."""
        if index == 0:
            return "introduction"
        elif index == total_segments - 1:
            return "conclusion"
        else:
            return "content"

    def _format_time(self, seconds: float) -> str:
        """Format seconds to MM:SS string (up to 45 minutes max)."""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"

    def _format_time_hh_mm_ss(self, seconds: float) -> str:
        """Format seconds to HH:MM:SS string for schema compliance."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

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

            if ":" in time_str:
                parts = time_str.split(":")
                if len(parts) == 3:  # HH:MM:SS format
                    return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
                elif len(parts) == 2:  # MM:SS format (preferred)
                    return float(parts[0]) * 60 + float(parts[1])

            # Fallback: assume it's just seconds
            return float(time_str)
        except (ValueError, IndexError, AttributeError):
            logger.warning(f"Failed to parse time string: {time_str}")
            return 0.0

    def _extract_segment_transcript(
        self, 
        transcript_segments: list[dict], 
        start_time: float, 
        end_time: float
    ) -> str:
        """Extract transcript text for a specific time segment."""
        try:
            segment_text = []
            
            for transcript_segment in transcript_segments:
                # Check if transcript segment overlaps with our video segment
                transcript_start = transcript_segment.get("start_time", 0)
                transcript_end = transcript_segment.get("end_time", 0)
                
                if (transcript_start < end_time and transcript_end > start_time):
                    text = transcript_segment.get("text", "").strip()
                    if text:
                        segment_text.append(text)
            
            return " ".join(segment_text)
        
        except Exception as e:
            logger.warning(f"Failed to extract segment transcript: {str(e)}")
            return ""

    def _calculate_segment_confidence(
        self, 
        transcript_segments: list[dict], 
        start_time: float, 
        end_time: float
    ) -> float:
        """Calculate average confidence for transcript segments in time range."""
        try:
            confidences = []
            
            for transcript_segment in transcript_segments:
                transcript_start = transcript_segment.get("start_time", 0)
                transcript_end = transcript_segment.get("end_time", 0)
                
                if (transcript_start < end_time and transcript_end > start_time):
                    confidence = transcript_segment.get("confidence", 0.0)
                    confidences.append(confidence)
            
            return sum(confidences) / len(confidences) if confidences else 0.0
        
        except Exception:
            return 0.0

    async def _enhance_segment_with_ai(
        self, 
        segment: dict[str, Any], 
        ai_analysis: dict[str, Any], 
        video_path: str
    ) -> dict[str, Any]:
        """Enhance segment using AI analysis results."""
        try:
            enhanced = {}
            
            # Generate segment-specific summary if transcript available
            if segment.get("scripts") and len(segment["scripts"]) > 20:
                enhanced["summary"] = await self._generate_ai_segment_summary(
                    segment["scripts"], segment["class_type"]
                )
                
                # Extract keywords from segment transcript
                enhanced["keywords"] = await self._extract_ai_keywords(
                    segment["scripts"]
                )
            
            # Use overall analysis to enhance segment
            if ai_analysis.get("keywords"):
                # Add relevant keywords from overall analysis
                overall_keywords = ai_analysis["keywords"][:3]  # Top 3 from overall
                segment_keywords = enhanced.get("keywords", [])
                combined_keywords = list(set(segment_keywords + overall_keywords))
                enhanced["keywords"] = combined_keywords[:5]  # Max 5 keywords per segment
            
            return enhanced
        
        except Exception as e:
            logger.warning(f"AI segment enhancement failed: {str(e)}")
            return {}

    async def _generate_ai_segment_summary(self, transcript: str, segment_type: str) -> str:
        """Generate AI-powered summary for segment."""
        try:
            # Simple extractive summary for now
            sentences = transcript.split(". ")
            if not sentences:
                return f"Content summary not available for {segment_type} segment"
            
            # Take first meaningful sentence, limited to 200 characters
            summary = sentences[0].strip()
            if len(summary) > 200:
                summary = summary[:197] + "..."
            
            return summary or f"Summary not available for {segment_type} segment"
        
        except Exception:
            return f"Summary not available for {segment_type} segment"

    async def _extract_ai_keywords(self, text: str) -> list[str]:
        """Extract keywords from text using simple frequency analysis."""
        try:
            if not text or len(text) < 20:
                return []

            import re
            from collections import Counter

            # Simple keyword extraction
            words = re.findall(r'\b[A-Za-z가-힣]{3,}\b', text.lower())
            
            # Filter out common words
            stop_words = {
                'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
                'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
                'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over',
                'such', 'take', 'than', 'them', 'well', 'were', 'what', 'about',
                '그리고', '하지만', '그래서', '또한', '그런데', '그러나', '따라서'
            }
            
            filtered_words = [word for word in words if word not in stop_words and len(word) > 2]
            
            # Get most common words
            word_counts = Counter(filtered_words)
            keywords = [word for word, count in word_counts.most_common(5)]
            
            return keywords

        except Exception:
            return []

    def _generate_fallback_summary(
        self, 
        segment: dict[str, Any], 
        segment_num: int, 
        total_segments: int
    ) -> str:
        """Generate fallback summary when AI analysis is not available."""
        segment_type = segment.get("class_type", "content")
        duration = segment.get("duration_seconds", 0)
        
        if segment_type == "introduction":
            return f"Introduction segment covering the first {duration:.0f} seconds of the video"
        elif segment_type == "conclusion":
            return f"Conclusion segment covering the final {duration:.0f} seconds of the video"
        else:
            return f"Content segment {segment_num} of {total_segments}, duration: {duration:.0f} seconds"

    def _generate_fallback_keywords(
        self, 
        segment: dict[str, Any], 
        ai_analysis: Optional[dict[str, Any]]
    ) -> list[str]:
        """Generate fallback keywords when extraction fails."""
        keywords = []
        
        # Use overall analysis keywords if available
        if ai_analysis and ai_analysis.get("keywords"):
            keywords.extend(ai_analysis["keywords"][:3])
        
        # Add segment-type specific keywords
        segment_type = segment.get("class_type", "content")
        if segment_type == "introduction":
            keywords.extend(["introduction", "overview"])
        elif segment_type == "conclusion":
            keywords.extend(["conclusion", "summary"])
        else:
            keywords.extend(["content", "main"])
        
        return list(set(keywords))[:5]  # Remove duplicates, max 5

    def _create_fallback_segment(self, metadata: dict[str, Any]) -> list[dict[str, Any]]:
        """Create single fallback segment when segmentation fails."""
        duration = metadata.get("duration_seconds", 0)
        
        return [{
            "segment_no": 1,
            "start_time": "00:00:00",
            "end_time": self._format_time(duration),
            "duration_seconds": duration,
            "title": "Complete Video",
            "summary": "Complete video content - segmentation not available",
            "keywords": ["video", "content"],
            "scripts": "",
            "class_type": "content",
            "confidence_score": 0.0,
            "fallback_segment": True
        }]

    async def _extract_segment_keyframes(
        self, 
        video_path: str, 
        start_seconds: float, 
        end_seconds: float
    ) -> list[str]:
        """Extract key frames from video segment for analysis."""
        try:
            # For now, return empty list - can be enhanced later with actual frame extraction
            # This would involve using ffmpeg to extract frames at specific timestamps
            return []
        except Exception as e:
            logger.warning(f"Key frame extraction failed: {str(e)}")
            return []

    async def _analyze_visual_content(self, key_frames: list[str]) -> dict[str, Any]:
        """Analyze visual content of key frames."""
        try:
            # Placeholder for visual analysis - can be enhanced with computer vision
            return {
                "visual_complexity": "medium",
                "scene_changes": len(key_frames),
                "dominant_colors": ["unknown"]
            }
        except Exception:
            return {}

    def _calculate_segment_complexity(self, segment: dict[str, Any]) -> float:
        """Calculate complexity score for segment based on available data."""
        try:
            score = 0.0
            
            # Text complexity
            scripts = segment.get("scripts", "")
            if scripts:
                word_count = len(scripts.split())
                score += min(word_count / 100, 0.5)  # Max 0.5 for text
            
            # Keyword diversity
            keywords = segment.get("keywords", [])
            score += min(len(keywords) / 10, 0.3)  # Max 0.3 for keywords
            
            # Duration factor
            duration = segment.get("duration_seconds", 0)
            if duration > 60:  # Longer segments might be more complex
                score += 0.2
            
            return min(score, 1.0)
        
        except Exception:
            return 0.5  # Default medium complexity

    def _calculate_segment_importance(self, segment: dict[str, Any], segment_no: int) -> float:
        """Calculate importance score for segment."""
        try:
            score = 0.0
            
            # Position-based importance
            segment_type = segment.get("class_type", "content")
            if segment_type == "introduction":
                score += 0.4
            elif segment_type == "conclusion":
                score += 0.3
            else:
                score += 0.2
            
            # Content-based importance
            scripts = segment.get("scripts", "")
            if len(scripts) > 100:  # Substantial content
                score += 0.3
            
            keywords_count = len(segment.get("keywords", []))
            score += min(keywords_count / 10, 0.3)
            
            return min(score, 1.0)
        
        except Exception:
            return 0.5  # Default medium importance


# Global video segmentation service instance
video_segmentation_service = VideoSegmentationService()