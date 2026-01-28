"""
Pydantic schemas for API request/response validation.
"""

from app.schemas.video import (
    AnalyzeResponse,
    ErrorResponse,
    SegmentBase,
    SegmentCreate,
    SegmentResponse,
    SegmentUpdate,
    SplitDownloadRequest,
    SplitDownloadResponse,
    VideoBase,
    VideoCreate,
    VideoDetailResponse,
    VideoResponse,
    VideoStatusResponse,
    VideoUpdate,
)

__all__ = [
    "VideoBase",
    "VideoCreate",
    "VideoUpdate",
    "VideoResponse",
    "VideoStatusResponse",
    "VideoDetailResponse",
    "SegmentBase",
    "SegmentCreate",
    "SegmentUpdate",
    "SegmentResponse",
    "AnalyzeResponse",
    "SplitDownloadRequest",
    "SplitDownloadResponse",
    "ErrorResponse",
]
