"""
Application configuration management with environment variable support.
"""

import os
from functools import lru_cache
from typing import Any

from pydantic import BaseModel, Field, field_validator


class DatabaseSettings(BaseModel):
    """Database configuration settings."""
    
    url: str = Field(
        default="postgresql+asyncpg://genova_user:genova_password@localhost:5432/genova_ai"
    )
    echo: bool = Field(default=False)
    pool_size: int = Field(default=10)
    max_overflow: int = Field(default=20)
    
    def __init__(self, **kwargs):
        # Get values from environment variables
        data = {
            "url": os.getenv("DATABASE_URL", "postgresql+asyncpg://genova_user:genova_password@localhost:5432/genova_ai"),
            "echo": os.getenv("DATABASE_ECHO", "false").lower() == "true",
            "pool_size": int(os.getenv("DATABASE_POOL_SIZE", "10")),
            "max_overflow": int(os.getenv("DATABASE_MAX_OVERFLOW", "20")),
        }
        data.update(kwargs)
        super().__init__(**data)


class RedisSettings(BaseModel):
    """Redis configuration settings."""
    
    url: str = Field(default="redis://localhost:6379/0")
    socket_timeout: int = Field(default=5)
    socket_connect_timeout: int = Field(default=5)
    health_check_interval: int = Field(default=30)
    
    def __init__(self, **kwargs):
        # Get values from environment variables
        data = {
            "url": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            "socket_timeout": int(os.getenv("REDIS_SOCKET_TIMEOUT", "5")),
            "socket_connect_timeout": int(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "5")),
            "health_check_interval": int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30")),
        }
        data.update(kwargs)
        super().__init__(**data)


class GoogleCloudSettings(BaseModel):
    """Google Cloud configuration settings."""

    project_id: str = Field(default="")
    location: str = Field(default="asia-northeast3")
    credentials_path: str | None = Field(default=None)
    gcs_bucket_name: str = Field(default="")
    gcs_upload_timeout_sec: int = Field(default=900)
    gcs_upload_chunk_mb: int = Field(default=8)

    def __init__(self, **kwargs):
        # Get values from environment variables
        data = {
            "project_id": os.getenv("GOOGLE_CLOUD_PROJECT", ""),
            "location": os.getenv("GOOGLE_CLOUD_LOCATION", "asia-northeast3"),
            "credentials_path": os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
            "gcs_bucket_name": os.getenv("GCS_BUCKET_NAME", ""),
            "gcs_upload_timeout_sec": int(os.getenv("GCS_UPLOAD_TIMEOUT_SEC", "900")),
            "gcs_upload_chunk_mb": int(os.getenv("GCS_UPLOAD_CHUNK_MB", "8")),
        }
        data.update(kwargs)
        super().__init__(**data)


class AIServicesSettings(BaseModel):
    """AI services configuration settings."""
    
    vertex_model_name: str = Field(default="gemini-2.5-flash")
    speech_sample_rate: int = Field(default=16000)
    default_target_language: str = Field(default="en")
    
    def __init__(self, **kwargs):
        # Get values from environment variables
        data = {
            "vertex_model_name": os.getenv("VERTEX_MODEL_NAME", "gemini-2.5-flash"),
            "speech_sample_rate": int(os.getenv("SPEECH_SAMPLE_RATE", "16000")),
            "default_target_language": os.getenv("DEFAULT_TARGET_LANGUAGE", "en"),
        }
        data.update(kwargs)
        super().__init__(**data)


class ApplicationSettings(BaseModel):
    """Application configuration settings."""
    
    environment: str = Field(default="development")
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")
    max_file_size: int = Field(default=2147483648)  # 2GB
    min_video_duration: int = Field(default=60)  # 1 minute
    processing_timeout: int = Field(default=900)  # 15 minutes
    
    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()
    
    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Validate environment."""
        valid_envs = ["development", "testing", "staging", "production"]
        if v.lower() not in valid_envs:
            raise ValueError(f"Environment must be one of: {valid_envs}")
        return v.lower()
    
    def __init__(self, **kwargs):
        # Get values from environment variables
        max_file_size_str = os.getenv("MAX_FILE_SIZE", "2147483648")
        
        # Parse file size (handle MB, GB suffixes)
        max_file_size = self._parse_file_size(max_file_size_str)
        
        data = {
            "environment": os.getenv("APP_ENV", "development"),
            "debug": os.getenv("DEBUG", "false").lower() == "true",
            "log_level": os.getenv("LOG_LEVEL", "INFO"),
            "max_file_size": max_file_size,
            "min_video_duration": int(os.getenv("MIN_VIDEO_DURATION", "60")),
            "processing_timeout": int(os.getenv("PROCESSING_TIMEOUT", "900")),
        }
        data.update(kwargs)
        super().__init__(**data)
    
    def _parse_file_size(self, size_str: str) -> int:
        """Parse file size string with optional MB/GB suffix."""
        size_str = size_str.strip().upper()
        
        if size_str.endswith("GB"):
            return int(float(size_str[:-2]) * 1024 * 1024 * 1024)
        elif size_str.endswith("MB"):
            return int(float(size_str[:-2]) * 1024 * 1024)
        elif size_str.endswith("KB"):
            return int(float(size_str[:-2]) * 1024)
        else:
            # Assume bytes
            return int(size_str)


class APISettings(BaseModel):
    """API configuration settings."""
    
    title: str = Field(default="Genova AI Backend")
    description: str = Field(
        default="Video processing service with AI analysis and comprehensive error handling"
    )
    version: str = Field(default="1.0.0")
    v1_prefix: str = Field(default="/v1")
    cors_origins: list[str] = Field(default=["*"])
    request_timeout: int = Field(default=300)
    enable_detailed_errors: bool = Field(default=False)
    
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            # Handle comma-separated string
            return [origin.strip() for origin in v.split(",")]
        return v
    
    def __init__(self, **kwargs):
        # Get values from environment variables
        cors_origins_str = os.getenv("CORS_ORIGINS", "*")
        cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]
        
        data = {
            "title": os.getenv("API_TITLE", "Genova AI Backend"),
            "description": os.getenv("API_DESCRIPTION", "Video processing service with AI analysis and comprehensive error handling"),
            "version": os.getenv("API_VERSION", "1.0.0"),
            "v1_prefix": os.getenv("API_V1_PREFIX", "/v1"),
            "cors_origins": cors_origins,
            "request_timeout": int(os.getenv("REQUEST_TIMEOUT_SECONDS", "300")),
            "enable_detailed_errors": os.getenv("ENABLE_DETAILED_ERRORS", "false").lower() == "true",
        }
        data.update(kwargs)
        super().__init__(**data)


class BackgroundTaskSettings(BaseModel):
    """Background task configuration settings."""
    
    max_concurrent_tasks: int = Field(default=5)
    task_timeout: int = Field(default=900)  # 15 minutes
    cleanup_interval: int = Field(default=3600)  # 1 hour
    
    def __init__(self, **kwargs):
        # Get values from environment variables
        data = {
            "max_concurrent_tasks": int(os.getenv("MAX_CONCURRENT_TASKS", "5")),
            "task_timeout": int(os.getenv("TASK_TIMEOUT", "900")),
            "cleanup_interval": int(os.getenv("CLEANUP_INTERVAL", "3600")),
        }
        data.update(kwargs)
        super().__init__(**data)


class SecuritySettings(BaseModel):
    """Security configuration settings."""
    
    secret_key: str = Field(default="dev-secret-key-change-in-production")
    access_token_expire_minutes: int = Field(default=30)
    allowed_hosts: list[str] = Field(default=["*"])
    
    @field_validator("allowed_hosts", mode="before")
    @classmethod
    def parse_allowed_hosts(cls, v: Any) -> list[str]:
        """Parse allowed hosts from string or list."""
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v
    
    def __init__(self, **kwargs):
        # Get values from environment variables
        allowed_hosts_str = os.getenv("ALLOWED_HOSTS", "*")
        allowed_hosts = [host.strip() for host in allowed_hosts_str.split(",")]
        
        data = {
            "secret_key": os.getenv("SECRET_KEY", "dev-secret-key-change-in-production"),
            "access_token_expire_minutes": int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")),
            "allowed_hosts": allowed_hosts,
        }
        data.update(kwargs)
        super().__init__(**data)


class MonitoringSettings(BaseModel):
    """Monitoring and health check configuration settings."""

    health_check_timeout: int = Field(default=5)
    metrics_enabled: bool = Field(default=True)
    prometheus_port: int = Field(default=8001)

    def __init__(self, **kwargs):
        # Get values from environment variables
        data = {
            "health_check_timeout": int(os.getenv("HEALTH_CHECK_TIMEOUT", "5")),
            "metrics_enabled": os.getenv("METRICS_ENABLED", "true").lower() == "true",
            "prometheus_port": int(os.getenv("PROMETHEUS_PORT", "8001")),
        }
        data.update(kwargs)
        super().__init__(**data)


class VideoProcessingSettings(BaseModel):
    """Video processing configuration settings."""

    split_dir: str = Field(default="split_videos")
    subtitle_dir: str = Field(default="subtitles")
    translator_model_id: str = Field(default="general/translation-llm")
    minimum_video_duration_sec: int = Field(default=60)
    gcp_base_output_dir: str = Field(default="uploaded_tmp")
    file_save_dir: str = Field(default="/tmp")

    def __init__(self, **kwargs):
        # Get values from environment variables
        data = {
            "split_dir": os.getenv("SPLIT_DIR", "split_videos"),
            "subtitle_dir": os.getenv("SUBTITLE_DIR", "subtitles"),
            "translator_model_id": os.getenv("TRANSLATOR_MODEL_ID", "general/translation-llm"),
            "minimum_video_duration_sec": int(os.getenv("MINIMUM_VIDEO_DURATION_SEC", "60")),
            "gcp_base_output_dir": os.getenv("GCP_BASE_OUTPUT_DIR", "uploaded_tmp"),
            "file_save_dir": os.getenv("FILE_SAVE_DIR", "/tmp"),
        }
        data.update(kwargs)
        super().__init__(**data)


class Settings(BaseModel):
    """Main application settings."""

    # Sub-settings
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    google_cloud: GoogleCloudSettings = Field(default_factory=GoogleCloudSettings)
    ai_services: AIServicesSettings = Field(default_factory=AIServicesSettings)
    application: ApplicationSettings = Field(default_factory=ApplicationSettings)
    api: APISettings = Field(default_factory=APISettings)
    background_tasks: BackgroundTaskSettings = Field(default_factory=BackgroundTaskSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    monitoring: MonitoringSettings = Field(default_factory=MonitoringSettings)
    video_processing: VideoProcessingSettings = Field(default_factory=VideoProcessingSettings)


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


# Convenience function to get specific setting groups
def get_database_settings() -> DatabaseSettings:
    """Get database settings."""
    return get_settings().database


def get_redis_settings() -> RedisSettings:
    """Get Redis settings."""
    return get_settings().redis


def get_google_cloud_settings() -> GoogleCloudSettings:
    """Get Google Cloud settings."""
    return get_settings().google_cloud


def get_ai_services_settings() -> AIServicesSettings:
    """Get AI services settings."""
    return get_settings().ai_services


def get_application_settings() -> ApplicationSettings:
    """Get application settings."""
    return get_settings().application


def get_api_settings() -> APISettings:
    """Get API settings."""
    return get_settings().api


def get_background_task_settings() -> BackgroundTaskSettings:
    """Get background task settings."""
    return get_settings().background_tasks


def get_security_settings() -> SecuritySettings:
    """Get security settings."""
    return get_settings().security


def get_monitoring_settings() -> MonitoringSettings:
    """Get monitoring settings."""
    return get_settings().monitoring


def get_video_processing_settings() -> VideoProcessingSettings:
    """Get video processing settings."""
    return get_settings().video_processing