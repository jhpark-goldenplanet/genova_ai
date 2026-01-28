import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as api_v1_router
from app.api.v1.health import router as health_router
from app.core.config import get_settings
from app.core.database import db_manager
from app.core.error_middleware import (
    ErrorHandlingMiddleware,
    HealthCheckMiddleware,
    RequestTimeoutMiddleware,
)
from app.core.exceptions import VideoProcessingException
from app.core.logging_config import configure_logging_from_env, get_logger
from app.core.redis import redis_manager
from app.core.security_middleware import (
    RateLimitMiddleware,
    RequestSizeMiddleware,
    SecurityMiddleware,
)

# Configure logging before any other imports
configure_logging_from_env()

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events with comprehensive error handling and logging."""
    settings = get_settings()
    
    logger.info("Starting Genova AI Backend application")
    
    try:
        # Initialize database with configuration
        logger.info("Initializing database connection")
        await db_manager.init_database(settings.database.url)
        logger.info("Database initialized successfully")

        # Initialize Redis connection with configuration
        logger.info("Initializing Redis connection")
        await redis_manager.init_redis(settings.redis.url)
        logger.info("Redis initialized successfully")

        # Initialize comprehensive error handling system
        logger.info("Initializing comprehensive error handling system")
        from app.services.error_integration_service import error_integration_service
        await error_integration_service.initialize_error_handling()
        logger.info("Error handling system initialized successfully")

        # Log successful startup with configuration details
        logger.info(
            "Application startup completed successfully",
            extra={
                "service": "genova-ai-backend",
                "version": settings.api.version,
                "environment": settings.application.environment,
                "debug": settings.application.debug,
                "database_url": settings.database.url.split("@")[-1] if "@" in settings.database.url else "configured",
                "redis_url": settings.redis.url.split("@")[-1] if "@" in settings.redis.url else "configured",
            },
        )

        yield

    except Exception as e:
        logger.critical(
            f"Failed to initialize application: {str(e)}",
            exc_info=True,
            extra={"startup_error": str(e)},
        )
        raise
    finally:
        # Cleanup resources
        logger.info("Shutting down application")
        
        try:
            await db_manager.close()
            logger.info("Database connection closed")
        except Exception as e:
            logger.error(f"Error closing database connection: {str(e)}")

        try:
            await redis_manager.close()
            logger.info("Redis connection closed")
        except Exception as e:
            logger.error(f"Error closing Redis connection: {str(e)}")

        try:
            from app.services.error_integration_service import error_integration_service
            await error_integration_service.shutdown_error_handling()
            logger.info("Error handling system shutdown completed")
        except Exception as e:
            logger.error(f"Error shutting down error handling system: {str(e)}")

        logger.info("Application shutdown completed")


# Get application settings
settings = get_settings()

# Create FastAPI application with configuration
app = FastAPI(
    title=settings.api.title,
    description=settings.api.description,
    version=settings.api.version,
    debug=settings.application.debug,
    lifespan=lifespan,
)

# Add security middleware (first in chain)
app.add_middleware(
    SecurityMiddleware,
    enable_security_headers=settings.application.environment != "development"
)

# Add request size limiting middleware
app.add_middleware(
    RequestSizeMiddleware,
    max_size_bytes=settings.application.max_file_size
)

# Add rate limiting middleware (basic implementation)
if settings.application.environment == "production":
    app.add_middleware(RateLimitMiddleware, requests_per_minute=60)

# Add comprehensive error handling middleware
app.add_middleware(
    ErrorHandlingMiddleware,
    enable_detailed_errors=settings.api.enable_detailed_errors
)

# Add health check middleware
app.add_middleware(HealthCheckMiddleware)

# Add request timeout middleware
app.add_middleware(
    RequestTimeoutMiddleware,
    timeout_seconds=settings.api.request_timeout
)

# CORS middleware configuration (last in middleware chain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(api_v1_router, prefix=settings.api.v1_prefix)
app.include_router(health_router)


# Global exception handlers (fallback for unhandled exceptions)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for Pydantic validation errors.

    This prevents FastAPI from trying to decode binary data as UTF-8
    when formatting validation error messages.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    # Safely format error messages without decoding binary data
    error_messages = []
    for error in exc.errors():
        field = ".".join(str(x) for x in error["loc"])
        msg = error["msg"]
        error_type = error["type"]

        # Handle validation errors with input context
        if "input" in error and isinstance(error["input"], bytes):
            # Don't include binary input in error message
            error_messages.append({
                "field": field,
                "message": msg,
                "type": error_type,
                "input": "[binary data]"
            })
        else:
            error_messages.append({
                "field": field,
                "message": msg,
                "type": error_type,
            })

    logger.warning(
        f"Request validation failed: {request.method} {request.url.path}",
        extra={
            "request_id": request_id,
            "errors": error_messages,
            "method": request.method,
            "path": request.url.path,
        },
    )

    return JSONResponse(
        status_code=400,
        content={
            "error_code": 1001,  # INVALID_REQUEST
            "message": "Request validation failed",
            "errors": error_messages,
            "request_id": request_id,
            "timestamp": "2024-01-01T00:00:00Z",
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(VideoProcessingException)
async def video_processing_exception_handler(request: Request, exc: VideoProcessingException):
    """Handle video processing exceptions (fallback handler)."""
    logger.warning(
        f"VideoProcessingException handled by fallback handler: {exc.detail['message']}",
        extra={
            "error_code": exc.error_code,
            "video_id": exc.video_id,
            "step": exc.step,
            "request_path": request.url.path,
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail,
        headers={"X-Request-ID": getattr(request.state, "request_id", "unknown")},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.critical(
        f"Unhandled exception in request {request_id}: {str(exc)}",
        exc_info=True,
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "exception_type": type(exc).__name__,
        },
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error_code": 1400,  # SERVER_ERROR
            "message": "Internal server error occurred",
            "request_id": request_id,
            "timestamp": "2024-01-01T00:00:00Z",  # Will be overridden by middleware
        },
        headers={"X-Request-ID": request_id},
    )


@app.get("/")
async def root():
    """Root endpoint with service information."""
    logger.info("Root endpoint accessed")
    return {
        "message": f"{settings.api.title} is running",
        "service": "genova-ai-backend",
        "version": settings.api.version,
        "environment": settings.application.environment,
        "status": "operational",
        "api_docs": "/docs",
        "health_check": "/health",
    }


# Direct execution support (for local development)
if __name__ == "__main__":
    import uvicorn

    # Read PORT environment variable (Cloud Run compatibility)
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(
        f"Starting uvicorn server on {host}:{port}",
        extra={
            "host": host,
            "port": port,
            "environment": settings.application.environment,
        },
    )

    # Run uvicorn server
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=settings.application.debug,
        log_level=settings.application.log_level.lower(),
        access_log=True,
    )
