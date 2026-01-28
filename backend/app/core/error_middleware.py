"""
Error handling middleware for comprehensive error management and logging.
"""

import asyncio
import logging
import time
import traceback
from typing import Any, Callable, Dict, Optional
from uuid import uuid4

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.exceptions import (
    ErrorCodes,
    ErrorSeverity,
    VideoProcessingException,
    exception_handler,
)

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for comprehensive error handling, logging, and monitoring.
    """

    def __init__(self, app, enable_detailed_errors: bool = False):
        super().__init__(app)
        self.enable_detailed_errors = enable_detailed_errors

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request with comprehensive error handling.

        Args:
            request: FastAPI request object
            call_next: Next middleware/handler in chain

        Returns:
            Response with proper error handling
        """
        # Generate request ID for tracing
        request_id = str(uuid4())
        start_time = time.time()

        # Add request ID to request state
        request.state.request_id = request_id

        # Log incoming request
        await self._log_request(request, request_id)

        try:
            # Process request
            response = await call_next(request)
            
            # Log successful response
            processing_time = time.time() - start_time
            await self._log_response(request, response, request_id, processing_time)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response

        except Exception as exc:
            # Handle and log exception
            processing_time = time.time() - start_time
            return await self._handle_exception(request, exc, request_id, processing_time)

    async def _log_request(self, request: Request, request_id: str) -> None:
        """Log incoming request details."""
        # Extract client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Extract video ID from path if available
        video_id = self._extract_video_id_from_path(request.url.path)

        log_data = {
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "client_ip": client_ip,
            "user_agent": user_agent,
            "content_type": request.headers.get("content-type"),
            "content_length": request.headers.get("content-length"),
        }

        if video_id:
            log_data["video_id"] = video_id

        logger.info(
            f"Incoming request: {request.method} {request.url.path}",
            extra=log_data,
        )

    async def _log_response(
        self,
        request: Request,
        response: Response,
        request_id: str,
        processing_time: float,
    ) -> None:
        """Log response details."""
        video_id = self._extract_video_id_from_path(request.url.path)

        log_data = {
            "request_id": request_id,
            "status_code": response.status_code,
            "processing_time_ms": round(processing_time * 1000, 2),
            "response_size": len(response.body) if hasattr(response, 'body') else None,
        }

        if video_id:
            log_data["video_id"] = video_id

        if response.status_code >= 400:
            logger.warning(
                f"Request completed with error: {response.status_code}",
                extra=log_data,
            )
        else:
            logger.info(
                f"Request completed successfully: {response.status_code}",
                extra=log_data,
            )

    async def _handle_exception(
        self,
        request: Request,
        exc: Exception,
        request_id: str,
        processing_time: float,
    ) -> JSONResponse:
        """Handle and format exceptions."""
        # Extract context from request
        video_id = self._extract_video_id_from_path(request.url.path)
        client_ip = self._get_client_ip(request)

        # Convert to VideoProcessingException if needed
        if not isinstance(exc, VideoProcessingException):
            exc = await exception_handler.handle_exception(
                exc,
                video_id=video_id,
                context={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "client_ip": client_ip,
                },
            )

        # Log exception with full context
        log_data = {
            "request_id": request_id,
            "video_id": video_id,
            "error_code": exc.error_code,
            "category": exc.category,
            "severity": exc.severity,
            "retryable": exc.retryable,
            "processing_time_ms": round(processing_time * 1000, 2),
            "client_ip": client_ip,
            "method": request.method,
            "path": request.url.path,
            "exception_type": type(exc.original_exception).__name__ if exc.original_exception else type(exc).__name__,
        }

        # Log with appropriate level based on severity
        if exc.severity == ErrorSeverity.CRITICAL:
            logger.critical(
                f"Critical error in request {request_id}: {exc.detail['message']}",
                extra=log_data,
                exc_info=exc.original_exception or exc,
            )
        elif exc.severity == ErrorSeverity.HIGH:
            logger.error(
                f"High severity error in request {request_id}: {exc.detail['message']}",
                extra=log_data,
                exc_info=exc.original_exception or exc,
            )
        elif exc.severity == ErrorSeverity.MEDIUM:
            logger.warning(
                f"Medium severity error in request {request_id}: {exc.detail['message']}",
                extra=log_data,
            )
        else:  # LOW severity
            logger.info(
                f"Low severity error in request {request_id}: {exc.detail['message']}",
                extra=log_data,
            )

        # Prepare response
        error_response = exc.detail.copy()
        error_response["request_id"] = request_id

        # Add detailed error information in development
        if self.enable_detailed_errors and exc.original_exception:
            error_response["debug_info"] = {
                "exception_type": type(exc.original_exception).__name__,
                "traceback": traceback.format_exception(
                    type(exc.original_exception),
                    exc.original_exception,
                    exc.original_exception.__traceback__,
                ),
            }

        # Set appropriate headers
        headers = {"X-Request-ID": request_id}
        if exc.retry_after:
            headers["Retry-After"] = str(exc.retry_after)

        return JSONResponse(
            status_code=exc.status_code,
            content=error_response,
            headers=headers,
        )

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers (load balancer/proxy)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fallback to direct client IP
        if request.client:
            return request.client.host

        return "unknown"

    def _extract_video_id_from_path(self, path: str) -> Optional[str]:
        """Extract video ID from request path if present."""
        # Pattern: /v1/video/{video_id}/...
        path_parts = path.strip("/").split("/")
        
        if len(path_parts) >= 3 and path_parts[0] == "v1" and path_parts[1] == "video":
            video_id = path_parts[2]
            # Basic UUID validation
            if len(video_id) == 36 and video_id.count("-") == 4:
                return video_id
        
        return None


class HealthCheckMiddleware(BaseHTTPMiddleware):
    """
    Middleware for health check monitoring and service status.
    """

    def __init__(self, app):
        super().__init__(app)
        self.start_time = time.time()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process health check requests."""
        # Handle health check endpoints
        if request.url.path in ["/health", "/healthz", "/ready"]:
            return await self._handle_health_check(request)

        # Continue with normal processing
        return await call_next(request)

    async def _handle_health_check(self, request: Request) -> JSONResponse:
        """Handle health check requests with service status."""
        try:
            # Basic health check
            uptime = time.time() - self.start_time
            
            health_status = {
                "status": "healthy",
                "service": "genova-ai-backend",
                "version": "1.0.0",
                "uptime_seconds": round(uptime, 2),
                "timestamp": time.time(),
            }

            # Add detailed checks for /ready endpoint
            if request.url.path == "/ready":
                health_status.update(await self._check_dependencies())

            return JSONResponse(content=health_status)

        except Exception as exc:
            logger.error(f"Health check failed: {str(exc)}", exc_info=True)
            
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "service": "genova-ai-backend",
                    "error": str(exc),
                    "timestamp": time.time(),
                },
            )

    async def _check_dependencies(self) -> Dict[str, Any]:
        """Check status of external dependencies."""
        checks = {
            "database": "unknown",
            "redis": "unknown",
            "storage": "unknown",
        }

        try:
            # Check database connection
            from app.core.database import db_manager
            if db_manager.engine:
                async with db_manager.engine.begin() as conn:
                    await conn.execute("SELECT 1")
                checks["database"] = "healthy"
            else:
                checks["database"] = "not_initialized"
        except Exception as e:
            checks["database"] = f"unhealthy: {str(e)}"

        try:
            # Check Redis connection
            from app.core.redis import redis_manager
            if redis_manager.client:
                await redis_manager.client.ping()
                checks["redis"] = "healthy"
            else:
                checks["redis"] = "not_initialized"
        except Exception as e:
            checks["redis"] = f"unhealthy: {str(e)}"

        try:
            # Check GCS connection (basic auth check)
            from app.services.gcs_service import gcs_service
            # This is a lightweight check - just verify client initialization
            if hasattr(gcs_service, 'client') and gcs_service.client:
                checks["storage"] = "healthy"
            else:
                checks["storage"] = "not_initialized"
        except Exception as e:
            checks["storage"] = f"unhealthy: {str(e)}"

        return {"dependencies": checks}


class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    """
    Middleware for request timeout handling.

    Default timeout: 600 seconds (10 minutes) for video processing operations.
    """

    def __init__(self, app, timeout_seconds: int = 600):
        super().__init__(app)
        self.timeout_seconds = timeout_seconds

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with timeout handling."""
        try:
            # Apply timeout to request processing
            response = await asyncio.wait_for(
                call_next(request),
                timeout=self.timeout_seconds,
            )
            return response

        except asyncio.TimeoutError:
            logger.warning(
                f"Request timeout after {self.timeout_seconds} seconds",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "timeout_seconds": self.timeout_seconds,
                },
            )

            return JSONResponse(
                status_code=408,
                content={
                    "error_code": ErrorCodes.PROCESSING_TIMEOUT,
                    "message": f"Request timeout after {self.timeout_seconds} seconds",
                    "timeout_seconds": self.timeout_seconds,
                    "retryable": True,
                },
            )