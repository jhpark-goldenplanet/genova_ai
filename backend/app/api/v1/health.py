"""
Health check endpoints for monitoring and system status.
"""

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import get_monitoring_settings, get_settings
from app.core.database import db_manager
from app.core.logging_config import get_logger
from app.core.redis import redis_manager

logger = get_logger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


class HealthStatus(BaseModel):
    """Health status response model."""
    
    status: str  # "healthy", "degraded", "unhealthy"
    timestamp: str
    version: str
    environment: str
    uptime_seconds: float
    checks: dict[str, Any]


class ServiceCheck(BaseModel):
    """Individual service check result."""
    
    status: str  # "healthy", "unhealthy"
    response_time_ms: float
    message: str
    details: dict[str, Any] | None = None


# Track application start time
_start_time = time.time()


async def check_database() -> ServiceCheck:
    """Check database connectivity and health."""
    start_time = time.time()
    
    try:
        if not db_manager.is_initialized:
            return ServiceCheck(
                status="unhealthy",
                response_time_ms=0,
                message="Database not initialized"
            )
        
        # Test database connection with a simple query
        async with db_manager.get_session_context() as session:
            result = await session.execute("SELECT 1")
            result.fetchone()
        
        response_time = (time.time() - start_time) * 1000
        
        return ServiceCheck(
            status="healthy",
            response_time_ms=response_time,
            message="Database connection successful",
            details={
                "engine": str(db_manager.engine.url) if db_manager.engine else None,
                "pool_size": db_manager.engine.pool.size() if db_manager.engine else None,
            }
        )
        
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"Database health check failed: {str(e)}")
        
        return ServiceCheck(
            status="unhealthy",
            response_time_ms=response_time,
            message=f"Database connection failed: {str(e)}"
        )


async def check_redis() -> ServiceCheck:
    """Check Redis connectivity and health."""
    start_time = time.time()
    
    try:
        if not redis_manager.is_initialized:
            return ServiceCheck(
                status="unhealthy",
                response_time_ms=0,
                message="Redis not initialized"
            )
        
        # Test Redis connection with ping
        if redis_manager.client:
            await redis_manager.client.ping()
        
        response_time = (time.time() - start_time) * 1000
        
        return ServiceCheck(
            status="healthy",
            response_time_ms=response_time,
            message="Redis connection successful",
            details={
                "connection_pool": str(redis_manager.client.connection_pool) if redis_manager.client else None,
            }
        )
        
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"Redis health check failed: {str(e)}")
        
        return ServiceCheck(
            status="unhealthy",
            response_time_ms=response_time,
            message=f"Redis connection failed: {str(e)}"
        )


async def check_google_cloud_services() -> ServiceCheck:
    """Check Google Cloud services availability."""
    start_time = time.time()
    
    try:
        # Check if credentials are configured
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        
        if not project_id:
            return ServiceCheck(
                status="unhealthy",
                response_time_ms=0,
                message="Google Cloud project ID not configured"
            )
        
        # Basic check - verify credentials file exists if specified
        if credentials_path and not os.path.exists(credentials_path):
            return ServiceCheck(
                status="unhealthy",
                response_time_ms=0,
                message=f"Google Cloud credentials file not found: {credentials_path}"
            )
        
        response_time = (time.time() - start_time) * 1000
        
        return ServiceCheck(
            status="healthy",
            response_time_ms=response_time,
            message="Google Cloud services configured",
            details={
                "project_id": project_id,
                "credentials_configured": credentials_path is not None,
            }
        )
        
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"Google Cloud services health check failed: {str(e)}")
        
        return ServiceCheck(
            status="unhealthy",
            response_time_ms=response_time,
            message=f"Google Cloud services check failed: {str(e)}"
        )


async def check_disk_space() -> ServiceCheck:
    """Check available disk space."""
    start_time = time.time()
    
    try:
        import shutil
        
        # Check disk space in current directory
        total, used, free = shutil.disk_usage(".")
        
        # Convert to GB
        total_gb = total / (1024**3)
        used_gb = used / (1024**3)
        free_gb = free / (1024**3)
        usage_percent = (used / total) * 100
        
        # Consider unhealthy if less than 1GB free or more than 95% used
        is_healthy = free_gb > 1.0 and usage_percent < 95.0
        
        response_time = (time.time() - start_time) * 1000
        
        return ServiceCheck(
            status="healthy" if is_healthy else "unhealthy",
            response_time_ms=response_time,
            message=f"Disk usage: {usage_percent:.1f}% ({free_gb:.1f}GB free)",
            details={
                "total_gb": round(total_gb, 2),
                "used_gb": round(used_gb, 2),
                "free_gb": round(free_gb, 2),
                "usage_percent": round(usage_percent, 1),
            }
        )
        
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"Disk space health check failed: {str(e)}")
        
        return ServiceCheck(
            status="unhealthy",
            response_time_ms=response_time,
            message=f"Disk space check failed: {str(e)}"
        )


@router.get("/", response_model=HealthStatus)
async def health_check():
    """
    Comprehensive health check endpoint.
    
    Returns overall system health status including all dependencies.
    """
    settings = get_settings()
    monitoring_settings = get_monitoring_settings()
    
    # Run all health checks concurrently with timeout
    try:
        # Create tasks for concurrent execution
        tasks = [
            check_database(),
            check_redis(),
            check_google_cloud_services(),
            check_disk_space(),
        ]
        
        task_names = ["database", "redis", "google_cloud", "disk_space"]
        
        # Wait for all checks with timeout
        check_results = await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=monitoring_settings.health_check_timeout
        )
        
        # Process results
        checks = {}
        overall_healthy = True
        
        for i, check_name in enumerate(task_names):
            result = check_results[i]
            
            if isinstance(result, Exception):
                checks[check_name] = ServiceCheck(
                    status="unhealthy",
                    response_time_ms=0,
                    message=f"Health check failed: {str(result)}"
                ).model_dump()
                overall_healthy = False
            else:
                checks[check_name] = result.model_dump()
                if result.status != "healthy":
                    overall_healthy = False
        
        # Determine overall status
        if overall_healthy:
            overall_status = "healthy"
        else:
            # Check if any critical services are down
            critical_services = ["database", "redis"]
            critical_down = any(
                checks.get(service, {}).get("status") == "unhealthy"
                for service in critical_services
            )
            overall_status = "unhealthy" if critical_down else "degraded"
        
        uptime = time.time() - _start_time
        
        return HealthStatus(
            status=overall_status,
            timestamp=datetime.now(timezone.utc).isoformat(),
            version=settings.api.version,
            environment=settings.application.environment,
            uptime_seconds=round(uptime, 2),
            checks=checks
        )
        
    except asyncio.TimeoutError:
        logger.error("Health check timeout exceeded")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Health check timeout exceeded"
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Health check failed: {str(e)}"
        )


@router.get("/live")
async def liveness_check():
    """
    Liveness probe endpoint for Kubernetes/container orchestration.
    
    Returns 200 if the application is running (basic check).
    """
    return {
        "status": "alive",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - _start_time, 2)
    }


@router.get("/ready")
async def readiness_check():
    """
    Readiness probe endpoint for Kubernetes/container orchestration.
    
    Returns 200 if the application is ready to serve traffic.
    """
    # Check critical dependencies
    try:
        db_check = await check_database()
        redis_check = await check_redis()
        
        if db_check.status == "healthy" and redis_check.status == "healthy":
            return {
                "status": "ready",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "checks": {
                    "database": db_check.model_dump(),
                    "redis": redis_check.model_dump()
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Application not ready - critical dependencies unavailable"
            )
            
    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Application not ready: {str(e)}"
        )


@router.get("/metrics")
async def metrics_endpoint():
    """
    Basic metrics endpoint for monitoring.
    
    Returns application metrics in a simple format.
    """
    settings = get_settings()
    
    if not settings.monitoring.metrics_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Metrics endpoint disabled"
        )
    
    try:
        # Get basic system metrics
        uptime = time.time() - _start_time
        
        # Get processing video count from Redis
        processing_count = 0
        if redis_manager.is_initialized and redis_manager.client:
            try:
                processing_videos = await redis_manager.get_all_processing_videos()
                processing_count = len(processing_videos)
            except Exception:
                pass  # Ignore Redis errors for metrics
        
        return {
            "service": "genova-ai-backend",
            "version": settings.api.version,
            "environment": settings.application.environment,
            "uptime_seconds": round(uptime, 2),
            "metrics": {
                "active_video_processing_tasks": processing_count,
                "application_start_time": _start_time,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Metrics endpoint failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Metrics collection failed: {str(e)}"
        )