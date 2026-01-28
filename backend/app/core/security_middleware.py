"""
Security middleware for CORS, security headers, and request validation.
"""

import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import get_api_settings, get_security_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware for adding security headers and request validation.
    """
    
    def __init__(self, app, enable_security_headers: bool = True):
        super().__init__(app)
        self.enable_security_headers = enable_security_headers
        self.security_settings = get_security_settings()
        self.api_settings = get_api_settings()
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process request and add security headers to response."""
        
        # Generate request ID for tracing
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Log request start
        start_time = time.time()
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": self._get_client_ip(request),
                "user_agent": request.headers.get("user-agent", "unknown"),
            }
        )
        
        # Validate allowed hosts
        if not self._is_host_allowed(request):
            logger.warning(
                f"Request from disallowed host: {request.headers.get('host')}",
                extra={"request_id": request_id, "host": request.headers.get("host")}
            )
            return Response(
                content="Host not allowed",
                status_code=400,
                headers={"X-Request-ID": request_id}
            )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Add security headers
            if self.enable_security_headers:
                self._add_security_headers(response, request_id)
            
            # Log request completion
            process_time = time.time() - start_time
            logger.info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "process_time_ms": round(process_time * 1000, 2),
                }
            )
            
            return response
            
        except Exception as e:
            # Log request error
            process_time = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path} - {str(e)}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "process_time_ms": round(process_time * 1000, 2),
                    "error": str(e),
                }
            )

            # Return JSON error response with security headers
            from fastapi.responses import JSONResponse
            response = JSONResponse(
                content={
                    "error_code": 1400,
                    "message": "Internal server error",
                    "detail": str(e),
                    "request_id": request_id
                },
                status_code=500,
                headers={"X-Request-ID": request_id}
            )

            if self.enable_security_headers:
                self._add_security_headers(response, request_id)

            return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request headers."""
        # Check for forwarded headers (load balancer, proxy)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        if hasattr(request.client, "host"):
            return request.client.host
        
        return "unknown"
    
    def _is_host_allowed(self, request: Request) -> bool:
        """Check if the request host is allowed."""
        if "*" in self.security_settings.allowed_hosts:
            return True
        
        host = request.headers.get("host", "").lower()
        if not host:
            return False
        
        # Remove port from host if present
        host = host.split(":")[0]
        
        return host in [h.lower() for h in self.security_settings.allowed_hosts]
    
    def _add_security_headers(self, response: Response, request_id: str) -> None:
        """Add security headers to response."""
        
        # Request tracking
        response.headers["X-Request-ID"] = request_id
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy (basic)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        
        # HSTS (only for HTTPS)
        if hasattr(response, "url") and str(response.url).startswith("https"):
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
        
        # API-specific headers
        response.headers["X-API-Version"] = self.api_settings.version
        response.headers["X-Service"] = "genova-ai-backend"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Basic rate limiting middleware (in-memory implementation).
    
    Note: For production, use Redis-based rate limiting.
    """
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts: dict[str, list[float]] = {}
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Apply rate limiting based on client IP."""
        
        client_ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Clean old requests (older than 1 minute)
        if client_ip in self.request_counts:
            self.request_counts[client_ip] = [
                req_time for req_time in self.request_counts[client_ip]
                if current_time - req_time < 60
            ]
        else:
            self.request_counts[client_ip] = []
        
        # Check rate limit
        if len(self.request_counts[client_ip]) >= self.requests_per_minute:
            logger.warning(
                f"Rate limit exceeded for IP: {client_ip}",
                extra={
                    "client_ip": client_ip,
                    "requests_count": len(self.request_counts[client_ip]),
                    "limit": self.requests_per_minute,
                }
            )
            
            return Response(
                content="Rate limit exceeded",
                status_code=429,
                headers={
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(current_time + 60)),
                    "Retry-After": "60",
                }
            )
        
        # Add current request
        self.request_counts[client_ip].append(current_time)
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = self.requests_per_minute - len(self.request_counts[client_ip])
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(current_time + 60))
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request headers."""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        if hasattr(request.client, "host"):
            return request.client.host
        
        return "unknown"


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """
    Middleware to limit request body size.
    """
    
    def __init__(self, app, max_size_bytes: int = 2 * 1024 * 1024 * 1024):  # 2GB default
        super().__init__(app)
        self.max_size_bytes = max_size_bytes
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Check request body size before processing."""
        
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > self.max_size_bytes:
                    logger.warning(
                        f"Request body too large: {size} bytes (max: {self.max_size_bytes})",
                        extra={
                            "content_length": size,
                            "max_size": self.max_size_bytes,
                            "path": request.url.path,
                        }
                    )
                    
                    return Response(
                        content="Request body too large",
                        status_code=413,
                        headers={
                            "X-Max-Content-Length": str(self.max_size_bytes),
                        }
                    )
            except ValueError:
                # Invalid content-length header
                pass
        
        return await call_next(request)