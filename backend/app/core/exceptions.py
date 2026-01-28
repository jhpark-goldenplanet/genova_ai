"""
Custom exceptions and error codes for the Genova AI Backend.
"""

import logging
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from fastapi import HTTPException

logger = logging.getLogger(__name__)


class ErrorCodes:
    """Standardized error codes for the application."""

    # File validation errors (1000-1099)
    INVALID_FILE_FORMAT = 1001
    FILE_SIZE_EXCEEDED = 1002
    VIDEO_TOO_SHORT = 1003
    INVALID_VIDEO_URL = 1004
    INVALID_REQUEST = 1005
    FILE_CORRUPTION = 1006
    UNSUPPORTED_CODEC = 1007
    VIDEO_TOO_LONG = 1008

    # Processing errors (1100-1199)
    PROCESSING_FAILED = 1100
    PROCESSING_TIMEOUT = 1101
    AI_SERVICE_ERROR = 1102
    TRANSCRIPTION_FAILED = 1103
    TRANSLATION_FAILED = 1104
    SEGMENTATION_FAILED = 1105
    METADATA_EXTRACTION_FAILED = 1106
    PROCESSING_CANCELLED = 1107

    # Database errors (1200-1299)
    VIDEO_NOT_FOUND = 1200
    DATABASE_ERROR = 1201
    DATABASE_CONNECTION_ERROR = 1202
    DATABASE_TIMEOUT = 1203
    CONSTRAINT_VIOLATION = 1204

    # Storage errors (1300-1399)
    STORAGE_ERROR = 1300
    UPLOAD_FAILED = 1301
    DOWNLOAD_FAILED = 1302
    STORAGE_QUOTA_EXCEEDED = 1303
    STORAGE_PERMISSION_ERROR = 1304

    # External service errors (1400-1499)
    SERVER_ERROR = 1400
    EXTERNAL_SERVICE_ERROR = 1401
    RATE_LIMIT_EXCEEDED = 1402
    SERVICE_UNAVAILABLE = 1403
    AUTHENTICATION_ERROR = 1404
    AUTHORIZATION_ERROR = 1405

    # Network errors (1500-1599)
    NETWORK_ERROR = 1500
    CONNECTION_TIMEOUT = 1501
    DNS_RESOLUTION_ERROR = 1502
    SSL_ERROR = 1503

    # Configuration errors (1600-1699)
    CONFIGURATION_ERROR = 1600
    MISSING_ENVIRONMENT_VARIABLE = 1601
    INVALID_CONFIGURATION = 1602

    # YouTube errors (1700-1799)
    YOUTUBE_INVALID_URL = 1700
    YOUTUBE_DOWNLOAD_FAILED = 1701
    YOUTUBE_VIDEO_UNAVAILABLE = 1702
    YOUTUBE_AGE_RESTRICTED = 1703
    YOUTUBE_PRIVATE_VIDEO = 1704
    YOUTUBE_REGION_BLOCKED = 1705
    YOUTUBE_LIVE_VIDEO = 1706


class ErrorSeverity:
    """Error severity levels for monitoring and alerting."""
    
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory:
    """Error categories for classification and handling."""
    
    USER_ERROR = "user_error"
    SYSTEM_ERROR = "system_error"
    EXTERNAL_ERROR = "external_error"
    CONFIGURATION_ERROR = "configuration_error"
    NETWORK_ERROR = "network_error"


# Error code to category and severity mapping
ERROR_METADATA = {
    # File validation errors - User errors, low to medium severity
    ErrorCodes.INVALID_FILE_FORMAT: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.FILE_SIZE_EXCEEDED: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.VIDEO_TOO_SHORT: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.VIDEO_TOO_LONG: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.INVALID_VIDEO_URL: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.INVALID_REQUEST: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.FILE_CORRUPTION: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": False},
    ErrorCodes.UNSUPPORTED_CODEC: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},

    # Processing errors - System errors, medium to high severity
    ErrorCodes.PROCESSING_FAILED: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.PROCESSING_TIMEOUT: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.AI_SERVICE_ERROR: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.TRANSCRIPTION_FAILED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.TRANSLATION_FAILED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.SEGMENTATION_FAILED: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.METADATA_EXTRACTION_FAILED: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.PROCESSING_CANCELLED: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},

    # Database errors - System errors, high to critical severity
    ErrorCodes.VIDEO_NOT_FOUND: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.DATABASE_ERROR: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": True},
    ErrorCodes.DATABASE_CONNECTION_ERROR: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": True},
    ErrorCodes.DATABASE_TIMEOUT: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.CONSTRAINT_VIOLATION: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": False},

    # Storage errors - External errors, medium to high severity
    ErrorCodes.STORAGE_ERROR: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.UPLOAD_FAILED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.DOWNLOAD_FAILED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.STORAGE_QUOTA_EXCEEDED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},
    ErrorCodes.STORAGE_PERMISSION_ERROR: {"category": ErrorCategory.CONFIGURATION_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},

    # External service errors - External errors, medium to critical severity
    ErrorCodes.SERVER_ERROR: {"category": ErrorCategory.SYSTEM_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},
    ErrorCodes.EXTERNAL_SERVICE_ERROR: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.RATE_LIMIT_EXCEEDED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.SERVICE_UNAVAILABLE: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.AUTHENTICATION_ERROR: {"category": ErrorCategory.CONFIGURATION_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},
    ErrorCodes.AUTHORIZATION_ERROR: {"category": ErrorCategory.CONFIGURATION_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},

    # Network errors - Network errors, medium to high severity
    ErrorCodes.NETWORK_ERROR: {"category": ErrorCategory.NETWORK_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.CONNECTION_TIMEOUT: {"category": ErrorCategory.NETWORK_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.DNS_RESOLUTION_ERROR: {"category": ErrorCategory.NETWORK_ERROR, "severity": ErrorSeverity.HIGH, "retryable": True},
    ErrorCodes.SSL_ERROR: {"category": ErrorCategory.NETWORK_ERROR, "severity": ErrorSeverity.HIGH, "retryable": False},

    # Configuration errors - Configuration errors, critical severity
    ErrorCodes.CONFIGURATION_ERROR: {"category": ErrorCategory.CONFIGURATION_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},
    ErrorCodes.MISSING_ENVIRONMENT_VARIABLE: {"category": ErrorCategory.CONFIGURATION_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},
    ErrorCodes.INVALID_CONFIGURATION: {"category": ErrorCategory.CONFIGURATION_ERROR, "severity": ErrorSeverity.CRITICAL, "retryable": False},

    # YouTube errors - External/User errors, low to medium severity
    ErrorCodes.YOUTUBE_INVALID_URL: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.YOUTUBE_DOWNLOAD_FAILED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.MEDIUM, "retryable": True},
    ErrorCodes.YOUTUBE_VIDEO_UNAVAILABLE: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.YOUTUBE_AGE_RESTRICTED: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.YOUTUBE_PRIVATE_VIDEO: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.YOUTUBE_REGION_BLOCKED: {"category": ErrorCategory.EXTERNAL_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
    ErrorCodes.YOUTUBE_LIVE_VIDEO: {"category": ErrorCategory.USER_ERROR, "severity": ErrorSeverity.LOW, "retryable": False},
}


class VideoProcessingException(HTTPException):
    """Custom exception for video processing errors with enhanced context and recovery information."""

    def __init__(
        self,
        error_code: int,
        detail: str,
        status_code: int = 400,
        headers: Optional[Dict[str, str]] = None,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        original_exception: Optional[Exception] = None,
        retry_after: Optional[int] = None,
    ):
        self.error_code = error_code
        self.timestamp = datetime.now(timezone.utc)
        self.video_id = str(video_id) if video_id else None
        self.step = step
        self.context = context or {}
        self.original_exception = original_exception
        self.retry_after = retry_after

        # Get error metadata
        metadata = ERROR_METADATA.get(error_code, {
            "category": ErrorCategory.SYSTEM_ERROR,
            "severity": ErrorSeverity.MEDIUM,
            "retryable": False
        })
        
        self.category = metadata["category"]
        self.severity = metadata["severity"]
        self.retryable = metadata["retryable"]

        # Build error detail
        error_detail = {
            "error_code": error_code,
            "message": detail,
            "timestamp": self.timestamp.isoformat(),
            "category": self.category,
            "severity": self.severity,
            "retryable": self.retryable,
        }

        # Add optional fields
        if self.video_id:
            error_detail["video_id"] = self.video_id
        if self.step:
            error_detail["step"] = self.step
        if self.context:
            error_detail["context"] = self.context
        if self.retry_after:
            error_detail["retry_after"] = self.retry_after
            if not headers:
                headers = {}
            headers["Retry-After"] = str(self.retry_after)

        # Initialize parent class first
        super().__init__(status_code=status_code, detail=error_detail, headers=headers)

        # Log the exception with full context
        self._log_exception()

    def _log_exception(self) -> None:
        """Log the exception with appropriate level based on severity."""
        log_data = {
            "error_code": self.error_code,
            "category": self.category,
            "severity": self.severity,
            "retryable": self.retryable,
            "video_id": self.video_id,
            "step": self.step,
            "context": self.context,
        }

        if self.severity == ErrorSeverity.CRITICAL:
            logger.critical(
                f"Critical error: {self.detail['message']}",
                extra=log_data,
                exc_info=self.original_exception,
            )
        elif self.severity == ErrorSeverity.HIGH:
            logger.error(
                f"High severity error: {self.detail['message']}",
                extra=log_data,
                exc_info=self.original_exception,
            )
        elif self.severity == ErrorSeverity.MEDIUM:
            logger.warning(
                f"Medium severity error: {self.detail['message']}",
                extra=log_data,
            )
        else:  # LOW severity
            logger.info(
                f"Low severity error: {self.detail['message']}",
                extra=log_data,
            )

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for serialization."""
        return {
            "error_code": self.error_code,
            "message": self.detail["message"],
            "timestamp": self.timestamp.isoformat(),
            "category": self.category,
            "severity": self.severity,
            "retryable": self.retryable,
            "video_id": self.video_id,
            "step": self.step,
            "context": self.context,
            "status_code": self.status_code,
        }


class ProcessingTimeoutException(VideoProcessingException):
    """Exception for processing timeout errors."""

    def __init__(
        self,
        video_id: Union[str, UUID],
        timeout_seconds: int,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            error_code=ErrorCodes.PROCESSING_TIMEOUT,
            detail=f"Video processing timed out after {timeout_seconds} seconds",
            status_code=408,
            video_id=video_id,
            step=step,
            context=context,
            retry_after=300,  # Suggest retry after 5 minutes
        )


class VideoNotFoundException(VideoProcessingException):
    """Exception for video not found errors."""

    def __init__(self, video_id: Union[str, UUID]):
        super().__init__(
            error_code=ErrorCodes.VIDEO_NOT_FOUND,
            detail=f"Video with ID {video_id} not found",
            status_code=404,
            video_id=video_id,
        )


class DatabaseException(VideoProcessingException):
    """Exception for database-related errors."""

    def __init__(
        self,
        detail: str,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        original_exception: Optional[Exception] = None,
        error_code: int = ErrorCodes.DATABASE_ERROR,
    ):
        super().__init__(
            error_code=error_code,
            detail=f"Database error: {detail}",
            status_code=500,
            video_id=video_id,
            step=step,
            original_exception=original_exception,
            retry_after=60,  # Suggest retry after 1 minute for database issues
        )


class StorageException(VideoProcessingException):
    """Exception for storage-related errors."""

    def __init__(
        self,
        detail: str,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        original_exception: Optional[Exception] = None,
        error_code: int = ErrorCodes.STORAGE_ERROR,
        gcs_path: Optional[str] = None,
    ):
        context = {"gcs_path": gcs_path} if gcs_path else None
        super().__init__(
            error_code=error_code,
            detail=f"Storage error: {detail}",
            status_code=500,
            video_id=video_id,
            step=step,
            context=context,
            original_exception=original_exception,
            retry_after=120,  # Suggest retry after 2 minutes for storage issues
        )


class AIServiceException(VideoProcessingException):
    """Exception for AI service errors."""

    def __init__(
        self,
        service_name: str,
        detail: str,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        original_exception: Optional[Exception] = None,
        error_code: int = ErrorCodes.AI_SERVICE_ERROR,
    ):
        context = {"service_name": service_name}
        super().__init__(
            error_code=error_code,
            detail=f"{service_name} error: {detail}",
            status_code=502,
            video_id=video_id,
            step=step,
            context=context,
            original_exception=original_exception,
            retry_after=180,  # Suggest retry after 3 minutes for AI service issues
        )


class NetworkException(VideoProcessingException):
    """Exception for network-related errors."""

    def __init__(
        self,
        detail: str,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        original_exception: Optional[Exception] = None,
        error_code: int = ErrorCodes.NETWORK_ERROR,
        url: Optional[str] = None,
    ):
        context = {"url": url} if url else None
        super().__init__(
            error_code=error_code,
            detail=f"Network error: {detail}",
            status_code=503,
            video_id=video_id,
            step=step,
            context=context,
            original_exception=original_exception,
            retry_after=60,  # Suggest retry after 1 minute for network issues
        )


class ConfigurationException(VideoProcessingException):
    """Exception for configuration-related errors."""

    def __init__(
        self,
        detail: str,
        error_code: int = ErrorCodes.CONFIGURATION_ERROR,
        config_key: Optional[str] = None,
    ):
        context = {"config_key": config_key} if config_key else None
        super().__init__(
            error_code=error_code,
            detail=f"Configuration error: {detail}",
            status_code=500,
            context=context,
        )


class RateLimitException(VideoProcessingException):
    """Exception for rate limit errors."""

    def __init__(
        self,
        service_name: str,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        retry_after: int = 300,
    ):
        context = {"service_name": service_name}
        super().__init__(
            error_code=ErrorCodes.RATE_LIMIT_EXCEEDED,
            detail=f"Rate limit exceeded for {service_name}",
            status_code=429,
            video_id=video_id,
            step=step,
            context=context,
            retry_after=retry_after,
        )


class ErrorRecoveryManager:
    """Manages error recovery strategies and retry logic."""

    def __init__(self):
        self.max_retries = 3
        self.base_delay = 1.0
        self.max_delay = 300.0
        self.backoff_factor = 2.0

    def should_retry(self, exception: Exception, attempt: int) -> bool:
        """
        Determine if an operation should be retried.

        Args:
            exception: The exception that occurred
            attempt: Current attempt number (1-based)

        Returns:
            True if the operation should be retried
        """
        if attempt >= self.max_retries:
            return False

        if isinstance(exception, VideoProcessingException):
            return exception.retryable

        # Default retry logic for common exceptions
        retryable_exceptions = (
            ConnectionError,
            TimeoutError,
            OSError,
        )

        return isinstance(exception, retryable_exceptions)

    def calculate_delay(self, attempt: int) -> float:
        """
        Calculate delay before retry using exponential backoff.

        Args:
            attempt: Current attempt number (1-based)

        Returns:
            Delay in seconds
        """
        delay = self.base_delay * (self.backoff_factor ** (attempt - 1))
        return min(delay, self.max_delay)

    def get_recovery_strategy(self, error_code: int) -> Dict[str, Any]:
        """
        Get recovery strategy for a specific error code.

        Args:
            error_code: Error code

        Returns:
            Recovery strategy configuration
        """
        strategies = {
            ErrorCodes.DATABASE_CONNECTION_ERROR: {
                "action": "reconnect_database",
                "max_retries": 5,
                "delay": 30,
            },
            ErrorCodes.STORAGE_ERROR: {
                "action": "retry_storage_operation",
                "max_retries": 3,
                "delay": 60,
            },
            ErrorCodes.AI_SERVICE_ERROR: {
                "action": "retry_ai_service",
                "max_retries": 3,
                "delay": 120,
            },
            ErrorCodes.RATE_LIMIT_EXCEEDED: {
                "action": "wait_and_retry",
                "max_retries": 5,
                "delay": 300,
            },
            ErrorCodes.NETWORK_ERROR: {
                "action": "retry_network_operation",
                "max_retries": 3,
                "delay": 30,
            },
        }

        return strategies.get(error_code, {
            "action": "default_retry",
            "max_retries": 1,
            "delay": 60,
        })


class ExceptionHandler:
    """Centralized exception handling with logging and recovery."""

    def __init__(self):
        self.recovery_manager = ErrorRecoveryManager()

    async def handle_exception(
        self,
        exception: Exception,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> VideoProcessingException:
        """
        Handle and convert exceptions to VideoProcessingException.

        Args:
            exception: Original exception
            video_id: Video ID for context
            step: Processing step for context
            context: Additional context

        Returns:
            VideoProcessingException with proper error code and context
        """
        context = context or {}

        # If already a VideoProcessingException, just log and return
        if isinstance(exception, VideoProcessingException):
            return exception

        # Map common exceptions to appropriate error codes
        if isinstance(exception, ConnectionError):
            return NetworkException(
                detail=str(exception),
                video_id=video_id,
                step=step,
                original_exception=exception,
                error_code=ErrorCodes.CONNECTION_TIMEOUT,
            )
        elif isinstance(exception, TimeoutError):
            return ProcessingTimeoutException(
                video_id=video_id or "unknown",
                timeout_seconds=context.get("timeout_seconds", 900),
                step=step,
                context=context,
            )
        elif "database" in str(exception).lower() or "sql" in str(exception).lower():
            return DatabaseException(
                detail=str(exception),
                video_id=video_id,
                step=step,
                original_exception=exception,
            )
        elif "storage" in str(exception).lower() or "gcs" in str(exception).lower():
            return StorageException(
                detail=str(exception),
                video_id=video_id,
                step=step,
                original_exception=exception,
            )
        elif "ai" in str(exception).lower() or "vertex" in str(exception).lower():
            return AIServiceException(
                service_name="AI Service",
                detail=str(exception),
                video_id=video_id,
                step=step,
                original_exception=exception,
            )
        else:
            # Generic processing error
            return VideoProcessingException(
                error_code=ErrorCodes.PROCESSING_FAILED,
                detail=str(exception),
                status_code=500,
                video_id=video_id,
                step=step,
                context=context,
                original_exception=exception,
            )

    def log_exception_with_context(
        self,
        exception: Exception,
        video_id: Optional[Union[str, UUID]] = None,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log exception with full context and stack trace.

        Args:
            exception: Exception to log
            video_id: Video ID for context
            step: Processing step for context
            context: Additional context
        """
        log_data = {
            "exception_type": type(exception).__name__,
            "exception_message": str(exception),
            "video_id": str(video_id) if video_id else None,
            "step": step,
            "context": context or {},
            "traceback": traceback.format_exc(),
        }

        logger.error(
            f"Exception occurred: {type(exception).__name__}: {str(exception)}",
            extra=log_data,
            exc_info=True,
        )


# Global instances
error_recovery_manager = ErrorRecoveryManager()
exception_handler = ExceptionHandler()
