"""
Centralized logging configuration for the Genova AI Backend.
"""

import logging
import logging.config
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import structlog
from pythonjsonlogger import jsonlogger


class StructuredFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with structured logging support."""

    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        """Add custom fields to log record."""
        super().add_fields(log_record, record, message_dict)
        
        # Add timestamp in ISO format
        log_record['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        # Add service information
        log_record['service'] = 'genova-ai-backend'
        log_record['version'] = '1.0.0'
        
        # Add level name
        log_record['level'] = record.levelname
        
        # Add logger name
        log_record['logger'] = record.name
        
        # Add process and thread info for debugging
        log_record['process_id'] = os.getpid()
        log_record['thread_id'] = record.thread
        
        # Add filename and line number for debugging
        if record.pathname:
            log_record['file'] = os.path.basename(record.pathname)
            log_record['line'] = record.lineno
        
        # Add function name if available
        if record.funcName:
            log_record['function'] = record.funcName


class VideoProcessingFilter(logging.Filter):
    """Filter to add video processing context to log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        """Add video processing context if available."""
        # Check if video_id is in the record's extra data
        if hasattr(record, 'video_id'):
            record.video_context = f"video_id={record.video_id}"
        
        # Check if processing step is available
        if hasattr(record, 'step'):
            if hasattr(record, 'video_context'):
                record.video_context += f", step={record.step}"
            else:
                record.video_context = f"step={record.step}"
        
        return True


def setup_logging(
    log_level: str = "INFO",
    log_format: str = "json",
    log_file: Optional[str] = None,
    enable_console: bool = True,
    enable_file: bool = True,
) -> None:
    """
    Set up comprehensive logging configuration.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Log format ('json' or 'text')
        log_file: Path to log file (optional)
        enable_console: Enable console logging
        enable_file: Enable file logging
    """
    # Create logs directory if it doesn't exist
    if enable_file:
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        
        if not log_file:
            log_file = log_dir / f"genova-ai-{datetime.now().strftime('%Y%m%d')}.log"

    # Configure formatters
    formatters = {
        "json": {
            "()": StructuredFormatter,
            "format": "%(timestamp)s %(level)s %(logger)s %(message)s",
        },
        "text": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s [%(filename)s:%(lineno)d]",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    }

    # Configure handlers
    handlers = {}
    
    if enable_console:
        handlers["console"] = {
            "class": "logging.StreamHandler",
            "level": log_level,
            "formatter": log_format,
            "stream": sys.stdout,
            "filters": ["video_processing"],
        }
    
    if enable_file and log_file:
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": log_level,
            "formatter": log_format,
            "filename": str(log_file),
            "maxBytes": 10 * 1024 * 1024,  # 10MB
            "backupCount": 5,
            "filters": ["video_processing"],
        }
        
        # Add error-specific file handler
        error_log_file = Path(str(log_file).replace(".log", "_errors.log"))
        handlers["error_file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "ERROR",
            "formatter": log_format,
            "filename": str(error_log_file),
            "maxBytes": 10 * 1024 * 1024,  # 10MB
            "backupCount": 10,
            "filters": ["video_processing"],
        }

    # Configure filters
    filters = {
        "video_processing": {
            "()": VideoProcessingFilter,
        }
    }

    # Configure loggers
    loggers = {
        "": {  # Root logger
            "level": log_level,
            "handlers": list(handlers.keys()),
            "propagate": False,
        },
        "app": {
            "level": log_level,
            "handlers": list(handlers.keys()),
            "propagate": False,
        },
        "uvicorn": {
            "level": "INFO",
            "handlers": list(handlers.keys()),
            "propagate": False,
        },
        "uvicorn.access": {
            "level": "INFO",
            "handlers": list(handlers.keys()),
            "propagate": False,
        },
        "sqlalchemy.engine": {
            "level": "WARNING",  # Reduce SQL query noise
            "handlers": list(handlers.keys()),
            "propagate": False,
        },
        "google.cloud": {
            "level": "WARNING",  # Reduce GCP client noise
            "handlers": list(handlers.keys()),
            "propagate": False,
        },
        "redis": {
            "level": "WARNING",  # Reduce Redis noise
            "handlers": list(handlers.keys()),
            "propagate": False,
        },
    }

    # Apply logging configuration
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": formatters,
        "filters": filters,
        "handlers": handlers,
        "loggers": loggers,
    }

    logging.config.dictConfig(logging_config)

    # Configure structlog for structured logging
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Log configuration success
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configuration initialized",
        extra={
            "log_level": log_level,
            "log_format": log_format,
            "log_file": str(log_file) if log_file else None,
            "console_enabled": enable_console,
            "file_enabled": enable_file,
        },
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger instance.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def get_structured_logger(name: str) -> structlog.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Structured logger instance
    """
    return structlog.get_logger(name)


class LoggerMixin:
    """Mixin class to add logging capabilities to any class."""

    @property
    def logger(self) -> logging.Logger:
        """Get logger for this class."""
        return get_logger(f"{self.__class__.__module__}.{self.__class__.__name__}")

    @property
    def structured_logger(self) -> structlog.BoundLogger:
        """Get structured logger for this class."""
        return get_structured_logger(f"{self.__class__.__module__}.{self.__class__.__name__}")

    def log_with_context(
        self,
        level: str,
        message: str,
        video_id: Optional[str] = None,
        step: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        """
        Log message with video processing context.

        Args:
            level: Log level (debug, info, warning, error, critical)
            message: Log message
            video_id: Video ID for context
            step: Processing step for context
            **kwargs: Additional context data
        """
        extra = kwargs.copy()
        if video_id:
            extra["video_id"] = video_id
        if step:
            extra["step"] = step

        log_method = getattr(self.logger, level.lower())
        log_method(message, extra=extra)


# Environment-based configuration
def configure_logging_from_env() -> None:
    """Configure logging based on environment variables."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "json").lower()
    log_file = os.getenv("LOG_FILE")
    enable_console = os.getenv("LOG_CONSOLE", "true").lower() == "true"

    # Determine environment - disable file logging in production/staging
    app_env = os.getenv("APP_ENV", "development").lower()
    is_production = app_env in ["production", "staging"]

    # In production/staging: disable file logging (use Cloud Logging instead)
    # In development/local: enable file logging by default
    if is_production:
        enable_file = False
    else:
        enable_file = os.getenv("LOG_FILE_ENABLED", "true").lower() == "true"

    setup_logging(
        log_level=log_level,
        log_format=log_format,
        log_file=log_file,
        enable_console=enable_console,
        enable_file=enable_file,
    )