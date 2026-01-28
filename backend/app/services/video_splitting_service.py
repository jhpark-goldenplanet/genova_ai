"""
Video splitting service for creating downloadable video segments.
"""

import asyncio
import base64
import io
import os
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import ffmpeg
from PIL import Image

from app.core.exceptions import ErrorCodes, VideoProcessingException
from app.services.gcs_service import GCSService


class VideoSplittingService:
    """Service for splitting videos into segments and generating download URLs."""

    def __init__(self, gcs_service: Optional[GCSService] = None):
        """
        Initialize video splitting service.

        Args:
            gcs_service: GCS service instance for file operations
        """
        self.gcs_service = gcs_service or GCSService()
        self.max_concurrent_jobs = int(os.getenv('MAX_CONCURRENT_JOBS', '3'))

    def _parse_time_to_seconds(self, time_str: str) -> float:
        """
        Parse time string (HH:MM:SS) to seconds.

        Args:
            time_str: Time in HH:MM:SS format

        Returns:
            Time in seconds as float
        """
        try:
            parts = time_str.split(":")
            if len(parts) != 3:
                raise ValueError("Invalid time format")
            
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = int(parts[2])
            
            return hours * 3600 + minutes * 60 + seconds
        except (ValueError, IndexError) as e:
            raise VideoProcessingException(
                ErrorCodes.INVALID_REQUEST,
                f"Invalid time format '{time_str}'. Expected HH:MM:SS format."
            )

    def _seconds_to_time_str(self, seconds: float) -> str:
        """
        Convert seconds to time string (HH:MM:SS).

        Args:
            seconds: Time in seconds

        Returns:
            Time string in HH:MM:SS format
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def _validate_segments(self, segments: List[dict], video_duration: float) -> None:
        """
        Validate segment data for splitting.

        Args:
            segments: List of segment dictionaries
            video_duration: Total video duration in seconds

        Raises:
            VideoProcessingException: If validation fails
        """
        if not segments:
            raise VideoProcessingException(
                ErrorCodes.INVALID_REQUEST,
                "At least one segment must be provided"
            )

        if len(segments) > 10:
            raise VideoProcessingException(
                ErrorCodes.INVALID_REQUEST,
                "Maximum 10 segments allowed"
            )

        for i, segment in enumerate(segments):
            # Check required fields
            if "start_time" not in segment or "end_time" not in segment:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_REQUEST,
                    f"Segment {i + 1}: start_time and end_time are required"
                )

            # Parse and validate times
            start_seconds = self._parse_time_to_seconds(segment["start_time"])
            end_seconds = self._parse_time_to_seconds(segment["end_time"])

            if start_seconds >= end_seconds:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_REQUEST,
                    f"Segment {i + 1}: start_time must be before end_time"
                )

            if start_seconds < 0 or end_seconds > video_duration:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_REQUEST,
                    f"Segment {i + 1}: times must be within video duration (0 to {self._seconds_to_time_str(video_duration)})"
                )

            # Check for overlaps with previous segments
            for j, other_segment in enumerate(segments[:i]):
                other_start = self._parse_time_to_seconds(other_segment["start_time"])
                other_end = self._parse_time_to_seconds(other_segment["end_time"])

                if not (end_seconds <= other_start or start_seconds >= other_end):
                    raise VideoProcessingException(
                        ErrorCodes.INVALID_REQUEST,
                        f"Segment {i + 1} overlaps with segment {j + 1}"
                    )

    def _get_video_duration(self, video_path: str) -> float:
        """
        Get video duration using FFmpeg.

        NOTE: This is a synchronous function because ffmpeg.probe is blocking.

        Args:
            video_path: Path to video file

        Returns:
            Duration in seconds

        Raises:
            VideoProcessingException: If duration extraction fails
        """
        try:
            probe = ffmpeg.probe(video_path)
            duration = float(probe['format']['duration'])
            return duration
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to get video duration: {str(e)}"
            )

    def _needs_transcoding(self, video_path: str) -> tuple:
        """
        Check if video needs transcoding for compatibility.

        Args:
            video_path: Path to video file

        Returns:
            Tuple of (needs_transcoding: bool, codec_info: dict)

        Compatible codecs (no transcoding needed):
            - Video: h264, mpeg4, mpeg2video
            - Audio: aac, mp3

        Incompatible codecs (transcoding required):
            - Video: vp8, vp9, av1, hevc (limited support)
            - Audio: opus, vorbis, flac
        """
        import logging
        logger = logging.getLogger(__name__)

        try:
            probe = ffmpeg.probe(video_path)

            video_stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
            audio_stream = next((s for s in probe['streams'] if s['codec_type'] == 'audio'), None)

            codec_info = {
                'video_codec': video_stream.get('codec_name') if video_stream else None,
                'audio_codec': audio_stream.get('codec_name') if audio_stream else None,
                'has_video': video_stream is not None,
                'has_audio': audio_stream is not None
            }

            # List of codecs with good compatibility (Windows Media Player, etc.)
            compatible_video_codecs = ['h264', 'mpeg4', 'mpeg2video', 'mjpeg']
            compatible_audio_codecs = ['aac', 'mp3', 'ac3']

            video_needs_transcode = False
            audio_needs_transcode = False

            if video_stream:
                video_codec = video_stream.get('codec_name', '').lower()
                if video_codec not in compatible_video_codecs:
                    video_needs_transcode = True
                    logger.info(f"[CODEC_CHECK] Video codec '{video_codec}' needs transcoding for compatibility")

            if audio_stream:
                audio_codec = audio_stream.get('codec_name', '').lower()
                if audio_codec not in compatible_audio_codecs:
                    audio_needs_transcode = True
                    logger.info(f"[CODEC_CHECK] Audio codec '{audio_codec}' needs transcoding for compatibility")

            needs_transcode = video_needs_transcode or audio_needs_transcode

            if not needs_transcode:
                logger.info(f"[CODEC_CHECK] Video already uses compatible codecs: {codec_info['video_codec']}/{codec_info['audio_codec']}")

            return needs_transcode, codec_info

        except Exception as e:
            logger.warning(f"Failed to check codec compatibility: {e}")
            # Assume transcoding needed if we can't determine
            return True, {}

    def _transcode_to_compatible_format(self, input_path: str, output_path: str) -> None:
        """
        Transcode video to H.264 + AAC for maximum compatibility.

        NOTE: This is a synchronous function because FFmpeg operations are blocking.

        Args:
            input_path: Input video file
            output_path: Output video file (H.264 + AAC)
        """
        import time
        import logging
        logger = logging.getLogger(__name__)

        start_time = time.time()

        try:
            logger.info(f"[TRANSCODE] Converting to H.264 + AAC for compatibility: {input_path}")

            # Build FFmpeg command for transcoding
            transcode_cmd = (
                ffmpeg
                .input(input_path)
                .output(
                    output_path,
                    vcodec='libx264',      # H.264 video
                    acodec='aac',          # AAC audio
                    preset='veryfast',     # Balanced speed/quality
                    crf=23,                # Good quality
                    movflags='+faststart', # Web optimization
                    **{'b:a': '128k'}      # Audio bitrate
                )
                .overwrite_output()
            )

            # Run transcoding
            transcode_cmd.run(capture_stdout=True, capture_stderr=True)

            duration = time.time() - start_time
            output_size = os.path.getsize(output_path)

            logger.info(f"[TRANSCODE] ✓ Completed in {duration:.2f}s: {output_size} bytes")

        except ffmpeg.Error as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"FFmpeg transcoding error: {error_msg}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to transcode video: {error_msg}"
            )

    def _create_thumbnail_video(
        self,
        thumbnail_path: str,
        output_path: str,
        video_params: dict,
        audio_params: dict
    ) -> None:
        """
        Convert thumbnail image to 1-second video clip matching original video exactly.

        NOTE: This is a synchronous function (not async) because FFmpeg operations are blocking.
        It should be called via asyncio.to_thread() to avoid blocking the event loop.

        Args:
            thumbnail_path: Path to thumbnail image
            output_path: Output video file path
            video_params: Video parameters from original (width, height, fps, codec, profile, pix_fmt)
            audio_params: Audio parameters from original (codec, sample_rate, channels, has_audio)
        """
        import time
        import logging
        import json
        from pathlib import Path

        logger = logging.getLogger(__name__)
        start_time = time.time()

        # Create debug directory (using /tmp for Cloud Run compatibility)
        debug_dir = Path("/tmp/segment_debug")
        debug_dir.mkdir(parents=True, exist_ok=True)

        thumbnail_info = {
            "thumbnail_path": thumbnail_path,
            "output_path": output_path,
            "video_params": video_params,
            "audio_params": audio_params,
            "timestamp": time.time()
        }

        logger.info(f"Creating thumbnail video: {thumbnail_path} -> {output_path}")
        logger.info(f"Video params: {video_params}")
        logger.info(f"Audio params: {audio_params}")

        try:
            # Extract parameters
            width = video_params['width']
            height = video_params['height']
            fps_num = video_params['fps_num']
            fps_den = video_params['fps_den']
            video_codec = video_params['codec']
            pix_fmt = video_params['pix_fmt']
            sar = video_params.get('sar', '1:1')
            profile = video_params.get('profile')
            level = video_params.get('level')
            color_space = video_params.get('color_space')
            color_transfer = video_params.get('color_transfer')
            color_primaries = video_params.get('color_primaries')
            video_bitrate = video_params.get('bitrate')  # Get video bitrate

            has_audio = audio_params['has_audio']

            # Build FFmpeg command with exact parameter matching
            if has_audio:
                audio_codec = audio_params['codec']
                sample_rate = audio_params['sample_rate']
                channels = audio_params['channels']
                audio_bitrate = audio_params.get('bitrate')  # Get audio bitrate

                # Create 1-second video with silent audio
                video_input = (
                    ffmpeg
                    .input(thumbnail_path, loop=1, framerate=f'{fps_num}/{fps_den}', t=1)
                    .filter('scale', width, height, force_original_aspect_ratio='decrease')
                    .filter('pad', width, height, '(ow-iw)/2', '(oh-ih)/2')
                    .filter('fps', fps=f'{fps_num}/{fps_den}')  # Ensure exact fps match
                )

                # Always apply SAR filter to match original video exactly
                if sar:
                    # setsar filter requires ratio format (e.g., '1/1' not '1:1')
                    sar_ratio = sar.replace(':', '/')
                    video_input = video_input.filter('setsar', sar_ratio)

                audio_input = ffmpeg.input(
                    f'anullsrc=channel_layout={"stereo" if channels == 2 else "mono"}:sample_rate={sample_rate}',
                    f='lavfi',
                    t=1
                )

                # Build output options with BITRATE matching for perfect concat sync
                output_opts = {
                    'vcodec': video_codec,
                    'acodec': audio_codec,
                    'pix_fmt': pix_fmt,
                    'preset': 'veryfast',  # Better compression efficiency
                }

                # Use bitrate if available (CRITICAL for sync!), otherwise fall back to CRF
                if video_bitrate:
                    output_opts['b:v'] = f'{video_bitrate}k'
                    logger.info(f"Using video bitrate: {video_bitrate}k (for exact sync matching)")
                else:
                    output_opts['crf'] = 23
                    logger.warning(f"Video bitrate not available, using CRF=23 (may cause sync issues)")

                # Use audio bitrate if available
                if audio_bitrate:
                    output_opts['b:a'] = f'{audio_bitrate}k'
                    logger.info(f"Using audio bitrate: {audio_bitrate}k (for exact sync matching)")
                else:
                    output_opts['b:a'] = '128k'  # Default fallback
                    logger.warning(f"Audio bitrate not available, using default 128k")

                # Add profile and level if available (for h264/h265)
                if profile and video_codec in ['libx264', 'libx265']:
                    output_opts['profile:v'] = profile.lower()

                # Validate and add level if available (for h264/h265)
                # H.264 valid levels: 10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 61, 62
                if level and video_codec in ['libx264', 'libx265']:
                    level_int = int(level) if isinstance(level, (int, float)) else 0
                    valid_levels = [10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 61, 62]
                    if level_int in valid_levels:
                        output_opts['level:v'] = str(level_int)
                        logger.info(f"Using level:v = {level_int}")
                    else:
                        logger.warning(f"Invalid level value {level}, skipping level parameter")

                # Add color properties if available
                if color_space:
                    output_opts['colorspace'] = color_space
                if color_transfer:
                    output_opts['color_trc'] = color_transfer
                if color_primaries:
                    output_opts['color_primaries'] = color_primaries

                ffmpeg_cmd = (
                    ffmpeg
                    .output(
                        video_input,
                        audio_input,
                        output_path,
                        **output_opts
                    )
                    .overwrite_output()
                )

                # Log FFmpeg command
                cmd_args = ffmpeg_cmd.compile()
                logger.info(f"FFmpeg thumbnail video command (with audio): {' '.join(cmd_args)}")
                thumbnail_info["ffmpeg_command"] = ' '.join(cmd_args)
                thumbnail_info["has_audio"] = True

                ffmpeg_cmd.run(capture_stdout=True, capture_stderr=True)
            else:
                # Build output options for video-only with BITRATE matching
                output_opts = {
                    'vcodec': video_codec,
                    'pix_fmt': pix_fmt,
                    'preset': 'veryfast',  # Better compression efficiency
                }

                # Use bitrate if available (CRITICAL for sync!), otherwise fall back to CRF
                if video_bitrate:
                    output_opts['b:v'] = f'{video_bitrate}k'
                    logger.info(f"Using video bitrate: {video_bitrate}k (for exact sync matching)")
                else:
                    output_opts['crf'] = 23
                    logger.warning(f"Video bitrate not available, using CRF=23 (may cause sync issues)")

                if profile and video_codec in ['libx264', 'libx265']:
                    output_opts['profile:v'] = profile.lower()

                # Validate and add level if available (for h264/h265)
                # H.264 valid levels: 10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 61, 62
                if level and video_codec in ['libx264', 'libx265']:
                    level_int = int(level) if isinstance(level, (int, float)) else 0
                    valid_levels = [10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 61, 62]
                    if level_int in valid_levels:
                        output_opts['level:v'] = str(level_int)
                        logger.info(f"Using level:v = {level_int}")
                    else:
                        logger.warning(f"Invalid level value {level}, skipping level parameter")

                # Add color properties if available
                if color_space:
                    output_opts['colorspace'] = color_space
                if color_transfer:
                    output_opts['color_trc'] = color_transfer
                if color_primaries:
                    output_opts['color_primaries'] = color_primaries

                # Create 1-second video without audio
                video_input = (
                    ffmpeg
                    .input(thumbnail_path, loop=1, framerate=f'{fps_num}/{fps_den}', t=1)
                    .filter('scale', width, height, force_original_aspect_ratio='decrease')
                    .filter('pad', width, height, '(ow-iw)/2', '(oh-ih)/2')
                    .filter('fps', fps=f'{fps_num}/{fps_den}')  # Ensure exact fps match
                )

                # Always apply SAR filter to match original video exactly
                if sar:
                    # setsar filter requires ratio format (e.g., '1/1' not '1:1')
                    sar_ratio = sar.replace(':', '/')
                    video_input = video_input.filter('setsar', sar_ratio)

                ffmpeg_cmd = (
                    video_input
                    .output(
                        output_path,
                        **output_opts
                    )
                    .overwrite_output()
                )

                # Log FFmpeg command
                cmd_args = ffmpeg_cmd.compile()
                logger.info(f"FFmpeg thumbnail video command (video-only): {' '.join(cmd_args)}")
                thumbnail_info["ffmpeg_command"] = ' '.join(cmd_args)

                ffmpeg_cmd.run(capture_stdout=True, capture_stderr=True)

            # Log success
            duration = time.time() - start_time
            output_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0

            thumbnail_info["success"] = True
            thumbnail_info["duration_seconds"] = duration
            thumbnail_info["output_size_bytes"] = output_size

            logger.info(f"✓ Thumbnail video created successfully in {duration:.2f}s: {output_size} bytes")

            # Save debug info
            debug_file = debug_dir / "thumbnail_video_creation.json"
            with open(debug_file, 'w', encoding='utf-8') as f:
                json.dump(thumbnail_info, f, indent=2, ensure_ascii=False, default=str)
            logger.debug(f"Saved thumbnail video debug info: {debug_file}")

        except ffmpeg.Error as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)

            thumbnail_info["success"] = False
            thumbnail_info["error"] = error_msg
            thumbnail_info["error_type"] = "ffmpeg_error"
            thumbnail_info["duration_seconds"] = time.time() - start_time

            logger.error(f"FFmpeg error creating thumbnail video: {error_msg}")

            # Save error debug info
            debug_file = debug_dir / "thumbnail_video_creation_ERROR.json"
            with open(debug_file, 'w', encoding='utf-8') as f:
                json.dump(thumbnail_info, f, indent=2, ensure_ascii=False, default=str)

            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to create thumbnail video: {error_msg}"
            )

    def _create_segment_file(
        self,
        input_path: str,
        output_path: str,
        start_time: str,
        end_time: str,
        thumbnail_video_path: Optional[str] = None
    ) -> None:
        """
        Create video segment using FFmpeg with stream copy (no re-encoding).

        NOTE: This is a synchronous function (not async) because FFmpeg operations are blocking.
        It should be called via asyncio.to_thread() to avoid blocking the event loop.

        Args:
            input_path: Input video file path
            output_path: Output segment file path
            start_time: Start time in HH:MM:SS format
            end_time: End time in HH:MM:SS format
            thumbnail_video_path: Optional pre-created thumbnail video path (will be prepended)

        Raises:
            VideoProcessingException: If segment creation fails
        """
        import time
        import logging
        import json
        from pathlib import Path

        logger = logging.getLogger(__name__)
        start_process_time = time.time()

        # Create debug directory (using /tmp for Cloud Run compatibility)
        debug_dir = Path("/tmp/segment_debug")
        debug_dir.mkdir(parents=True, exist_ok=True)

        segment_info = {
            "start_time": start_time,
            "end_time": end_time,
            "input_path": input_path,
            "output_path": output_path,
            "thumbnail_video_path": thumbnail_video_path,
            "has_thumbnail": thumbnail_video_path and os.path.exists(thumbnail_video_path),
            "steps": []
        }

        try:
            # Calculate duration
            start_seconds = self._parse_time_to_seconds(start_time)
            end_seconds = self._parse_time_to_seconds(end_time)
            duration = end_seconds - start_seconds

            logger.info(f"Creating segment: {start_time} -> {end_time} (duration: {duration:.2f}s)")
            segment_info["start_seconds"] = start_seconds
            segment_info["end_seconds"] = end_seconds
            segment_info["duration_seconds"] = duration

            if thumbnail_video_path and os.path.exists(thumbnail_video_path):
                logger.info(f"Creating segment WITH thumbnail prepended using concat protocol (stream copy)")

                # Check if source needs transcoding (VP9/Opus -> H.264/AAC for concat compatibility)
                needs_transcode, codec_info = self._needs_transcoding(input_path)

                # Use concat protocol for stream copy (no re-encoding!)
                # This works because thumbnail video was created with H.264/AAC
                step_start = time.time()

                # Step 1: Extract segment - transcode to H.264/AAC if needed
                temp_segment_path = output_path + ".temp.mp4"
                segment_info["steps"].append({
                    "step": "extract_segment_for_concat",
                    "temp_file": temp_segment_path,
                    "needs_transcode": needs_transcode,
                    "source_codec": codec_info
                })

                try:
                    if needs_transcode:
                        # Transcode to H.264/AAC for concat compatibility
                        logger.info(f"[Segment] Transcoding to H.264/AAC (source: {codec_info})")
                        extract_cmd = (
                            ffmpeg
                            .input(input_path, ss=start_seconds, t=duration)
                            .output(
                                temp_segment_path,
                                vcodec='libx264',
                                acodec='aac',
                                preset='veryfast',
                                crf=23,
                                avoid_negative_ts='make_zero'
                            )
                            .overwrite_output()
                        )
                    else:
                        # Stream copy for compatible codecs (fast!)
                        logger.info(f"[Segment] Using stream copy (compatible codec)")
                        extract_cmd = (
                            ffmpeg
                            .input(input_path, ss=start_seconds, t=duration)
                            .output(temp_segment_path, c='copy', avoid_negative_ts='make_zero')
                            .overwrite_output()
                        )

                    extract_cmd.run(capture_stdout=True, capture_stderr=True)
                    logger.info(f"[Segment] Extracted temp segment: {os.path.getsize(temp_segment_path)} bytes")
                except Exception as e:
                    logger.error(f"Failed to extract temp segment: {e}")
                    raise

                # Step 2: Create concat file list
                import tempfile
                concat_list_path = output_path + ".concat.txt"
                try:
                    with open(concat_list_path, 'w', encoding='utf-8') as f:
                        # FFmpeg concat demuxer format
                        # Use forward slashes and escape special characters
                        thumb_path = thumbnail_video_path.replace('\\', '/').replace("'", "'\\''")
                        seg_path = temp_segment_path.replace('\\', '/').replace("'", "'\\''")
                        f.write(f"file '{thumb_path}'\n")
                        f.write(f"file '{seg_path}'\n")

                    logger.info(f"[Segment] Created concat list: {concat_list_path}")
                except Exception as e:
                    logger.error(f"Failed to create concat list: {e}")
                    raise

                # Step 3: Concat with demuxer (stream copy - no re-encoding!)
                try:
                    concat_cmd = (
                        ffmpeg
                        .input(concat_list_path, format='concat', safe=0)
                        .output(output_path, c='copy', movflags='+faststart')
                        .overwrite_output()
                    )

                    cmd_args = concat_cmd.compile()
                    logger.info(f"FFmpeg concat demuxer command: {' '.join(cmd_args)}")

                    segment_info["steps"].append({
                        "step": "concat_with_thumbnail_demuxer",
                        "method": "concat_protocol_stream_copy",
                        "command": ' '.join(cmd_args)
                    })

                    concat_cmd.run(capture_stdout=True, capture_stderr=True)

                except ffmpeg.Error as e:
                    error_msg = e.stderr.decode() if e.stderr else str(e)
                    logger.error(f"FFmpeg concat demuxer failed: {error_msg}")

                    # Fallback to filter_complex if concat fails
                    logger.warning("Falling back to filter_complex with re-encoding...")

                    input1 = ffmpeg.input(thumbnail_video_path)
                    input2 = ffmpeg.input(temp_segment_path)

                    v1 = input1['v']
                    a1 = input1['a']
                    v2 = input2['v']
                    a2 = input2['a']

                    joined = ffmpeg.filter([v1, a1, v2, a2], 'concat', n=2, v=1, a=1).split()
                    vout = joined[0]
                    aout = joined[1]

                    fallback_cmd = (
                        ffmpeg
                        .output(vout, aout, output_path,
                            vcodec='libx264',
                            acodec='aac',
                            preset='veryfast',
                            crf=23,
                            movflags='+faststart'
                        )
                        .overwrite_output()
                    )
                    fallback_cmd.run(capture_stdout=True, capture_stderr=True)

                finally:
                    # Clean up temp files
                    try:
                        if os.path.exists(temp_segment_path):
                            os.remove(temp_segment_path)
                        if os.path.exists(concat_list_path):
                            os.remove(concat_list_path)
                    except Exception:
                        pass

                step_time = time.time() - step_start
                final_size = os.path.getsize(output_path)

                logger.info(f"✓ Concat completed: {final_size} bytes in {step_time:.2f}s")

                # Verify streams in final output file (for logging only)
                try:
                    probe = ffmpeg.probe(output_path)
                    video_streams = [s for s in probe['streams'] if s['codec_type'] == 'video']
                    audio_streams = [s for s in probe['streams'] if s['codec_type'] == 'audio']
                    video_codec = video_streams[0].get('codec_name') if video_streams else 'unknown'
                    audio_codec = audio_streams[0].get('codec_name') if audio_streams else 'unknown'
                    logger.info(f"✓ Final segment (with thumbnail): {final_size} bytes in {step_time:.2f}s - Codecs: {video_codec}/{audio_codec}, Streams: V={len(video_streams)} A={len(audio_streams)}")
                except Exception as e:
                    logger.warning(f"Failed to probe output file: {e}")
                    logger.info(f"✓ Concatenated with thumbnail: {final_size} bytes in {step_time:.2f}s")

                segment_info["steps"][-1]["duration_seconds"] = step_time
                segment_info["steps"][-1]["output_file"] = output_path
                segment_info["steps"][-1]["file_size_bytes"] = final_size
            else:
                logger.info(f"Creating segment WITHOUT thumbnail")

                # Check if source needs transcoding (VP9/Opus -> H.264/AAC for compatibility)
                needs_transcode, codec_info = self._needs_transcoding(input_path)

                step_start = time.time()

                if needs_transcode:
                    # Transcode to H.264/AAC for better compatibility
                    logger.info(f"[Segment] Transcoding to H.264/AAC (source: {codec_info})")
                    ffmpeg_cmd = (
                        ffmpeg
                        .input(input_path, ss=start_seconds, t=duration)
                        .output(
                            output_path,
                            vcodec='libx264',
                            acodec='aac',
                            preset='veryfast',
                            crf=23,
                            avoid_negative_ts='make_zero',
                            movflags='+faststart'
                        )
                        .overwrite_output()
                    )
                else:
                    # Stream copy for compatible codecs (fast!)
                    logger.info(f"[Segment] Using stream copy (compatible codec)")
                    ffmpeg_cmd = (
                        ffmpeg
                        .input(input_path, ss=start_seconds, t=duration)
                        .output(
                            output_path,
                            c='copy',  # Stream copy - no re-encoding!
                            avoid_negative_ts='make_zero',
                            movflags='+faststart'
                        )
                        .overwrite_output()
                    )

                # Log FFmpeg command
                cmd_args = ffmpeg_cmd.compile()
                logger.info(f"FFmpeg segment extraction command: {' '.join(cmd_args)}")

                ffmpeg_cmd.run(capture_stdout=True, capture_stderr=True)
                step_time = time.time() - step_start
                final_size = os.path.getsize(output_path)

                logger.info(f"✓ Segment extracted: {final_size} bytes in {step_time:.2f}s")

                # Verify streams in final output file (for logging only)
                try:
                    probe = ffmpeg.probe(output_path)
                    video_streams = [s for s in probe['streams'] if s['codec_type'] == 'video']
                    audio_streams = [s for s in probe['streams'] if s['codec_type'] == 'audio']
                    video_codec = video_streams[0].get('codec_name') if video_streams else 'unknown'
                    audio_codec = audio_streams[0].get('codec_name') if audio_streams else 'unknown'
                    logger.info(f"✓ Final segment (no thumbnail): {final_size} bytes in {step_time:.2f}s - Codecs: {video_codec}/{audio_codec}, Streams: V={len(video_streams)} A={len(audio_streams)}")
                except Exception as e:
                    logger.warning(f"Failed to probe output file: {e}")
                    logger.info(f"✓ Segment extracted (no thumbnail): {final_size} bytes in {step_time:.2f}s")

                segment_info["steps"].append({
                    "step": "extract_segment_no_thumbnail",
                    "duration_seconds": step_time,
                    "output_file": output_path,
                    "file_size_bytes": final_size,
                    "command": ' '.join(cmd_args)
                })

            total_time = time.time() - start_process_time
            segment_info["total_duration_seconds"] = total_time
            segment_info["success"] = True

            logger.info(f"✓ Segment creation completed in {total_time:.2f}s: {output_path}")

            # Save debug info
            debug_file = debug_dir / f"segment_{start_time.replace(':', '-')}_{end_time.replace(':', '-')}.json"
            with open(debug_file, 'w', encoding='utf-8') as f:
                json.dump(segment_info, f, indent=2, ensure_ascii=False)
            logger.debug(f"Saved segment debug info: {debug_file}")

        except ffmpeg.Error as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)
            segment_info["success"] = False
            segment_info["error"] = error_msg
            segment_info["error_type"] = "ffmpeg_error"

            logger.error(f"FFmpeg error during segment creation: {error_msg}")

            # Save error debug info
            debug_file = debug_dir / f"segment_ERROR_{start_time.replace(':', '-')}_{end_time.replace(':', '-')}.json"
            with open(debug_file, 'w', encoding='utf-8') as f:
                json.dump(segment_info, f, indent=2, ensure_ascii=False)

            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"FFmpeg error during segment creation: {error_msg}"
            )
        except Exception as e:
            segment_info["success"] = False
            segment_info["error"] = str(e)
            segment_info["error_type"] = type(e).__name__

            logger.error(f"Failed to create video segment: {str(e)}", exc_info=True)

            # Save error debug info
            debug_file = debug_dir / f"segment_ERROR_{start_time.replace(':', '-')}_{end_time.replace(':', '-')}.json"
            with open(debug_file, 'w', encoding='utf-8') as f:
                json.dump(segment_info, f, indent=2, ensure_ascii=False)

            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to create video segment: {str(e)}"
            )

    async def _process_thumbnail_image(
        self, 
        thumbnail_base64: str, 
        video_id: uuid.UUID
    ) -> str:
        """
        Process base64 thumbnail image and save to temporary file.

        Args:
            thumbnail_base64: Base64 encoded image data
            video_id: Video UUID for file naming

        Returns:
            Path to temporary thumbnail file

        Raises:
            VideoProcessingException: If image processing fails
        """
        try:
            # Decode base64 image
            image_data = base64.b64decode(thumbnail_base64)
            
            # Create temporary file
            temp_dir = tempfile.gettempdir()
            thumbnail_path = os.path.join(temp_dir, f"thumbnail_{video_id}.jpg")
            
            # Open and validate image
            with Image.open(io.BytesIO(image_data)) as img:
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize to reasonable dimensions (max 1920x1080)
                max_size = (1920, 1080)
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                
                # Save as JPEG
                img.save(thumbnail_path, 'JPEG', quality=85, optimize=True)
            
            return thumbnail_path
            
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.INVALID_REQUEST,
                f"Failed to process thumbnail image: {str(e)}"
            )

    async def split_video_and_generate_urls(
        self,
        video_id: uuid.UUID,
        segments: List[dict],
        thumbnail_base64: Optional[str] = None,
        expiration_hours: int = 24
    ) -> Tuple[List[dict], datetime]:
        """
        Split video into segments and generate download URLs.

        Args:
            video_id: Video UUID
            segments: List of segment definitions with start_time and end_time
            thumbnail_base64: Optional base64 encoded thumbnail image
            expiration_hours: URL expiration time in hours

        Returns:
            Tuple of (download_urls_list, expiration_datetime)

        Raises:
            VideoProcessingException: If splitting or URL generation fails
        """
        # Acquire Redis lock to prevent duplicate concurrent processing
        from app.core.redis import redis_manager
        import logging
        logger = logging.getLogger(__name__)

        lock_key = f"video_splitting:{video_id}"
        lock_acquired = False

        try:
            # Try to acquire lock (non-blocking)
            lock_acquired = await redis_manager.acquire_lock(
                lock_key,
                timeout_seconds=3600  # 1 hour lock timeout
            )

            if not lock_acquired:
                # Check if lock exists to provide better error message
                lock_info = await redis_manager.get_lock_info(lock_key)
                logger.warning(
                    f"Video {video_id} is already being split. Lock info: {lock_info}"
                )
                raise VideoProcessingException(
                    ErrorCodes.PROCESSING_IN_PROGRESS,
                    "Video is already being split. Please wait for the current operation to complete.",
                    retryable=True
                )

            logger.info(f"Acquired lock for video splitting: {video_id}")

        except VideoProcessingException:
            raise
        except Exception as lock_error:
            logger.error(f"Failed to acquire lock for video {video_id}: {str(lock_error)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to acquire processing lock: {str(lock_error)}"
            )

        temp_files = []
        try:
            # Get video from database to find GCS path
            from app.repositories.video_repository import VideoRepository
            from app.core.database import db_manager

            async with db_manager.get_session_context() as session:
                video_repo = VideoRepository(session)
                video = await video_repo.get_by_id(video_id)
                
                if not video:
                    raise VideoProcessingException(
                        ErrorCodes.VIDEO_NOT_FOUND,
                        f"Video with ID {video_id} not found"
                    )
                
                if not video.gcs_path:
                    raise VideoProcessingException(
                        ErrorCodes.PROCESSING_FAILED,
                        "Video file not found in storage"
                    )

            # Download video from GCS to temporary file
            local_video_path = await self.gcs_service.download_video_for_processing(
                video.gcs_path, video_id
            )
            temp_files.append(local_video_path)

            # Get video duration (run in thread to avoid blocking)
            video_duration = await asyncio.to_thread(self._get_video_duration, local_video_path)

            # Validate segments
            self._validate_segments(segments, video_duration)

            # Process thumbnail if provided
            thumbnail_video_path = None
            if thumbnail_base64:
                # Process thumbnail image
                thumbnail_image_path = await self._process_thumbnail_image(
                    thumbnail_base64, video_id
                )
                temp_files.append(thumbnail_image_path)

                # Upload thumbnail to GCS and update video record
                with open(thumbnail_image_path, 'rb') as f:
                    thumbnail_data = f.read()

                thumbnail_gcs_path, _ = await self.gcs_service.upload_thumbnail(
                    thumbnail_data=thumbnail_data,
                    video_id=video_id,
                    content_type="image/jpeg"
                )

                # Update video record with thumbnail path
                async with db_manager.get_session_context() as session:
                    video_repo = VideoRepository(session)
                    await video_repo.update(
                        video_id,
                        {"thumbnail_gcs_path": thumbnail_gcs_path}
                    )
                    await session.commit()

                # Extract first segment to get EXACT metadata for thumbnail video creation
                # This ensures thumbnail video matches segment perfectly
                import logging
                logger = logging.getLogger(__name__)
                logger.info("Extracting first segment sample to get metadata...")
                first_segment = segments[0]
                start_seconds = self._parse_time_to_seconds(first_segment["start_time"])
                end_seconds = self._parse_time_to_seconds(first_segment["end_time"])
                sample_duration = min(5, end_seconds - start_seconds)  # Max 5 seconds sample

                temp_dir = tempfile.gettempdir()
                sample_segment_path = os.path.join(temp_dir, f"sample_segment_{video_id}.mp4")
                temp_files.append(sample_segment_path)

                # Check if source video needs transcoding (VP9/Opus/etc)
                logger.info(f"Checking source codec before sample extraction...")
                needs_transcode, codec_info = await asyncio.to_thread(
                    self._needs_transcoding, local_video_path
                )

                # Extract sample segment - transcode to H.264/AAC if needed for concat compatibility
                logger.info(f"Extracting sample segment from {local_video_path} to {sample_segment_path}")
                logger.info(f"Sample duration: {sample_duration}s (start: {start_seconds}s)")

                def extract_sample():
                    if needs_transcode:
                        # Transcode to H.264/AAC for concat compatibility
                        logger.info(f"Transcoding sample to H.264/AAC (source codec: {codec_info})")
                        return (
                            ffmpeg
                            .input(local_video_path, ss=start_seconds, t=sample_duration)
                            .output(
                                sample_segment_path,
                                vcodec='libx264',
                                acodec='aac',
                                preset='veryfast',
                                crf=23,
                                avoid_negative_ts='make_zero'
                            )
                            .overwrite_output()
                            .run(capture_stdout=True, capture_stderr=True)
                        )
                    else:
                        # Stream copy (fast) for compatible codecs
                        return (
                            ffmpeg
                            .input(local_video_path, ss=start_seconds, t=sample_duration)
                            .output(sample_segment_path, c='copy', avoid_negative_ts='make_zero')
                            .overwrite_output()
                            .run(capture_stdout=True, capture_stderr=True)
                        )

                try:
                    await asyncio.to_thread(extract_sample)
                    logger.info(f"✓ Sample segment extracted: {os.path.getsize(sample_segment_path)} bytes")
                except Exception as e:
                    logger.error(f"Failed to extract sample segment: {str(e)}")
                    raise VideoProcessingException(
                        ErrorCodes.PROCESSING_FAILED,
                        f"Failed to extract sample segment for metadata: {str(e)}"
                    )

                # Get metadata from the EXTRACTED SEGMENT (not original video)
                probe = await asyncio.to_thread(ffmpeg.probe, sample_segment_path)
                video_stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
                if not video_stream:
                    raise VideoProcessingException(
                        ErrorCodes.PROCESSING_FAILED,
                        "No video stream found in extracted segment"
                    )

                # Extract EXACT video properties
                video_width = int(video_stream['width'])
                video_height = int(video_stream['height'])

                # Get frame rate as exact fraction (e.g., "30000/1001")
                r_frame_rate = video_stream.get('r_frame_rate', '30/1')
                fps_parts = r_frame_rate.split('/')
                fps_num = int(fps_parts[0])
                fps_den = int(fps_parts[1]) if len(fps_parts) > 1 else 1

                # Pixel format and aspect ratio
                pix_fmt = video_stream.get('pix_fmt', 'yuv420p')
                sar = video_stream.get('sample_aspect_ratio', '1:1')  # Sample Aspect Ratio

                # Codec profile and level
                profile = video_stream.get('profile')  # e.g., "Main", "High", "Baseline"
                level = video_stream.get('level')  # e.g., 31, 40, 41

                # Color properties (important for accurate reproduction)
                color_space = video_stream.get('color_space')  # e.g., "smpte170m", "bt709"
                color_transfer = video_stream.get('color_transfer')  # e.g., "bt709"
                color_primaries = video_stream.get('color_primaries')  # e.g., "smpte170m"

                # Get video bitrate for EXACT matching (critical for concat sync!)
                video_bitrate = video_stream.get('bit_rate')
                if video_bitrate:
                    # Convert to kbps for FFmpeg
                    video_bitrate_k = int(video_bitrate) // 1000
                    logger.info(f"Detected video bitrate: {video_bitrate_k}k")
                else:
                    video_bitrate_k = None
                    logger.warning("Video bitrate not found in stream metadata")

                # ALWAYS use H.264 for thumbnail video (for concat compatibility)
                # VP9/VP8/HEVC cause sync issues with concat demuxer
                video_codec = 'libx264'
                logger.info(f"Forcing H.264 codec for thumbnail video (original was {video_stream.get('codec_name')})")

                # Build video parameters dict with ALL properties INCLUDING BITRATE
                video_params = {
                    'width': video_width,
                    'height': video_height,
                    'fps_num': fps_num,
                    'fps_den': fps_den,
                    'codec': video_codec,
                    'pix_fmt': pix_fmt,
                    'sar': sar,
                    'profile': profile,
                    'level': level,
                    'color_space': color_space,
                    'color_transfer': color_transfer,
                    'color_primaries': color_primaries,
                    'bitrate': video_bitrate_k  # Add bitrate for exact matching
                }

                # Extract audio properties
                audio_stream = next((s for s in probe['streams'] if s['codec_type'] == 'audio'), None)
                has_audio = audio_stream is not None

                if has_audio:
                    audio_sample_rate = int(audio_stream.get('sample_rate', 44100))
                    audio_channels = int(audio_stream.get('channels', 2))
                    audio_codec_name = audio_stream.get('codec_name', 'aac')

                    # Get audio bitrate for EXACT matching (critical for concat sync!)
                    audio_bitrate = audio_stream.get('bit_rate')
                    if audio_bitrate:
                        # Convert to kbps for FFmpeg
                        audio_bitrate_k = int(audio_bitrate) // 1000
                        logger.info(f"Detected audio bitrate: {audio_bitrate_k}k")
                    else:
                        audio_bitrate_k = None
                        logger.warning("Audio bitrate not found in stream metadata")

                    # ALWAYS use AAC for thumbnail video (for concat compatibility)
                    # Opus/Vorbis cause sync issues with concat demuxer
                    audio_codec = 'aac'
                    logger.info(f"Forcing AAC codec for thumbnail audio (original was {audio_codec_name})")
                else:
                    audio_sample_rate = 44100
                    audio_channels = 2
                    audio_codec = 'aac'
                    audio_bitrate_k = None

                # Build audio parameters dict INCLUDING BITRATE
                audio_params = {
                    'has_audio': has_audio,
                    'codec': audio_codec,
                    'sample_rate': audio_sample_rate,
                    'channels': audio_channels,
                    'bitrate': audio_bitrate_k  # Add bitrate for exact matching
                }

                # Create 1-second thumbnail video (only once!) with EXACT matching parameters
                temp_dir = tempfile.gettempdir()
                thumbnail_video_path = os.path.join(temp_dir, f"thumbnail_video_{video_id}.mp4")
                temp_files.append(thumbnail_video_path)

                await asyncio.to_thread(
                    self._create_thumbnail_video,
                    thumbnail_image_path,
                    thumbnail_video_path,
                    video_params,
                    audio_params
                )

            # Create segments and upload to GCS with parallel processing
            semaphore = asyncio.Semaphore(self.max_concurrent_jobs)
            download_urls = []

            async def process_segment(i: int, segment: dict) -> dict:
                """Process a single segment with semaphore control."""
                import time as time_module
                import logging
                logger = logging.getLogger(__name__)

                segment_start_time = time_module.time()
                segment_no = i + 1

                logger.info(f"[Segment {segment_no}/{len(segments)}] Starting processing: {segment['start_time']} -> {segment['end_time']}")

                async with semaphore:
                    # Create temporary segment file
                    temp_dir = tempfile.gettempdir()
                    segment_filename = f"segment_{video_id}_{segment_no:02d}.mp4"
                    segment_path = os.path.join(temp_dir, segment_filename)
                    temp_files.append(segment_path)

                    # Create video segment (with stream copy - very fast!)
                    segment_creation_start = time_module.time()
                    logger.info(f"[Segment {segment_no}] Creating video segment file...")

                    # Run in thread pool to avoid blocking event loop (FFmpeg is blocking)
                    await asyncio.to_thread(
                        self._create_segment_file,
                        input_path=local_video_path,
                        output_path=segment_path,
                        start_time=segment["start_time"],
                        end_time=segment["end_time"],
                        thumbnail_video_path=thumbnail_video_path  # Reuse pre-created thumbnail video
                    )

                    segment_creation_duration = time_module.time() - segment_creation_start
                    logger.info(f"[Segment {segment_no}] ✓ Segment file created in {segment_creation_duration:.2f}s")

                    # Read segment file
                    read_start = time_module.time()
                    with open(segment_path, 'rb') as f:
                        segment_data = f.read()
                    read_duration = time_module.time() - read_start
                    logger.info(f"[Segment {segment_no}] Read segment file: {len(segment_data)} bytes in {read_duration:.2f}s")

                    # Upload segment to GCS
                    upload_start = time_module.time()
                    logger.info(f"[Segment {segment_no}] Uploading to GCS...")

                    gcs_path, metadata = await self.gcs_service.upload_segment(
                        segment_data=segment_data,
                        video_id=video_id,
                        segment_no=segment_no,
                        content_type="video/mp4"
                    )

                    upload_duration = time_module.time() - upload_start
                    logger.info(f"[Segment {segment_no}] ✓ Uploaded to GCS in {upload_duration:.2f}s: {gcs_path}")

                    # Generate signed download URL
                    download_url = self.gcs_service.generate_signed_url(
                        gcs_path=gcs_path,
                        expiration_hours=expiration_hours,
                        method="GET"
                    )

                    total_duration = time_module.time() - segment_start_time
                    logger.info(
                        f"[Segment {segment_no}] ✓ COMPLETED in {total_duration:.2f}s "
                        f"(create: {segment_creation_duration:.2f}s, upload: {upload_duration:.2f}s)"
                    )

                    # Return segment info
                    return {
                        "segment_no": segment_no,
                        "start_time": segment["start_time"],
                        "end_time": segment["end_time"],
                        "title": segment.get("title", f"Segment {segment_no}"),
                        "download_url": download_url,
                        "file_size_bytes": metadata["size_bytes"],
                        "gcs_path": gcs_path
                    }

            # Process all segments in parallel (with semaphore limiting concurrency)
            import logging
            import time as time_module
            logger = logging.getLogger(__name__)

            logger.info(f"Starting parallel processing of {len(segments)} segments for video {video_id}")
            parallel_start_time = time_module.time()

            tasks = [process_segment(i, segment) for i, segment in enumerate(segments)]
            # Wait for all tasks to complete, don't stop on first error
            results = await asyncio.gather(*tasks, return_exceptions=True)

            parallel_duration = time_module.time() - parallel_start_time

            # Check for errors in results
            errors = [r for r in results if isinstance(r, Exception)]
            if errors:
                logger.error(f"Failed to process {len(errors)}/{len(segments)} segments")
                # Raise the first error
                raise errors[0]

            # All tasks succeeded
            download_urls = results
            logger.info(f"✓ Completed parallel processing of {len(segments)} segments in {parallel_duration:.2f}s")

            # Calculate expiration time
            expiration_time = datetime.now(timezone.utc) + timedelta(hours=expiration_hours)

            # Save overall processing summary
            try:
                import json
                from pathlib import Path
                debug_dir = Path("/tmp/segment_debug")
                debug_dir.mkdir(parents=True, exist_ok=True)

                summary = {
                    "video_id": str(video_id),
                    "total_segments": len(segments),
                    "parallel_processing_duration_seconds": parallel_duration,
                    "thumbnail_provided": bool(thumbnail_base64),
                    "expiration_hours": expiration_hours,
                    "expiration_time": expiration_time.isoformat(),
                    "segments": [
                        {
                            "segment_no": url_info["segment_no"],
                            "start_time": url_info["start_time"],
                            "end_time": url_info["end_time"],
                            "title": url_info["title"],
                            "file_size_bytes": url_info["file_size_bytes"],
                            "gcs_path": url_info["gcs_path"]
                        }
                        for url_info in download_urls
                    ],
                    "total_size_bytes": sum(url["file_size_bytes"] for url in download_urls),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                summary_file = debug_dir / f"video_{video_id}_splitting_summary.json"
                with open(summary_file, 'w', encoding='utf-8') as f:
                    json.dump(summary, f, indent=2, ensure_ascii=False)
                logger.info(f"Saved splitting summary: {summary_file}")

            except Exception as summary_error:
                logger.warning(f"Failed to save splitting summary: {str(summary_error)}")

            return download_urls, expiration_time

        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Video splitting failed: {str(e)}"
            )
        finally:
            # Release Redis lock
            if lock_acquired:
                try:
                    await redis_manager.release_lock(lock_key)
                    logger.info(f"Released lock for video splitting: {video_id}")
                except Exception as unlock_error:
                    logger.error(f"Failed to release lock for video {video_id}: {str(unlock_error)}")

            # Clean up temporary files
            for temp_file in temp_files:
                try:
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                except Exception:
                    pass  # Ignore cleanup errors

    async def get_video_segments_for_splitting(self, video_id: uuid.UUID) -> List[dict]:
        """
        Get existing video segments that can be used for splitting.

        Args:
            video_id: Video UUID

        Returns:
            List of segment dictionaries with timing information

        Raises:
            VideoProcessingException: If segments retrieval fails
        """
        try:
            from app.repositories.segment_repository import SegmentRepository
            from app.core.database import db_manager

            async with db_manager.get_session_context() as session:
                segment_repo = SegmentRepository(session)
                segments = await segment_repo.get_segments_by_video_id(video_id)
                
                # Convert to format suitable for splitting
                segment_list = []
                for segment in segments:
                    segment_data = {
                        "segment_no": segment.segment_no,
                        "start_time": segment.start_time,
                        "end_time": segment.end_time,
                        "title": segment.title,
                        "summary": segment.summary,
                        "class_type": segment.class_type
                    }
                    segment_list.append(segment_data)
                
                # Sort by segment number
                segment_list.sort(key=lambda x: x["segment_no"])
                
                return segment_list

        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to retrieve video segments: {str(e)}"
            )


# Global service instance
video_splitting_service = VideoSplittingService()