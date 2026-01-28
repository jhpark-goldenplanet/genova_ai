"""
File validation functions for video uploads.
"""

import os
import tempfile
from typing import Optional, Tuple
from urllib.parse import urlparse

import aiofiles
import aiohttp
from fastapi import HTTPException, UploadFile

try:
    import magic

    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False

import ffmpeg

from app.core.exceptions import ErrorCodes, VideoProcessingException

# Allowed video MIME types
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-ms-wmv",
    "video/x-flv",
    "video/webm",
    "video/x-matroska",
}

# File size limits
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB in bytes
MIN_DURATION = 60  # 1 minute in seconds
MAX_DURATION = 45 * 60  # 45 minutes in seconds (2700 seconds)


async def validate_video_file(file: UploadFile) -> Tuple[str, int, int]:
    """
    Validate uploaded video file for size, format, and duration.

    Args:
        file: FastAPI UploadFile object

    Returns:
        Tuple of (mime_type, file_size_bytes, duration_seconds)

    Raises:
        VideoProcessingException: If validation fails
    """
    # Check file size
    if hasattr(file, "size") and file.size is not None:
        if file.size > MAX_FILE_SIZE:
            raise VideoProcessingException(
                ErrorCodes.FILE_SIZE_EXCEEDED,
                f"File size {file.size} bytes exceeds maximum allowed size of {MAX_FILE_SIZE} bytes",
            )

    # Create temporary file to validate content
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        try:
            # Read file content
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()

            # Reset file pointer for later use
            await file.seek(0)

            # Validate file format
            if MAGIC_AVAILABLE:
                mime_type = magic.from_file(temp_file.name, mime=True)
            else:
                # Fallback to file extension-based detection
                mime_type = _get_mime_type_from_filename(file.filename or "")

            if mime_type not in ALLOWED_VIDEO_TYPES:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_FILE_FORMAT,
                    f"Unsupported file format: {mime_type}. Allowed formats: {', '.join(ALLOWED_VIDEO_TYPES)}",
                )

            # Get actual file size
            file_size = os.path.getsize(temp_file.name)

            # Double-check file size
            if file_size > MAX_FILE_SIZE:
                raise VideoProcessingException(
                    ErrorCodes.FILE_SIZE_EXCEEDED,
                    f"File size {file_size} bytes exceeds maximum allowed size of {MAX_FILE_SIZE} bytes",
                )

            # Validate video duration using ffmpeg
            duration = await _get_video_duration(temp_file.name)

            if duration < MIN_DURATION:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_TOO_SHORT,
                    f"Video duration {duration} seconds is less than minimum required {MIN_DURATION} seconds",
                )

            if duration > MAX_DURATION:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_TOO_LONG,
                    f"Video duration {duration} seconds exceeds maximum allowed {MAX_DURATION} seconds (45 minutes)",
                )

            return mime_type, file_size, duration

        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file.name)
            except OSError:
                pass


async def validate_video_url(url: str) -> Tuple[str, str, bool]:
    """
    Validate video URL and check if it's accessible.
    Supports both direct video file URLs and YouTube URLs.

    Args:
        url: Video URL to validate

    Returns:
        Tuple of (validated_url, content_type, is_youtube)

    Raises:
        VideoProcessingException: If URL validation fails
    """
    from app.core.youtube_utils import is_youtube_url

    # Check if YouTube URL
    if is_youtube_url(url):
        # YouTube URLs don't need HEAD request validation
        # They will be validated by the YouTube download service
        return url, "video/mp4", True

    # Parse URL for direct video files
    parsed_url = urlparse(url)

    if not parsed_url.scheme or not parsed_url.netloc:
        raise VideoProcessingException(
            ErrorCodes.INVALID_VIDEO_URL, f"Invalid URL format: {url}"
        )

    if parsed_url.scheme not in ("http", "https"):
        raise VideoProcessingException(
            ErrorCodes.INVALID_VIDEO_URL,
            f"Unsupported URL scheme: {parsed_url.scheme}. Only HTTP and HTTPS are supported",
        )

    # Check if URL is accessible and get content type
    logger.info(f"Validating video URL: {url}")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.head(
                url, timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                logger.info(f"URL HEAD response: status={response.status}, content-type={response.headers.get('content-type', 'N/A')}")

                if response.status >= 400:
                    raise VideoProcessingException(
                        ErrorCodes.INVALID_VIDEO_URL,
                        f"URL is not accessible: HTTP {response.status}",
                    )

                content_type = (
                    response.headers.get("content-type", "").split(";")[0].strip()
                )

                if content_type not in ALLOWED_VIDEO_TYPES:
                    logger.warning(
                        f"Invalid content type for URL: {url}, "
                        f"Content-Type: {content_type}, "
                        f"Allowed types: {ALLOWED_VIDEO_TYPES}"
                    )
                    raise VideoProcessingException(
                        ErrorCodes.INVALID_FILE_FORMAT,
                        f"URL does not point to a supported video format. Content-Type: {content_type}",
                    )

                # Check content length if available
                content_length = response.headers.get("content-length")
                if content_length:
                    file_size = int(content_length)
                    if file_size > MAX_FILE_SIZE:
                        raise VideoProcessingException(
                            ErrorCodes.FILE_SIZE_EXCEEDED,
                            f"Video file size {file_size} bytes exceeds maximum allowed size of {MAX_FILE_SIZE} bytes",
                        )

                return url, content_type, False

    except VideoProcessingException:
        # Re-raise VideoProcessingException as-is
        raise
    except aiohttp.ClientError as e:
        raise VideoProcessingException(
            ErrorCodes.INVALID_VIDEO_URL, f"Failed to access URL: {str(e)}"
        )
    except Exception as e:
        raise VideoProcessingException(
            ErrorCodes.INVALID_VIDEO_URL, f"URL validation failed: {str(e)}"
        )


async def download_video_from_url(url: str, destination_path: str) -> Tuple[int, int]:
    """
    Download video from URL and validate it.

    Args:
        url: Video URL to download
        destination_path: Local path to save the video

    Returns:
        Tuple of (file_size_bytes, duration_seconds)

    Raises:
        VideoProcessingException: If download or validation fails
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url, timeout=aiohttp.ClientTimeout(total=300)
            ) as response:
                if response.status >= 400:
                    raise VideoProcessingException(
                        ErrorCodes.INVALID_VIDEO_URL,
                        f"Failed to download video: HTTP {response.status}",
                    )

                # Download file
                async with aiofiles.open(destination_path, "wb") as f:
                    downloaded_size = 0
                    async for chunk in response.content.iter_chunked(8192):
                        downloaded_size += len(chunk)

                        # Check size during download
                        if downloaded_size > MAX_FILE_SIZE:
                            raise VideoProcessingException(
                                ErrorCodes.FILE_SIZE_EXCEEDED,
                                f"Video file size exceeds maximum allowed size of {MAX_FILE_SIZE} bytes",
                            )

                        await f.write(chunk)

                # Get final file size
                file_size = os.path.getsize(destination_path)

                # Validate video duration
                duration = await _get_video_duration(destination_path)

                if duration < MIN_DURATION:
                    raise VideoProcessingException(
                        ErrorCodes.VIDEO_TOO_SHORT,
                        f"Video duration {duration} seconds is less than minimum required {MIN_DURATION} seconds",
                    )

                if duration > MAX_DURATION:
                    raise VideoProcessingException(
                        ErrorCodes.VIDEO_TOO_LONG,
                        f"Video duration {duration} seconds exceeds maximum allowed {MAX_DURATION} seconds (45 minutes)",
                    )

                return file_size, duration

    except aiohttp.ClientError as e:
        raise VideoProcessingException(
            ErrorCodes.INVALID_VIDEO_URL, f"Failed to download video: {str(e)}"
        )
    except Exception as e:
        if isinstance(e, VideoProcessingException):
            raise
        raise VideoProcessingException(
            ErrorCodes.INVALID_VIDEO_URL, f"Video download failed: {str(e)}"
        )


async def _get_video_duration(file_path: str) -> int:
    """
    Get video duration in seconds using ffmpeg.

    Args:
        file_path: Path to video file

    Returns:
        Duration in seconds

    Raises:
        VideoProcessingException: If duration extraction fails
    """
    try:
        probe = ffmpeg.probe(file_path)
        duration = float(probe["streams"][0]["duration"])
        return int(duration)
    except (ffmpeg.Error, KeyError, ValueError, IndexError) as e:
        raise VideoProcessingException(
            ErrorCodes.INVALID_FILE_FORMAT,
            f"Failed to extract video duration: {str(e)}",
        )


def _get_mime_type_from_filename(filename: str) -> str:
    """
    Get MIME type from file extension as fallback.

    Args:
        filename: File name with extension

    Returns:
        MIME type string
    """
    if not filename:
        return "application/octet-stream"

    extension = os.path.splitext(filename.lower())[1]

    extension_map = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".wmv": "video/x-ms-wmv",
        ".flv": "video/x-flv",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
    }

    return extension_map.get(extension, "application/octet-stream")


def validate_filename(filename: str) -> str:
    """
    Validate and sanitize filename.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    if not filename:
        return "unknown_video"

    # Remove path components and keep only the filename
    filename = os.path.basename(filename)

    # Remove or replace invalid characters
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, "_")

    # Limit filename length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:250] + ext

    return filename
