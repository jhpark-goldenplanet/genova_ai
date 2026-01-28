"""
Google Speech-to-Text service for audio transcription from videos.
"""

import logging
import tempfile
from pathlib import Path
from typing import Any, Optional
import asyncio
import os

import ffmpeg
from google.cloud import speech

from app.core.ai_config import ai_client_manager
from app.core.exceptions import ErrorCodes, VideoProcessingException

logger = logging.getLogger(__name__)


class SpeechToTextService:
    """Service for converting video audio to text using Google Speech-to-Text."""

    def __init__(self):
        self.config = ai_client_manager.config
        self._client: Optional[speech.SpeechClient] = None

    def _get_client(self) -> speech.SpeechClient:
        """Get or create Speech-to-Text client."""
        if self._client is None:
            self._client = ai_client_manager.get_speech_client()
        return self._client

    async def transcribe_video(self, video_path: str) -> dict[str, Any]:
        """
        Transcribe audio from video file to text with timestamps.

        Args:
            video_path: Path to the video file

        Returns:
            Dictionary containing transcription results with timestamps

        Raises:
            VideoProcessingException: If transcription fails
        """
        try:
            logger.info(f"Starting speech-to-text transcription for: {video_path}")

            # Extract audio from video
            audio_path = await self._extract_audio(video_path)
            
            if not audio_path or not Path(audio_path).exists():
                raise VideoProcessingException(
                    ErrorCodes.PROCESSING_FAILED,
                    "Failed to extract audio from video"
                )

            # Detect language and transcribe
            transcription_result = await self._transcribe_audio(audio_path)

            # Cleanup temporary audio file
            Path(audio_path).unlink(missing_ok=True)

            logger.info(f"Speech-to-text transcription completed for: {video_path}")
            return transcription_result

        except VideoProcessingException:
            raise
        except Exception as e:
            logger.error(f"Speech-to-text transcription failed for {video_path}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Speech-to-text transcription failed: {str(e)}"
            )

    async def _extract_audio(self, video_path: str) -> str:
        """
        Extract audio from video file and convert to format suitable for Speech-to-Text.

        Args:
            video_path: Path to the video file

        Returns:
            Path to the extracted audio file
        """
        try:
            # Create temporary file for audio
            temp_dir = Path(tempfile.mkdtemp())
            audio_path = temp_dir / "audio.wav"

            # Extract audio using ffmpeg
            (
                ffmpeg
                .input(video_path)
                .output(
                    str(audio_path),
                    acodec='pcm_s16le',  # 16-bit PCM
                    ac=1,  # Mono channel
                    ar=self.config.speech_sample_rate  # Sample rate
                )
                .overwrite_output()
                .run(quiet=True)
            )

            if not audio_path.exists():
                raise Exception("Audio extraction failed - output file not created")

            logger.debug(f"Audio extracted to: {audio_path}")
            return str(audio_path)

        except Exception as e:
            logger.error(f"Failed to extract audio from video: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Audio extraction failed: {str(e)}"
            )

    async def _transcribe_audio(self, audio_path: str) -> dict[str, Any]:
        """
        Transcribe audio file using Google Speech-to-Text.

        Args:
            audio_path: Path to the audio file

        Returns:
            Transcription results with timestamps and confidence scores
        """
        try:
            client = self._get_client()

            # Get audio duration
            probe_data = ffmpeg.probe(audio_path)
            duration = float(probe_data["format"]["duration"])

            # Read audio file
            with open(audio_path, "rb") as audio_file:
                content = audio_file.read()

            # Try transcription with different language configurations
            transcription_results = []
            
            for language_code in self.config.speech_language_codes:
                try:
                    result = await self._transcribe_with_language(
                        client, content, language_code, audio_path, duration
                    )
                    if result and result.get("transcript"):
                        transcription_results.append({
                            "language": language_code,
                            "confidence": result.get("confidence", 0.0),
                            "result": result
                        })
                except Exception as e:
                    logger.warning(f"Transcription failed for {language_code}: {str(e)}")
                    continue

            # Select best transcription result
            if transcription_results:
                best_result = max(transcription_results, key=lambda x: x["confidence"])
                formatted_result = self._format_transcription_result(best_result)

                # DEBUG: Dump raw Speech-to-Text results
                try:
                    import json
                    import time
                    from pathlib import Path
                    temp_dir = Path("/tmp")
                    temp_dir.mkdir(exist_ok=True)

                    # Use timestamp to create unique identifier (avoid overwriting)
                    timestamp = str(int(time.time() * 1000))  # milliseconds
                    audio_name = Path(audio_path).stem
                    stt_dump_file = temp_dir / f"stt_raw_{audio_name}_{timestamp}.json"

                    with open(stt_dump_file, "w", encoding="utf-8") as f:
                        json.dump({
                            "audio_path": audio_path,
                            "selected_language": best_result["language"],
                            "selected_confidence": best_result["confidence"],
                            "all_language_attempts": [
                                {
                                    "language": r["language"],
                                    "confidence": r["confidence"],
                                    "word_count": len(r["result"].get("words", []))
                                }
                                for r in transcription_results
                            ],
                            "final_transcription": formatted_result
                        }, f, indent=2, ensure_ascii=False, default=str)

                    logger.info(f"DEBUG: Dumped Speech-to-Text results to {stt_dump_file}")
                except Exception as dump_error:
                    logger.warning(f"Failed to dump STT debug data: {str(dump_error)}")

                return formatted_result
            else:
                # Return empty result if all transcriptions failed
                return self._create_empty_transcription_result()

        except Exception as e:
            logger.error(f"Audio transcription failed: {str(e)}")
            return self._create_empty_transcription_result(error=str(e))

    async def _transcribe_with_language(
        self, 
        client: speech.SpeechClient, 
        audio_content: bytes, 
        language_code: str,
        audio_path: str,
        duration: float
    ) -> dict[str, Any]:
        """
        Perform transcription with specific language configuration.

        Args:
            client: Speech-to-Text client
            audio_content: Audio file content
            language_code: Language code for transcription
            audio_path: Path to the audio file
            duration: Duration of the audio file in seconds

        Returns:
            Transcription result for the specified language
        """
        try:
            # Configure recognition settings
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=self.config.speech_sample_rate,
                language_code=language_code,
                enable_automatic_punctuation=True,
                enable_word_time_offsets=True,
                enable_word_confidence=True,
                max_alternatives=1,
                model="latest_long"  # Use latest long-form model
            )

            if duration > 60:
                from app.services.gcs_service import gcs_service
                import uuid

                gcs_path = f"audio_transcripts/{uuid.uuid4()}.wav"
                blob = gcs_service.bucket.blob(gcs_path)
                
                await asyncio.to_thread(
                    blob.upload_from_filename,
                    audio_path
                )
                
                audio = speech.RecognitionAudio(uri=f"gs://{gcs_service.bucket_name}/{gcs_path}")
                operation = client.long_running_recognize(config=config, audio=audio)
                response = operation.result(timeout=900)
            else:
                audio = speech.RecognitionAudio(content=audio_content)
                response = client.recognize(config=config, audio=audio)

            if not response.results:
                return {"transcript": "", "confidence": 0.0, "words": []}

            # Process results
            transcript_parts = []
            word_details = []
            total_confidence = 0.0
            confidence_count = 0

            for result in response.results:
                alternative = result.alternatives[0]
                transcript_parts.append(alternative.transcript)
                
                if hasattr(alternative, 'confidence'):
                    total_confidence += alternative.confidence
                    confidence_count += 1

                # Extract word-level details
                if hasattr(alternative, 'words'):
                    from app.core.text_utils import decode_html_entities
                    for word_info in alternative.words:
                        word_detail = {
                            "word": decode_html_entities(word_info.word),
                            "start_time": self._convert_duration_to_seconds(word_info.start_time),
                            "end_time": self._convert_duration_to_seconds(word_info.end_time),
                            "confidence": getattr(word_info, 'confidence', 0.0)
                        }
                        word_details.append(word_detail)

            # Calculate average confidence
            avg_confidence = total_confidence / confidence_count if confidence_count > 0 else 0.0

            # Decode HTML entities in transcript and words
            from app.core.text_utils import decode_html_entities

            return {
                "transcript": decode_html_entities(" ".join(transcript_parts)),
                "confidence": avg_confidence,
                "words": word_details,
                "language_detected": language_code
            }

        except Exception as e:
            logger.error(f"Transcription with {language_code} failed: {str(e)}")
            raise

    def _convert_duration_to_seconds(self, duration) -> float:
        """Convert Google Duration object to seconds."""
        try:
            return duration.total_seconds()
        except AttributeError:
            # Fallback for different duration formats
            return float(duration.seconds) + float(duration.nanos) / 1e9

    def _format_transcription_result(self, best_result: dict[str, Any]) -> dict[str, Any]:
        """
        Format the best transcription result into standardized structure.

        Args:
            best_result: Best transcription result from language attempts

        Returns:
            Formatted transcription result
        """
        result_data = best_result["result"]

        return {
            "transcript": result_data["transcript"],
            "language": best_result["language"],
            "confidence": result_data["confidence"],
            "word_count": len(result_data["words"]),
            "duration_seconds": self._calculate_audio_duration(result_data["words"]),
            "words": result_data["words"],  # Keep all words with timestamps for segment script extraction
            "processing_info": {
                "model_used": "latest_long",
                "sample_rate": self.config.speech_sample_rate,
                "language_detected": result_data["language_detected"]
            }
        }

    def _create_transcript_segments(self, words: list[dict]) -> list[dict]:
        """
        Create transcript segments for easier navigation and display.

        Args:
            words: List of word details with timestamps

        Returns:
            List of transcript segments with start/end times
        """
        if not words:
            return []

        segments = []
        current_segment = {
            "start_time": words[0]["start_time"],
            "end_time": words[0]["end_time"],
            "text": words[0]["word"],
            "words": [words[0]]
        }

        segment_duration = 30.0  # 30 seconds per segment

        for word in words[1:]:  # Start from second word
            # Check if we should start a new segment
            if (word["start_time"] - current_segment["start_time"]) > segment_duration:
                # Finalize current segment
                if current_segment["text"].strip():
                    segments.append({
                        "start_time": current_segment["start_time"],
                        "end_time": current_segment["end_time"],
                        "text": current_segment["text"]
                    })

                # Start new segment
                current_segment = {
                    "start_time": word["start_time"],
                    "end_time": word["end_time"],
                    "text": word["word"],
                    "words": [word]
                }
            else:
                # Add to current segment
                current_segment["text"] += " " + word["word"]
                current_segment["end_time"] = word["end_time"]
                current_segment["words"].append(word)

        # Add final segment
        if current_segment["text"].strip():
            segments.append({
                "start_time": current_segment["start_time"],
                "end_time": current_segment["end_time"],
                "text": current_segment["text"]
            })

        return segments

    def _calculate_audio_duration(self, words: list[dict]) -> float:
        """Calculate total audio duration from word timestamps."""
        if not words:
            return 0.0
        
        return max(word["end_time"] for word in words)

    def _create_empty_transcription_result(self, error: Optional[str] = None) -> dict[str, Any]:
        """
        Create empty transcription result when transcription fails.

        Args:
            error: Optional error message

        Returns:
            Empty transcription result structure
        """
        return {
            "transcript": "",
            "language": "unknown",
            "confidence": 0.0,
            "word_count": 0,
            "duration_seconds": 0.0,
            "segments": [],
            "words": [],
            "processing_info": {
                "model_used": "latest_long",
                "sample_rate": self.config.speech_sample_rate,
                "language_detected": "unknown",
                "error": error
            },
            "transcription_failed": True
        }

    async def transcribe_audio_segment(
        self, 
        video_path: str, 
        start_time: float, 
        end_time: float
    ) -> dict[str, Any]:
        """
        Transcribe a specific segment of video audio.

        Args:
            video_path: Path to the video file
            start_time: Segment start time in seconds
            end_time: Segment end time in seconds

        Returns:
            Transcription result for the segment
        """
        try:
            logger.debug(f"Transcribing segment {start_time}-{end_time} from {video_path}")

            # Extract audio segment
            temp_dir = Path(tempfile.mkdtemp())
            segment_audio_path = temp_dir / f"segment_{start_time}_{end_time}.wav"

            # Extract specific audio segment
            (
                ffmpeg
                .input(video_path, ss=start_time, t=(end_time - start_time))
                .output(
                    str(segment_audio_path),
                    acodec='pcm_s16le',
                    ac=1,
                    ar=self.config.speech_sample_rate
                )
                .overwrite_output()
                .run(quiet=True)
            )

            # Transcribe segment
            if segment_audio_path.exists():
                result = await self._transcribe_audio(str(segment_audio_path))
                
                # Adjust timestamps to be relative to original video
                if result.get("words"):
                    for word in result["words"]:
                        word["start_time"] += start_time
                        word["end_time"] += start_time

                # Cleanup
                segment_audio_path.unlink(missing_ok=True)
                temp_dir.rmdir()

                return result
            else:
                return self._create_empty_transcription_result("Segment audio extraction failed")

        except Exception as e:
            logger.error(f"Segment transcription failed: {str(e)}")
            return self._create_empty_transcription_result(str(e))


# Global Speech-to-Text service instance
speech_to_text_service = SpeechToTextService()