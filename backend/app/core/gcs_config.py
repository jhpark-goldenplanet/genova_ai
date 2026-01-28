"""
Google Cloud Storage configuration and settings.
"""

import os
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class GCSSettings(BaseSettings):
    """Google Cloud Storage configuration settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra environment variables
    )

    # GCP Project settings
    gcp_project_id: Optional[str] = Field(
        default=None,
        alias="GCP_PROJECT_ID",
        description="Google Cloud Project ID"
    )
    
    # GCS Bucket settings
    gcs_bucket_name: str = Field(
        default="genova-ai-videos",
        alias="GCS_BUCKET_NAME",
        description="Google Cloud Storage bucket name"
    )
    
    # Authentication settings
    google_application_credentials: Optional[str] = Field(
        default=None,
        alias="GOOGLE_APPLICATION_CREDENTIALS",
        description="Path to GCP service account key file"
    )
    
    # Storage organization settings
    gcs_video_folder: str = Field(
        default="videos",
        alias="GCS_VIDEO_FOLDER",
        description="Folder name for video files in GCS"
    )
    
    gcs_thumbnail_folder: str = Field(
        default="thumbnails",
        alias="GCS_THUMBNAIL_FOLDER",
        description="Folder name for thumbnail files in GCS"
    )
    
    gcs_segment_folder: str = Field(
        default="segments",
        alias="GCS_SEGMENT_FOLDER",
        description="Folder name for video segments in GCS"
    )
    
    # URL settings
    gcs_signed_url_expiration_hours: int = Field(
        default=24,
        alias="GCS_SIGNED_URL_EXPIRATION_HOURS",
        description="Default expiration time for signed URLs in hours"
    )
    
    # Upload settings
    gcs_max_upload_size_mb: int = Field(
        default=2048,  # 2GB
        alias="GCS_MAX_UPLOAD_SIZE_MB",
        description="Maximum upload size in MB"
    )
    
    gcs_allowed_video_types: list[str] = Field(
        default=[
            "video/mp4",
            "video/quicktime", 
            "video/x-msvideo",
            "video/x-ms-wmv",
            "video/x-flv",
            "video/webm",
            "video/x-matroska"
        ],
        description="Allowed video MIME types for upload"
    )
    
    gcs_allowed_image_types: list[str] = Field(
        default=[
            "image/jpeg",
            "image/png",
            "image/webp"
        ],
        description="Allowed image MIME types for thumbnails"
    )


def get_gcs_settings() -> GCSSettings:
    """Get GCS settings instance."""
    return GCSSettings()


def validate_gcs_configuration() -> tuple[bool, list[str]]:
    """
    Validate GCS configuration.
    
    Returns:
        Tuple of (is_valid, error_messages)
    """
    settings = get_gcs_settings()
    errors = []
    
    # Check if GCP project ID is set
    if not settings.gcp_project_id:
        errors.append("GCP_PROJECT_ID environment variable is not set")
    
    # Check if credentials are configured
    if not settings.google_application_credentials and not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        # Check if running in GCP environment (where default credentials are available)
        try:
            from google.auth import default
            default()
        except Exception:
            errors.append(
                "Google Cloud credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS "
                "environment variable or run 'gcloud auth application-default login'"
            )
    
    # Validate bucket name format
    bucket_name = settings.gcs_bucket_name
    if not bucket_name:
        errors.append("GCS bucket name is required")
    elif not (3 <= len(bucket_name) <= 63):
        errors.append("GCS bucket name must be between 3 and 63 characters")
    elif not bucket_name.replace("-", "").replace("_", "").replace(".", "").isalnum():
        errors.append("GCS bucket name contains invalid characters")
    
    # Validate upload size limits
    if settings.gcs_max_upload_size_mb <= 0:
        errors.append("GCS max upload size must be positive")
    elif settings.gcs_max_upload_size_mb > 5120:  # 5GB GCS limit
        errors.append("GCS max upload size cannot exceed 5GB (5120MB)")
    
    # Validate expiration hours
    if settings.gcs_signed_url_expiration_hours <= 0:
        errors.append("GCS signed URL expiration hours must be positive")
    elif settings.gcs_signed_url_expiration_hours > 168:  # 7 days max
        errors.append("GCS signed URL expiration cannot exceed 168 hours (7 days)")
    
    return len(errors) == 0, errors


def get_gcs_bucket_url(bucket_name: str, object_path: str) -> str:
    """
    Generate GCS public URL for an object.
    
    Args:
        bucket_name: GCS bucket name
        object_path: Object path in bucket
        
    Returns:
        Public GCS URL
    """
    return f"gs://{bucket_name}/{object_path}"


def get_gcs_https_url(bucket_name: str, object_path: str) -> str:
    """
    Generate HTTPS URL for GCS object.
    
    Args:
        bucket_name: GCS bucket name
        object_path: Object path in bucket
        
    Returns:
        HTTPS URL for GCS object
    """
    return f"https://storage.googleapis.com/{bucket_name}/{object_path}"