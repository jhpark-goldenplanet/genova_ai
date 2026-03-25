"""
Pydantic schemas for video-related API requests and responses.
"""

import base64
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VideoBase(BaseModel):
    """Base video schema with common fields."""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class VideoCreate(VideoBase):
    """Schema for creating a new video."""

    source_type: str = Field(
        default="FILE_UPLOAD", pattern="^(FILE_UPLOAD|URL_UPLOAD)$"
    )
    original_filename: Optional[str] = Field(None, max_length=255)
    mime_type: Optional[str] = Field(None, max_length=100)


class VideoUpdate(BaseModel):
    """Schema for updating video information."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = Field(
        None, pattern="^(PENDING|IN_PROGRESS|COMPLETE|FAILED)$"
    )
    processing_progress: Optional[int] = Field(None, ge=0, le=100)
    duration_seconds: Optional[int] = Field(None, ge=0)
    file_size_bytes: Optional[int] = Field(None, ge=0)
    gcs_path: Optional[str] = Field(None, max_length=500)
    summary: Optional[str] = None
    keywords: Optional[List[str]] = None


class VideoResponse(BaseModel):
    """Schema for video API responses."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    video_id: uuid.UUID
    status: str
    message: Optional[str] = None

    @classmethod
    def from_video(cls, video, message: Optional[str] = None):
        """Create response from video model."""
        return cls(video_id=video.id, status=video.status, message=message)


class VideoStatusResponse(BaseModel):
    """Schema for video status API responses matching frontend IGetStatusFileSchema."""

    code: int = Field(default=200, description="HTTP response code")
    error_code: int = Field(default=0, description="Application error code (0 = no error)")
    message: str = Field(default="Success", description="Response message")
    status: str = Field(..., pattern="^(PENDING|IN_PROGRESS|COMPLETE|FAILED|CANCELED|INVALID_VIDEO_ID)$")
    video_id: uuid.UUID = Field(..., description="Video identifier")
    progress: int = Field(..., ge=0, le=100)
    step: Optional[str] = Field(
        None,
        pattern="^(UPLOADING|UPLOADING_TO_GCS|DOWNLOADING|EXTRACTING_METADATA|SUMMARIZATION|TRANSCRIBE|SEGMENTING|TRANSLATING|FINALIZING)$"
    )
    segments: Optional[List[dict]] = None


class SegmentBase(BaseModel):
    """Base segment schema with common fields."""

    segment_no: int = Field(..., ge=1)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}:\d{2}$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}:\d{2}$")
    title: str = Field(..., min_length=1, max_length=255)
    summary: Optional[str] = None
    keywords: Optional[List[str]] = None
    scripts: Optional[str] = None
    class_type: Optional[str] = Field(
        None, pattern="^(introduction|content|conclusion)$"
    )


class SegmentCreate(SegmentBase):
    """Schema for creating a new segment."""

    video_id: uuid.UUID


class SegmentUpdate(BaseModel):
    """Schema for updating segment information."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    summary: Optional[str] = None
    keywords: Optional[List[str]] = None
    scripts: Optional[str] = None
    class_type: Optional[str] = Field(
        None, pattern="^(introduction|content|conclusion)$"
    )


class SegmentResponse(SegmentBase):
    """Schema for segment API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class VideoDetailResponse(BaseModel):
    """Schema for detailed video information with segments."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: Optional[str] = None
    source_type: str
    status: str
    processing_progress: int
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    gcs_path: Optional[str] = None
    summary: Optional[str] = None
    keywords: Optional[List[str]] = None
    segments: List[SegmentResponse] = []
    created_at: datetime
    updated_at: datetime


class AnalyzeResponse(BaseModel):
    """Schema for video analysis API responses."""

    title: str
    summary: str
    keywords: List[str]
    segments: List[SegmentResponse]
    processing_status: str = Field(
        ..., pattern="^(PENDING|PENDING_UPLOAD|UPLOADED|IN_PROGRESS|COMPLETE|FAILED)$"
    )
    source_language: str = Field(..., description="Source language of the video content")
    gcs_view_link: Optional[str] = Field(None, description="URL to view the original video")
    thumbnail_url: Optional[str] = Field(None, description="URL to the video thumbnail image")


class SplitDownloadRequest(BaseModel):
    """Schema for video split download requests."""

    segments: List[dict] = Field(..., min_length=1, max_length=10)
    analysis_id: Optional[uuid.UUID] = Field(None, description="Analysis ID for segment lookup")
    thumbnail_image: Optional[str] = Field(
        None, description="Base64 encoded thumbnail image (without data URI prefix)"
    )

    @field_validator("thumbnail_image")
    @classmethod
    def validate_base64_image(cls, v: Optional[str]) -> Optional[str]:
        """Validate that thumbnail_image is valid base64 string."""
        if v is None:
            return v

        # Remove data URI prefix if present (e.g., "data:image/png;base64,...")
        if v.startswith("data:"):
            try:
                # Extract base64 part after comma
                v = v.split(",", 1)[1]
            except IndexError:
                raise ValueError("Invalid data URI format for thumbnail_image")

        # Validate base64 encoding
        try:
            # Try to decode to validate it's proper base64
            decoded = base64.b64decode(v, validate=True)

            # Check if it looks like an image (starts with common image file signatures)
            # PNG: 89 50 4E 47, JPEG: FF D8 FF, GIF: 47 49 46
            if len(decoded) < 4:
                raise ValueError("Thumbnail image data too short")

            # Validate it's an image format
            image_signatures = [
                b'\x89PNG',  # PNG
                b'\xFF\xD8\xFF',  # JPEG
                b'GIF',  # GIF
            ]

            is_valid_image = any(decoded.startswith(sig) for sig in image_signatures)
            if not is_valid_image:
                raise ValueError("Thumbnail must be PNG, JPEG, or GIF image")

            return v

        except Exception as e:
            raise ValueError(f"Invalid base64 encoded image: {str(e)}")


class SplitDownloadResponse(BaseModel):
    """Schema for video split download responses."""

    download_urls: List[dict] = Field(
        ..., description="List of download URLs for each segment"
    )
    expires_at: datetime = Field(..., description="When the download URLs expire")


class GetUploadUrlRequest(BaseModel):
    """Schema for requesting a signed upload URL for direct GCS upload."""

    filename: str = Field(..., min_length=1, max_length=255, description="Original filename")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    content_type: str = Field(default="video/mp4", description="MIME type")
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Optional video title")
    description: Optional[str] = Field(None, max_length=1000, description="Optional description")


class GetUploadUrlResponse(BaseModel):
    """Schema for signed upload URL response."""

    video_id: uuid.UUID = Field(..., description="Video identifier")
    upload_url: str = Field(..., description="Signed URL for uploading file to GCS")
    gcs_path: str = Field(..., description="GCS path where file will be stored")
    expires_at: datetime = Field(..., description="When the upload URL expires")


class ConfirmUploadRequest(BaseModel):
    """Schema for confirming upload and starting processing."""

    video_id: uuid.UUID = Field(..., description="Video identifier from getUploadUrl")
    language: Optional[str] = Field(default="ko", pattern="^(ko|en|ja|zh)$", description="Language for analysis")
    option: Optional[str] = Field(default="B", pattern="^(A|B)$", description="A=lightweight, B=premium multimodal")
    mode: Optional[str] = Field(default="AUTO", pattern="^(AUTO|CUSTOM)$", description="AUTO or CUSTOM")
    split_count: Optional[int] = Field(default=0, ge=0, le=10, description="0=auto, 3-10=specified")
    prompt_tags: Optional[List[str]] = Field(default=None, description="Tags for CUSTOM mode")


class CreateAnalysisRequest(BaseModel):
    """Schema for creating a new analysis on an existing video."""

    title: Optional[str] = Field(None, max_length=255, description="Analysis title (auto-generated if omitted)")
    option: str = Field(default="B", pattern="^(A|B)$", description="A=lightweight STT+text, B=premium multimodal")
    mode: str = Field(default="AUTO", pattern="^(AUTO|CUSTOM)$", description="AUTO or CUSTOM")
    split_count: int = Field(default=0, ge=0, le=10, description="0=auto, 3-10=user specified")
    prompt_tags: Optional[List[str]] = Field(None, description="Tags for CUSTOM mode")
    language: Optional[str] = Field(default="ko", pattern="^(ko|en|ja|zh)$", description="Source language")


class CreateAnalysisResponse(BaseModel):
    """Schema for analysis creation response."""

    video_id: uuid.UUID
    analysis_id: uuid.UUID
    analysis_no: int
    status: str
    message: str


class AnalysisListItem(BaseModel):
    """Schema for a single analysis in a list."""

    model_config = ConfigDict(from_attributes=True)

    analysis_id: uuid.UUID
    analysis_no: int
    title: str
    option: str
    mode: str
    split_count: int
    source_language: str
    status: str
    processing_progress: int
    thumbnail_url: Optional[str] = None
    token_usage: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class AnalysisListResponse(BaseModel):
    """Schema for listing analyses of a video."""

    video_id: uuid.UUID
    analyses: List[AnalysisListItem]
    total_count: int


class AnalysisDetailResponse(BaseModel):
    """Schema for detailed analysis result."""

    analysis_id: uuid.UUID
    analysis_no: int
    video_id: uuid.UUID
    title: str
    option: str
    mode: str
    split_count: int
    source_language: str
    status: str
    processing_progress: int
    summary: Optional[str] = ""
    keywords: Optional[List[str]] = []
    segments: List[SegmentResponse] = []
    token_usage: Optional[dict] = None
    gcs_view_link: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AnalysisStatusResponse(BaseModel):
    """Schema for analysis processing status."""

    analysis_id: uuid.UUID
    video_id: uuid.UUID
    status: str
    processing_progress: int


class ReanalyzeSegmentInput(BaseModel):
    """Single segment boundary for re-analysis."""

    segment_no: int = Field(..., ge=1)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}:\d{2}$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}:\d{2}$")


class ReanalyzeRequest(BaseModel):
    """Request body for re-analysis with custom split points."""

    segments: List[ReanalyzeSegmentInput] = Field(..., min_length=1, max_length=10)
    language: Optional[str] = Field(default="ko", pattern="^(ko|en|ja|zh)$")


class ReanalyzeResponse(BaseModel):
    """Response for re-analysis request."""

    video_id: uuid.UUID
    status: str
    message: str


class VideoUsageResponse(BaseModel):
    """Token usage summary for a single video."""

    video_id: uuid.UUID
    video_title: str
    total_analyses: int
    total_prompt_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    analyses: List[dict] = []


class UsageSummaryResponse(BaseModel):
    """Overall token usage summary."""

    total_videos: int
    total_analyses: int
    total_prompt_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    by_option: dict = {}
    by_video: List[dict] = []
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class ErrorResponse(BaseModel):
    """Schema for error responses."""

    error_code: int
    message: str
    timestamp: datetime
    details: Optional[dict] = None
