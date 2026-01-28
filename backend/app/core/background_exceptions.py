"""
Exception handling for background task processing.
"""

import logging
from typing import Any, Dict, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class BackgroundTaskException(Exception):
    """Base exception for background task processing errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        step: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.video_id = video_id
        self.step = step
        self.details = details or {}
        super().__init__(message)

    def __str__(self) -> str:
        parts = [self.message]
        if self.video_id:
            parts.append(f"Video ID: {self.video_id}")
        if self.step:
            parts.append(f"Step: {self.step}")
        return " | ".join(parts)


class VideoUploadException(BackgroundTaskException):
    """Exception for video upload errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        upload_type: str = "unknown",
        **kwargs,
    ):
        self.upload_type = upload_type
        super().__init__(message, video_id, "UPLOAD", **kwargs)


class VideoDownloadException(BackgroundTaskException):
    """Exception for video download errors from URLs."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        url: Optional[str] = None,
        **kwargs,
    ):
        self.url = url
        details = kwargs.get("details", {})
        if url:
            details["url"] = url
        super().__init__(message, video_id, "DOWNLOAD", details=details, **kwargs)


class GCSUploadException(BackgroundTaskException):
    """Exception for Google Cloud Storage upload errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        gcs_path: Optional[str] = None,
        **kwargs,
    ):
        self.gcs_path = gcs_path
        details = kwargs.get("details", {})
        if gcs_path:
            details["gcs_path"] = gcs_path
        super().__init__(message, video_id, "GCS_UPLOAD", details=details, **kwargs)


class MetadataExtractionException(BackgroundTaskException):
    """Exception for video metadata extraction errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        file_path: Optional[str] = None,
        **kwargs,
    ):
        self.file_path = file_path
        details = kwargs.get("details", {})
        if file_path:
            details["file_path"] = file_path
        super().__init__(message, video_id, "METADATA_EXTRACTION", details=details, **kwargs)


class AIAnalysisException(BackgroundTaskException):
    """Exception for AI analysis errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        ai_service: Optional[str] = None,
        **kwargs,
    ):
        self.ai_service = ai_service
        details = kwargs.get("details", {})
        if ai_service:
            details["ai_service"] = ai_service
        super().__init__(message, video_id, "AI_ANALYSIS", details=details, **kwargs)


class TranscriptionException(BackgroundTaskException):
    """Exception for speech-to-text transcription errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        language: Optional[str] = None,
        **kwargs,
    ):
        self.language = language
        details = kwargs.get("details", {})
        if language:
            details["language"] = language
        super().__init__(message, video_id, "TRANSCRIPTION", details=details, **kwargs)


class SegmentationException(BackgroundTaskException):
    """Exception for video segmentation errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        segment_count: Optional[int] = None,
        **kwargs,
    ):
        self.segment_count = segment_count
        details = kwargs.get("details", {})
        if segment_count:
            details["segment_count"] = segment_count
        super().__init__(message, video_id, "SEGMENTATION", details=details, **kwargs)


class TranslationException(BackgroundTaskException):
    """Exception for translation errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        source_language: Optional[str] = None,
        target_language: Optional[str] = None,
        **kwargs,
    ):
        self.source_language = source_language
        self.target_language = target_language
        details = kwargs.get("details", {})
        if source_language:
            details["source_language"] = source_language
        if target_language:
            details["target_language"] = target_language
        super().__init__(message, video_id, "TRANSLATION", details=details, **kwargs)


class TaskTimeoutException(BackgroundTaskException):
    """Exception for task timeout errors."""

    def __init__(
        self,
        message: str,
        video_id: Optional[UUID] = None,
        timeout_seconds: Optional[int] = None,
        **kwargs,
    ):
        self.timeout_seconds = timeout_seconds
        details = kwargs.get("details", {})
        if timeout_seconds:
            details["timeout_seconds"] = timeout_seconds
        super().__init__(message, video_id, "TIMEOUT", details=details, **kwargs)


class BackgroundTaskErrorHandler:
    """Centralized error handling for background tasks."""

    @staticmethod
    async def handle_exception(
        exception: Exception,
        video_id: UUID,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Handle and log background task exceptions.

        Args:
            exception: The exception that occurred
            video_id: Video identifier
            step: Processing step where error occurred
            context: Additional context information

        Returns:
            Formatted error message for status updates
        """
        context = context or {}

        # Log the exception with full context
        logger.error(
            f"Background task error for video {video_id} in step {step}: {str(exception)}",
            extra={
                "video_id": str(video_id),
                "step": step,
                "exception_type": type(exception).__name__,
                "context": context,
            },
            exc_info=True,
        )

        # Format error message based on exception type
        if isinstance(exception, BackgroundTaskException):
            error_message = f"{exception.step}: {exception.message}"
            if exception.details:
                details_str = ", ".join(f"{k}={v}" for k, v in exception.details.items())
                error_message += f" ({details_str})"
        else:
            error_message = f"{step or 'UNKNOWN'}: {str(exception)}"

        return error_message

    @staticmethod
    def create_timeout_exception(video_id: UUID, timeout_seconds: int) -> TaskTimeoutException:
        """Create a timeout exception with proper context."""
        return TaskTimeoutException(
            f"Processing timeout after {timeout_seconds} seconds",
            video_id=video_id,
            timeout_seconds=timeout_seconds,
        )

    @staticmethod
    def create_cancellation_exception(video_id: UUID, reason: str = "Manual cancellation") -> BackgroundTaskException:
        """Create a cancellation exception."""
        return BackgroundTaskException(
            f"Task cancelled: {reason}",
            video_id=video_id,
            step="CANCELLED",
        )


# Global error handler instance
background_error_handler = BackgroundTaskErrorHandler()