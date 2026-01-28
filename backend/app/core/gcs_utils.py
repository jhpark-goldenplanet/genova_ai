"""
Utility functions for Google Cloud Storage path management and operations.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple
from urllib.parse import urlparse

from app.core.gcs_config import get_gcs_settings


def generate_video_gcs_path(
    video_id: uuid.UUID,
    filename: str,
    folder: Optional[str] = None
) -> str:
    """
    Generate organized GCS path for video storage.

    Args:
        video_id: Video UUID
        filename: Original filename
        folder: Optional custom folder (defaults to configured video folder)

    Returns:
        GCS path string
    """
    settings = get_gcs_settings()
    folder = folder or settings.gcs_video_folder
    
    # Extract file extension
    _, ext = os.path.splitext(filename)
    if not ext:
        ext = ".mp4"  # Default extension
    
    # Create date-based organization
    now = datetime.now(timezone.utc)
    date_path = now.strftime("%Y/%m/%d")
    
    # Generate unique filename with video ID
    unique_filename = f"{video_id}{ext}"
    
    return f"{folder}/{date_path}/{unique_filename}"


def generate_thumbnail_gcs_path(
    video_id: uuid.UUID,
    extension: str = ".jpg",
    folder: Optional[str] = None
) -> str:
    """
    Generate GCS path for video thumbnail.

    Args:
        video_id: Video UUID
        extension: Image file extension
        folder: Optional custom folder (defaults to configured thumbnail folder)

    Returns:
        GCS thumbnail path string
    """
    settings = get_gcs_settings()
    folder = folder or settings.gcs_thumbnail_folder
    
    now = datetime.now(timezone.utc)
    date_path = now.strftime("%Y/%m/%d")
    
    return f"{folder}/{date_path}/{video_id}{extension}"


def generate_segment_gcs_path(
    video_id: uuid.UUID,
    segment_no: int,
    extension: str = ".mp4",
    folder: Optional[str] = None
) -> str:
    """
    Generate GCS path for video segment.

    Args:
        video_id: Video UUID
        segment_no: Segment number
        extension: Video file extension
        folder: Optional custom folder (defaults to configured segment folder)

    Returns:
        GCS segment path string
    """
    settings = get_gcs_settings()
    folder = folder or settings.gcs_segment_folder
    
    now = datetime.now(timezone.utc)
    date_path = now.strftime("%Y/%m/%d")
    
    return f"{folder}/{date_path}/{video_id}/segment_{segment_no:02d}{extension}"


def parse_gcs_path(gcs_path: str) -> dict:
    """
    Parse GCS path to extract components.

    Args:
        gcs_path: GCS object path

    Returns:
        Dictionary with path components
    """
    parts = gcs_path.split("/")
    
    if len(parts) < 2:
        return {"folder": "", "date_path": "", "filename": gcs_path}
    
    folder = parts[0]
    filename = parts[-1]
    
    # Try to extract date path (YYYY/MM/DD format)
    date_path = ""
    if len(parts) >= 4:
        potential_date = "/".join(parts[1:4])
        try:
            datetime.strptime(potential_date, "%Y/%m/%d")
            date_path = potential_date
        except ValueError:
            pass
    
    return {
        "folder": folder,
        "date_path": date_path,
        "filename": filename,
        "full_path": gcs_path,
        "parts": parts
    }


def extract_video_id_from_gcs_path(gcs_path: str) -> Optional[uuid.UUID]:
    """
    Extract video ID from GCS path.

    Args:
        gcs_path: GCS object path

    Returns:
        Video UUID if found, None otherwise
    """
    try:
        filename = os.path.basename(gcs_path)
        name_without_ext = os.path.splitext(filename)[0]
        
        # Handle segment paths (e.g., "video_id/segment_01.mp4")
        if "segment_" in name_without_ext:
            # Extract video ID from parent directory
            parent_dir = os.path.dirname(gcs_path)
            potential_id = os.path.basename(parent_dir)
            return uuid.UUID(potential_id)
        
        # Handle regular video files (e.g., "video_id.mp4")
        return uuid.UUID(name_without_ext)
        
    except (ValueError, AttributeError):
        return None


def get_gcs_public_url(bucket_name: str, gcs_path: str) -> str:
    """
    Generate public HTTPS URL for GCS object.

    Args:
        bucket_name: GCS bucket name
        gcs_path: GCS object path

    Returns:
        Public HTTPS URL
    """
    return f"https://storage.googleapis.com/{bucket_name}/{gcs_path}"


def get_gcs_gs_url(bucket_name: str, gcs_path: str) -> str:
    """
    Generate gs:// URL for GCS object.

    Args:
        bucket_name: GCS bucket name
        gcs_path: GCS object path

    Returns:
        gs:// URL
    """
    return f"gs://{bucket_name}/{gcs_path}"


def validate_gcs_path(gcs_path: str) -> bool:
    """
    Validate GCS path format.

    Args:
        gcs_path: GCS object path

    Returns:
        True if valid, False otherwise
    """
    if not gcs_path or not isinstance(gcs_path, str):
        return False
    
    # Check for invalid characters
    invalid_chars = ["\\", "^", "`", "{", "}", "|", "[", "]", "\"", "<", ">"]
    if any(char in gcs_path for char in invalid_chars):
        return False
    
    # Check length (GCS object names can be up to 1024 characters)
    if len(gcs_path) > 1024:
        return False
    
    # Check for consecutive slashes
    if "//" in gcs_path:
        return False
    
    # Check if starts or ends with slash
    if gcs_path.startswith("/") or gcs_path.endswith("/"):
        return False
    
    return True


def sanitize_filename_for_gcs(filename: str) -> str:
    """
    Sanitize filename for GCS storage.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename safe for GCS
    """
    if not filename:
        return "unknown_file"
    
    # Replace invalid characters with underscore
    invalid_chars = ["\\", "^", "`", "{", "}", "|", "[", "]", "\"", "<", ">", "?", "*"]
    sanitized = filename
    
    for char in invalid_chars:
        sanitized = sanitized.replace(char, "_")
    
    # Replace multiple consecutive underscores with single underscore
    import re
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Remove leading/trailing underscores and dots
    sanitized = sanitized.strip("_.")
    
    # Ensure filename is not empty
    if not sanitized:
        sanitized = "unknown_file"
    
    # Limit length (keeping some buffer for extensions and prefixes)
    if len(sanitized) > 200:
        name, ext = os.path.splitext(sanitized)
        sanitized = name[:200-len(ext)] + ext
    
    return sanitized


def get_content_type_from_extension(filename: str) -> Optional[str]:
    """
    Get content type from file extension.

    Args:
        filename: Filename with extension

    Returns:
        Content type string or None
    """
    ext = os.path.splitext(filename)[1].lower()
    
    content_type_map = {
        # Video formats
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".wmv": "video/x-ms-wmv",
        ".flv": "video/x-flv",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".m4v": "video/x-m4v",
        ".3gp": "video/3gpp",
        ".ogv": "video/ogg",
        
        # Image formats
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".svg": "image/svg+xml",
        
        # Audio formats
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
    }
    
    return content_type_map.get(ext)


def calculate_storage_cost_estimate(size_bytes: int, storage_class: str = "STANDARD") -> dict:
    """
    Calculate estimated storage cost for GCS.

    Args:
        size_bytes: File size in bytes
        storage_class: GCS storage class

    Returns:
        Dictionary with cost estimates
    """
    # GCS pricing (approximate, as of 2024)
    pricing_per_gb_month = {
        "STANDARD": 0.020,
        "NEARLINE": 0.010,
        "COLDLINE": 0.004,
        "ARCHIVE": 0.0012,
    }
    
    size_gb = size_bytes / (1024 ** 3)
    monthly_cost = size_gb * pricing_per_gb_month.get(storage_class, 0.020)
    
    return {
        "size_bytes": size_bytes,
        "size_gb": round(size_gb, 4),
        "storage_class": storage_class,
        "estimated_monthly_cost_usd": round(monthly_cost, 4),
        "estimated_yearly_cost_usd": round(monthly_cost * 12, 2),
    }


def generate_batch_gcs_paths(
    video_ids: list[uuid.UUID],
    base_filename: str,
    folder: Optional[str] = None
) -> list[str]:
    """
    Generate multiple GCS paths for batch operations.

    Args:
        video_ids: List of video UUIDs
        base_filename: Base filename template
        folder: Optional custom folder

    Returns:
        List of GCS paths
    """
    settings = get_gcs_settings()
    folder = folder or settings.gcs_video_folder
    
    # Create date-based organization
    now = datetime.now(timezone.utc)
    date_path = now.strftime("%Y/%m/%d")
    
    paths = []
    for video_id in video_ids:
        # Generate filename with base_filename and video_id
        filename = f"{base_filename}_{video_id}.mp4"
        path = f"{folder}/{date_path}/{filename}"
        paths.append(path)
    
    return paths