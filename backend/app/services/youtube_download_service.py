"""
YouTube video download service using yt-dlp.
"""

import asyncio
import logging
import os
import tempfile
from typing import Dict, List, Optional, Tuple

import yt_dlp
from yt_dlp.utils import DownloadError, GeoRestrictedError
from app.core.exceptions import ErrorCodes, VideoProcessingException
from app.core.youtube_utils import extract_video_id, validate_youtube_url
from app.utils.caption_parser import CaptionParser, CaptionSegment

logger = logging.getLogger(__name__)


class YouTubeDownloadService:
    """Service for downloading videos from YouTube using yt-dlp."""

    # Maximum file size: 2GB (aligned with existing validation)
    MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024

    # Minimum duration: 60 seconds (aligned with existing validation)
    MIN_DURATION = 60

    # Maximum duration: 45 minutes (aligned with existing validation)
    MAX_DURATION = 45 * 60  # 2700 seconds

    def __init__(self) -> None:
        """Initialize YouTube download service."""
        self.logger = logger

    async def get_video_info(self, url: str) -> Dict:
        """
        Get video metadata without downloading.

        Args:
            url: YouTube video URL

        Returns:
            Dictionary containing video metadata:
            - title: Video title
            - description: Video description
            - duration: Duration in seconds
            - thumbnail: Thumbnail URL
            - uploader: Channel name
            - upload_date: Upload date (YYYYMMDD format)
            - formats: Available formats list
            - filesize_approx: Approximate file size in bytes
            - view_count: Number of views
            - id: YouTube video ID

        Raises:
            VideoProcessingException: If metadata extraction fails
        """
        # Log URL for debugging
        self.logger.info(f"[URL_DEBUG] get_video_info called with URL: {url}")
        self.logger.info(f"[URL_DEBUG] URL type: {type(url).__name__}, repr: {repr(url)}, len: {len(url)}")

        # Validate URL
        if not validate_youtube_url(url):
            raise VideoProcessingException(
                ErrorCodes.YOUTUBE_INVALID_URL,
                f"Invalid YouTube URL: {url}",
                status_code=400,
            )

        # Configure yt-dlp options for metadata extraction only
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "skip_download": True,
        }

        try:
            # Run yt-dlp in thread pool to avoid blocking
            import concurrent.futures
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                info = await loop.run_in_executor(
                    executor, lambda: self._extract_info(url, ydl_opts)
                )

            if not info:
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_VIDEO_UNAVAILABLE,
                    "Could not extract video information",
                    status_code=404,
                )

            # Check if video is available
            if info.get("is_live"):
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_LIVE_VIDEO,
                    "Live videos are not supported",
                    status_code=400,
                )

            # Get duration
            duration = info.get("duration", 0)
            if duration < self.MIN_DURATION:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_TOO_SHORT,
                    f"Video duration {duration} seconds is less than minimum required {self.MIN_DURATION} seconds",
                    status_code=400,
                )

            if duration > self.MAX_DURATION:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_TOO_LONG,
                    f"Video duration {duration} seconds exceeds maximum allowed {self.MAX_DURATION} seconds (45 minutes)",
                    status_code=400,
                )

            # Extract relevant metadata and decode HTML entities
            from app.core.text_utils import decode_html_entities

            # Extract resolution info - try top level first, then check formats
            video_height = info.get("height", 0)
            video_width = info.get("width", 0)

            # If height not available at top level, get max height from formats
            if not video_height:
                formats = info.get("formats", [])
                for fmt in formats:
                    fmt_height = fmt.get("height", 0)
                    if fmt_height and fmt_height > video_height:
                        video_height = fmt_height
                        video_width = fmt.get("width", 0)

            metadata = {
                "id": extract_video_id(url) or info.get("id"),
                "title": decode_html_entities(info.get("title", "Untitled Video")),
                "description": decode_html_entities(info.get("description", "")),
                "duration": duration,
                "thumbnail": info.get("thumbnail"),
                "uploader": decode_html_entities(info.get("uploader", "Unknown")),
                "upload_date": info.get("upload_date"),
                "view_count": info.get("view_count", 0),
                "filesize_approx": self._estimate_filesize(info),
                "formats": info.get("formats", []),
                "width": video_width,
                "height": video_height,
            }

            # Log detected resolution for debugging
            self.logger.info(f"[RESOLUTION_DETECT] Video resolution: {video_width}x{video_height}")

            # Check approximate file size
            if metadata["filesize_approx"] > self.MAX_FILE_SIZE:
                raise VideoProcessingException(
                    ErrorCodes.FILE_SIZE_EXCEEDED,
                    f"Video file size {metadata['filesize_approx']} bytes exceeds maximum allowed size of {self.MAX_FILE_SIZE} bytes",
                    status_code=400,
                )

            return metadata

        except GeoRestrictedError as e:
            # Handle geo-restricted videos explicitly
            self.logger.warning(f"[YOUTUBE_GEO] Video is geo-restricted: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.YOUTUBE_REGION_BLOCKED,
                "해당 영상은 한국에서 재생할 수 없습니다. (지역 제한)",
                status_code=403,
            )
        except DownloadError as e:
            error_message = str(e)

            # Handle specific YouTube errors
            if "private video" in error_message.lower():
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_PRIVATE_VIDEO,
                    "Video is private and cannot be accessed",
                    status_code=403,
                )
            elif "video unavailable" in error_message.lower():
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_VIDEO_UNAVAILABLE,
                    "Video is unavailable or has been removed",
                    status_code=404,
                )
            elif "age-restricted" in error_message.lower():
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_AGE_RESTRICTED,
                    "Video is age-restricted and cannot be downloaded without authentication",
                    status_code=403,
                )
            elif "region" in error_message.lower() or "not available" in error_message.lower():
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_REGION_BLOCKED,
                    "Video is not available in this region",
                    status_code=403,
                )
            else:
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_DOWNLOAD_FAILED,
                    f"Failed to get video information: {error_message}",
                    status_code=500,
                )
        except VideoProcessingException:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error getting YouTube video info: {str(e)}", exc_info=True)
            raise VideoProcessingException(
                ErrorCodes.YOUTUBE_DOWNLOAD_FAILED,
                f"Failed to get video information: {str(e)}",
                status_code=500,
            )

    async def download_video(
        self,
        url: str,
        output_path: Optional[str] = None,
        quality: str = "best",
    ) -> Tuple[str, Dict]:
        """
        Download YouTube video.

        Args:
            url: YouTube video URL
            output_path: Optional output file path (temp directory if None)
            quality: Quality preference ('best', '1080p', '720p', '480p')

        Returns:
            Tuple of (file_path, metadata)

        Raises:
            VideoProcessingException: If download fails
        """
        # Get video info first to validate
        metadata = await self.get_video_info(url)

        # Determine output directory
        if output_path is None:
            output_dir = tempfile.mkdtemp(prefix="youtube_download_")
            video_id = metadata["id"]
            output_template = os.path.join(output_dir, f"{video_id}.%(ext)s")
        else:
            output_template = output_path

        # Configure format selection based on quality
        format_string = self._get_format_string(quality)
        self.logger.info(f"[QUALITY_DEBUG] Downloading with quality={quality}, format_string={format_string}")

        # Configure yt-dlp options
        ydl_opts = {
            "format": format_string,
            "outtmpl": output_template,
            "quiet": True,  # Suppress yt-dlp output
            "no_warnings": True,  # Suppress warnings
            "extract_flat": False,
            # Merge formats if necessary (video + audio)
            "merge_output_format": "mp4",
            # Post-processing
            "postprocessors": [
                {
                    "key": "FFmpegVideoConvertor",
                    "preferedformat": "mp4",
                }
            ],
        }

        try:
            # Download video in thread pool
            import concurrent.futures
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                info = await loop.run_in_executor(
                    executor, lambda: self._download_video_sync(url, ydl_opts)
                )

            # Find the downloaded file
            # Use the output_template we defined earlier
            downloaded_file = output_template.replace("%(ext)s", "mp4")
            if not os.path.exists(downloaded_file):
                # Try to find the file in the directory
                if output_path is None:
                    files = [
                        f
                        for f in os.listdir(output_dir)
                        if f.startswith(metadata["id"]) and f.endswith(".mp4")
                    ]
                    if files:
                        downloaded_file = os.path.join(output_dir, files[0])
                else:
                    # If output_path was provided, check for .mp4 extension
                    if not downloaded_file.endswith(".mp4"):
                        downloaded_file = downloaded_file + ".mp4"

            if not os.path.exists(downloaded_file):
                raise VideoProcessingException(
                    ErrorCodes.YOUTUBE_DOWNLOAD_FAILED,
                    "Downloaded file not found",
                    status_code=500,
                )

            # Verify file size
            file_size = os.path.getsize(downloaded_file)
            if file_size > self.MAX_FILE_SIZE:
                # Clean up oversized file
                os.unlink(downloaded_file)
                raise VideoProcessingException(
                    ErrorCodes.FILE_SIZE_EXCEEDED,
                    f"Downloaded file size {file_size} bytes exceeds maximum allowed size of {self.MAX_FILE_SIZE} bytes",
                    status_code=400,
                )

            # Update metadata with actual file info
            metadata["downloaded_file_path"] = downloaded_file
            metadata["downloaded_file_size"] = file_size

            # Extract actual resolution from downloaded file for debugging
            try:
                import ffmpeg
                probe = ffmpeg.probe(downloaded_file)
                video_stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
                if video_stream:
                    actual_width = video_stream.get('width', 'unknown')
                    actual_height = video_stream.get('height', 'unknown')
                    actual_codec = video_stream.get('codec_name', 'unknown')
                    self.logger.info(
                        f"[QUALITY_DEBUG] Downloaded video resolution: {actual_width}x{actual_height}, codec: {actual_codec}"
                    )
                    metadata["actual_width"] = actual_width
                    metadata["actual_height"] = actual_height
                    metadata["actual_codec"] = actual_codec
            except Exception as e:
                self.logger.warning(f"Failed to probe downloaded file resolution: {e}")

            self.logger.info(
                f"Successfully downloaded YouTube video: {metadata['title']} ({file_size} bytes)"
            )

            return downloaded_file, metadata

        except VideoProcessingException:
            raise
        except Exception as e:
            self.logger.error(f"Failed to download YouTube video: {str(e)}", exc_info=True)
            raise VideoProcessingException(
                ErrorCodes.YOUTUBE_DOWNLOAD_FAILED,
                f"Failed to download video: {str(e)}",
                status_code=500,
            )

    def _get_common_ydl_opts(self) -> Dict:
        """
        Get common yt-dlp options to avoid bot detection.

        Authentication priority:
        1. OAuth 2.0 token (most reliable, auto-refresh supported)
        2. Cookies file (fallback)

        Returns:
            Dictionary of common options
        """
        # File paths
        cookie_file = "/tmp/youtube_cookies.txt"
        oauth_token_dir = "/tmp/yt-dlp/youtube-oauth2"
        oauth_token_file = f"{oauth_token_dir}/token.json"

        opts = {
            # User agent to mimic real browser
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            # Additional headers
            "http_headers": {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            },
            # YouTube-specific extractor arguments
            "extractor_args": {
                "youtube": {
                    # Use web client for best quality
                }
            },
            # Sleep between requests to avoid rate limiting
            "sleep_interval": 1,
            "max_sleep_interval": 3,
            # Retry on errors
            "retries": 3,
            "fragment_retries": 3,
            # Geo-bypass options
            "geo_bypass": True,
            "geo_bypass_country": "KR",
        }

        # Priority 1: OAuth 2.0 token (most reliable, supports auto-refresh)
        if os.path.exists(oauth_token_file):
            # Set yt-dlp cache directory to use our OAuth token
            opts["cachedir"] = "/tmp/yt-dlp"
            opts["username"] = "oauth2"
            opts["password"] = ""
            logger.info(f"Using YouTube OAuth 2.0 authentication: {oauth_token_file}")
        # Priority 2: Cookies file (fallback)
        elif os.path.exists(cookie_file):
            opts["cookiefile"] = cookie_file
            logger.info(f"Using YouTube cookies file: {cookie_file}")
        else:
            logger.warning(
                "No YouTube authentication configured. "
                "Run scripts/youtube_oauth_setup.py or upload cookies via /v1/youtube/upload-cookies"
            )

        return opts

    def _extract_info(self, url: str, ydl_opts: Dict) -> Dict:
        """Synchronous method to extract video info using yt-dlp."""
        # Log URL before passing to yt-dlp
        logger.info(f"[URL_DEBUG] _extract_info called with URL: {url}")
        logger.info(f"[URL_DEBUG] URL type: {type(url).__name__}, repr: {repr(url)}")

        # Merge with common options
        merged_opts = {**self._get_common_ydl_opts(), **ydl_opts}
        # Remove None values
        merged_opts = {k: v for k, v in merged_opts.items() if v is not None}

        # Enable verbose logging in yt-dlp for debugging
        merged_opts['verbose'] = True

        logger.info(f"[URL_DEBUG] Calling yt-dlp extract_info with URL: {url}")

        with yt_dlp.YoutubeDL(merged_opts) as ydl:
            return ydl.extract_info(url, download=False)

    def _download_video_sync(self, url: str, ydl_opts: Dict) -> Dict:
        """Synchronous method to download video using yt-dlp."""
        # Merge with common options
        merged_opts = {**self._get_common_ydl_opts(), **ydl_opts}
        # Remove None values
        merged_opts = {k: v for k, v in merged_opts.items() if v is not None}

        with yt_dlp.YoutubeDL(merged_opts) as ydl:
            return ydl.extract_info(url, download=True)

    def _get_format_string(self, quality: str) -> str:
        """
        Get yt-dlp format string based on quality preference.

        Args:
            quality: Quality preference

        Returns:
            Format string for yt-dlp

        Note:
            - Removed [ext=mp4] restriction to allow high-quality webm/VP9 formats
            - merge_output_format='mp4' will automatically convert to MP4
            - This ensures we get the highest quality available (including 1080p+)
        """
        format_map = {
            # Best quality: Allow any format, will be merged to MP4
            "best": "bestvideo+bestaudio/best",

            # Quality-specific: Limit height but allow any codec
            # YouTube often uses VP9/webm for high quality, which will be converted to MP4
            "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
            "720p": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
            "480p": "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
        }

        return format_map.get(quality, format_map["best"])

    def _estimate_filesize(self, info: Dict) -> int:
        """
        Estimate file size from video info.

        Args:
            info: Video info dictionary from yt-dlp

        Returns:
            Estimated file size in bytes
        """
        # Try to get filesize from requested format
        requested_formats = info.get("requested_formats", [])
        if requested_formats:
            total_size = 0
            for fmt in requested_formats:
                filesize = fmt.get("filesize") or fmt.get("filesize_approx") or 0
                total_size += filesize
            if total_size > 0:
                return total_size

        # Fallback: try to get from best format
        formats = info.get("formats", [])
        if formats:
            # Find best format with filesize
            for fmt in reversed(formats):
                filesize = fmt.get("filesize") or fmt.get("filesize_approx")
                if filesize:
                    return filesize

        # Last resort: estimate based on duration and bitrate
        duration = info.get("duration", 0)
        # Assume average bitrate of 2 Mbps for video + audio
        estimated_bitrate = 2 * 1024 * 1024 / 8  # 2 Mbps in bytes per second
        return int(duration * estimated_bitrate)

    async def check_captions_available(self, url: str) -> Dict:
        """
        Check if captions/subtitles are available for a YouTube video.

        Args:
            url: YouTube video URL

        Returns:
            Dictionary containing caption availability info:
            - has_captions: Boolean indicating if captions are available
            - available_languages: List of available caption languages
            - caption_types: Dict mapping language to caption type (manual/auto)
        """
        # Validate URL
        if not validate_youtube_url(url):
            raise VideoProcessingException(
                ErrorCodes.YOUTUBE_INVALID_URL,
                f"Invalid YouTube URL: {url}",
                status_code=400,
            )

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "writesubtitles": False,
            "listsubtitles": True,
        }

        try:
            import concurrent.futures
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                info = await loop.run_in_executor(
                    executor, lambda: self._extract_info(url, ydl_opts)
                )

            subtitles = info.get("subtitles", {})
            automatic_captions = info.get("automatic_captions", {})

            available_languages = []
            caption_types = {}

            # Manual subtitles
            for lang in subtitles.keys():
                available_languages.append(lang)
                caption_types[lang] = "manual"

            # Auto-generated captions
            for lang in automatic_captions.keys():
                if lang not in available_languages:
                    available_languages.append(lang)
                caption_types[lang] = "auto"

            return {
                "has_captions": len(available_languages) > 0,
                "available_languages": available_languages,
                "caption_types": caption_types,
            }

        except Exception as e:
            self.logger.error(f"Failed to check caption availability: {str(e)}", exc_info=True)
            return {
                "has_captions": False,
                "available_languages": [],
                "caption_types": {},
            }

    async def download_captions(
        self,
        url: str,
        languages: Optional[List[str]] = None,
        prefer_manual: bool = True,
        output_dir: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Download captions/subtitles from YouTube video.

        Args:
            url: YouTube video URL
            languages: List of language codes to download (e.g., ['ko', 'en'])
                      If None, downloads all available captions
            prefer_manual: If True, prefer manual subtitles over auto-generated
            output_dir: Optional directory to save caption files

        Returns:
            Dictionary mapping language code to caption file path

        Raises:
            VideoProcessingException: If caption download fails
        """
        # Validate URL
        if not validate_youtube_url(url):
            raise VideoProcessingException(
                ErrorCodes.YOUTUBE_INVALID_URL,
                f"Invalid YouTube URL: {url}",
                status_code=400,
            )

        # Create output directory if not provided
        if output_dir is None:
            output_dir = tempfile.mkdtemp(prefix="youtube_captions_")

        # Get video ID for file naming
        video_id = extract_video_id(url)

        # Build subtitle languages string
        if languages:
            sub_langs = ",".join(languages)
        else:
            sub_langs = "all"

        # Configure yt-dlp options for caption download
        ydl_opts = {
            "skip_download": True,  # Don't download video
            "writesubtitles": True,  # Write manual subtitles
            "writeautomaticsub": not prefer_manual or languages is None,  # Write auto-generated if needed
            "subtitleslangs": [sub_langs] if sub_langs != "all" else ["all"],
            "subtitlesformat": "srt/vtt/best",  # Prefer SRT, fallback to VTT
            "outtmpl": os.path.join(output_dir, f"{video_id}.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
        }

        try:
            # Download captions in thread pool
            import concurrent.futures
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                await loop.run_in_executor(
                    executor, lambda: self._download_captions_sync(url, ydl_opts)
                )

            # Find downloaded caption files
            caption_files = {}
            for file in os.listdir(output_dir):
                if file.startswith(video_id) and (file.endswith(".srt") or file.endswith(".vtt")):
                    # Extract language code from filename
                    # Format: {video_id}.{lang}.srt or {video_id}.{lang}.vtt
                    parts = file.split(".")
                    if len(parts) >= 3:
                        lang = parts[-2]
                        caption_files[lang] = os.path.join(output_dir, file)

            if not caption_files:
                self.logger.warning(f"No captions found for video: {url}")
                return {}

            self.logger.info(f"Downloaded captions for languages: {list(caption_files.keys())}")
            return caption_files

        except Exception as e:
            self.logger.error(f"Failed to download captions: {str(e)}", exc_info=True)
            raise VideoProcessingException(
                ErrorCodes.YOUTUBE_DOWNLOAD_FAILED,
                f"Failed to download captions: {str(e)}",
                status_code=500,
            )

    def _download_captions_sync(self, url: str, ydl_opts: Dict) -> None:
        """Synchronous method to download captions using yt-dlp."""
        # Merge with common options
        merged_opts = {**self._get_common_ydl_opts(), **ydl_opts}
        # Remove None values
        merged_opts = {k: v for k, v in merged_opts.items() if v is not None}

        with yt_dlp.YoutubeDL(merged_opts) as ydl:
            ydl.download([url])

    async def get_captions_as_segments(
        self,
        url: str,
        languages: Optional[List[str]] = None,
    ) -> Dict[str, List[CaptionSegment]]:
        """
        Download and parse YouTube captions into timestamped segments.

        Args:
            url: YouTube video URL
            languages: List of language codes to download (e.g., ['ko', 'en'])

        Returns:
            Dictionary mapping language code to list of CaptionSegment objects

        Raises:
            VideoProcessingException: If caption download or parsing fails
        """
        # Download captions
        caption_files = await self.download_captions(url, languages=languages)

        if not caption_files:
            self.logger.warning(f"No captions available for video: {url}")
            return {}

        # Parse each caption file
        parsed_captions = {}
        for lang, file_path in caption_files.items():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Determine format and parse
                if file_path.endswith(".srt"):
                    segments = CaptionParser.parse_srt(content)
                elif file_path.endswith(".vtt"):
                    segments = CaptionParser.parse_vtt(content)
                else:
                    self.logger.warning(f"Unknown caption format: {file_path}")
                    continue

                if segments:
                    parsed_captions[lang] = segments
                    self.logger.info(
                        f"Parsed {len(segments)} caption segments for language: {lang}"
                    )

            except Exception as e:
                self.logger.error(f"Failed to parse caption file {file_path}: {str(e)}", exc_info=True)
                continue

        return parsed_captions


# Singleton instance
youtube_download_service = YouTubeDownloadService()
