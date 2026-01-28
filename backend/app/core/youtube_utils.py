"""
YouTube URL validation and utility functions.
"""

import re
from typing import Optional


# YouTube URL regex patterns
YOUTUBE_REGEX_PATTERNS = [
    # Match youtube.com/watch with v= parameter anywhere in query string
    r"^(https?://)?(www\.)?youtube\.com/watch\?.*[&?]?v=[\w-]+",
    r"^(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+",  # v= as first parameter
    r"^(https?://)?(www\.)?youtu\.be/[\w-]+",
    r"^(https?://)?(www\.)?youtube\.com/embed/[\w-]+",
    r"^(https?://)?(www\.)?youtube\.com/v/[\w-]+",
    r"^(https?://)?(www\.)?youtube\.com/shorts/[\w-]+",
]


def is_youtube_url(url: str) -> bool:
    """
    Check if URL is a YouTube video URL.

    Args:
        url: URL to check

    Returns:
        True if URL is a YouTube video URL, False otherwise
    """
    if not url:
        return False

    # Check against all YouTube URL patterns
    for pattern in YOUTUBE_REGEX_PATTERNS:
        if re.match(pattern, url, re.IGNORECASE):
            return True

    return False


def extract_video_id(url: str) -> Optional[str]:
    """
    Extract YouTube video ID from URL.

    Args:
        url: YouTube URL

    Returns:
        Video ID if found, None otherwise

    Examples:
        >>> extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        'dQw4w9WgXcQ'
        >>> extract_video_id("https://youtu.be/dQw4w9WgXcQ")
        'dQw4w9WgXcQ'
    """
    if not url:
        return None

    # Pattern for standard youtube.com URLs
    match = re.search(r"(?:v=|v\/|vi=|vi\/|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})", url)
    if match:
        return match.group(1)

    return None


def normalize_youtube_url(url: str) -> Optional[str]:
    """
    Normalize YouTube URL to standard format.

    Args:
        url: YouTube URL in any format

    Returns:
        Normalized URL in format: https://www.youtube.com/watch?v={video_id}
        None if URL is invalid or video ID cannot be extracted

    Examples:
        >>> normalize_youtube_url("https://youtu.be/dQw4w9WgXcQ")
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        >>> normalize_youtube_url("youtube.com/watch?v=dQw4w9WgXcQ")
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    """
    video_id = extract_video_id(url)
    if not video_id:
        return None

    return f"https://www.youtube.com/watch?v={video_id}"


def validate_youtube_url(url: str) -> bool:
    """
    Validate YouTube URL format and extractability.

    Args:
        url: URL to validate

    Returns:
        True if URL is valid and video ID can be extracted, False otherwise
    """
    return is_youtube_url(url) and extract_video_id(url) is not None
