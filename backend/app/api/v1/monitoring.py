"""
API endpoints for error monitoring, recovery management, and system health.
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.exceptions import ErrorCodes, VideoProcessingException
from app.services.error_monitoring_service import error_monitoring_service
from app.services.error_recovery_service import error_recovery_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


# Response models
class HealthStatusResponse(BaseModel):
    """Health status response model."""
    status: str = Field(..., description="Overall health status")
    metrics: Dict[str, Any] = Field(..., description="Error metrics snapshot")
    active_alerts: int = Field(..., description="Number of active alerts")
    last_updated: str = Field(..., description="Last update timestamp")


class ErrorMetricsResponse(BaseModel):
    """Error metrics response model."""
    total_errors: int = Field(..., description="Total errors in window")
    error_rate_per_minute: float = Field(..., description="Error rate per minute")
    severity_distribution: Dict[str, int] = Field(..., description="Errors by severity")
    top_errors: List[Dict[str, Any]] = Field(..., description="Top error codes")
    window_minutes: int = Field(..., description="Metrics window in minutes")


class FailedOperationResponse(BaseModel):
    """Failed operation response model."""
    operation_id: str = Field(..., description="Operation identifier")
    video_id: Optional[str] = Field(None, description="Associated video ID")
    step: Optional[str] = Field(None, description="Processing step")
    attempt_count: int = Field(..., description="Number of attempts made")
    max_retries: int = Field(..., description="Maximum retry attempts")
    created_at: str = Field(..., description="Operation creation timestamp")
    last_attempt_at: Optional[str] = Field(None, description="Last attempt timestamp")
    last_exception: Optional[str] = Field(None, description="Last exception message")
    has_recovery_task: bool = Field(..., description="Whether recovery is scheduled")


class RecoveryStatisticsResponse(BaseModel):
    """Recovery statistics response model."""
    total_failed_operations: int = Field(..., description="Total failed operations")
    active_recovery_tasks: int = Field(..., description="Active recovery tasks")
    failed_by_error_code: Dict[int, int] = Field(..., description="Failures by error code")
    failed_by_step: Dict[str, int] = Field(..., description="Failures by processing step")
    timestamp: str = Field(..., description="Statistics timestamp")


class MonitoringStatisticsResponse(BaseModel):
    """Comprehensive monitoring statistics response model."""
    metrics: ErrorMetricsResponse
    alert_rules: List[Dict[str, Any]] = Field(..., description="Configured alert rules")
    active_alerts: List[Dict[str, Any]] = Field(..., description="Active alerts")
    health_status: HealthStatusResponse


# Request models
class RetryOperationRequest(BaseModel):
    """Request model for retrying failed operations."""
    operation_id: str = Field(..., description="Operation ID to retry")


class ScheduleRecoveryRequest(BaseModel):
    """Request model for scheduling recovery."""
    operation_id: str = Field(..., description="Operation ID to recover")
    delay_seconds: int = Field(300, ge=60, le=3600, description="Delay before recovery attempt")


@router.get("/health", response_model=HealthStatusResponse)
async def get_health_status():
    """
    Get overall system health status based on error metrics.
    
    Returns comprehensive health information including error rates,
    severity distribution, and active alerts.
    """
    try:
        health_status = error_monitoring_service.get_health_status()
        return HealthStatusResponse(**health_status)
    except Exception as exc:
        logger.error(f"Failed to get health status: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": "Failed to retrieve health status",
            }
        )


@router.get("/metrics", response_model=ErrorMetricsResponse)
async def get_error_metrics():
    """
    Get current error metrics and statistics.
    
    Returns error rates, severity distribution, and top error codes
    within the configured time window.
    """
    try:
        metrics_snapshot = error_monitoring_service._get_metrics_snapshot()
        return ErrorMetricsResponse(**metrics_snapshot)
    except Exception as exc:
        logger.error(f"Failed to get error metrics: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": "Failed to retrieve error metrics",
            }
        )


@router.get("/statistics", response_model=MonitoringStatisticsResponse)
async def get_monitoring_statistics():
    """
    Get comprehensive monitoring statistics.
    
    Returns detailed monitoring information including metrics,
    alert rules, active alerts, and health status.
    """
    try:
        stats = error_monitoring_service.get_monitoring_statistics()
        
        # Convert metrics to response model
        metrics_response = ErrorMetricsResponse(**stats["metrics"])
        health_response = HealthStatusResponse(**stats["health_status"])
        
        return MonitoringStatisticsResponse(
            metrics=metrics_response,
            alert_rules=stats["alert_rules"],
            active_alerts=stats["active_alerts"],
            health_status=health_response,
        )
    except Exception as exc:
        logger.error(f"Failed to get monitoring statistics: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": "Failed to retrieve monitoring statistics",
            }
        )


@router.get("/video/{video_id}/errors")
async def get_video_error_history(
    video_id: UUID,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of errors to return")
):
    """
    Get error history for a specific video.
    
    Returns chronological list of errors that occurred during
    processing of the specified video.
    """
    try:
        error_history = error_monitoring_service.get_video_error_history(video_id, limit)
        
        # Convert timestamps to ISO format strings
        formatted_history = []
        for error in error_history:
            formatted_error = error.copy()
            formatted_error["timestamp"] = error["timestamp"].isoformat()
            formatted_history.append(formatted_error)
        
        return {
            "video_id": str(video_id),
            "error_count": len(formatted_history),
            "errors": formatted_history,
        }
    except Exception as exc:
        logger.error(f"Failed to get video error history for {video_id}: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": f"Failed to retrieve error history for video {video_id}",
            }
        )


@router.get("/recovery/failed-operations", response_model=List[FailedOperationResponse])
async def get_failed_operations(
    video_id: Optional[UUID] = Query(None, description="Filter by video ID"),
    step: Optional[str] = Query(None, description="Filter by processing step")
):
    """
    Get list of failed operations with optional filtering.
    
    Returns operations that have failed and are available for retry
    or recovery, with optional filtering by video ID or processing step.
    """
    try:
        failed_ops = await error_recovery_service.get_failed_operations(
            video_id=video_id,
            step=step
        )
        
        return [FailedOperationResponse(**op) for op in failed_ops]
    except Exception as exc:
        logger.error(f"Failed to get failed operations: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": "Failed to retrieve failed operations",
            }
        )


@router.get("/recovery/statistics", response_model=RecoveryStatisticsResponse)
async def get_recovery_statistics():
    """
    Get error recovery statistics.
    
    Returns statistics about failed operations, recovery tasks,
    and failure patterns by error code and processing step.
    """
    try:
        stats = await error_recovery_service.get_recovery_statistics()
        return RecoveryStatisticsResponse(**stats)
    except Exception as exc:
        logger.error(f"Failed to get recovery statistics: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": "Failed to retrieve recovery statistics",
            }
        )


@router.post("/recovery/retry")
async def retry_failed_operation(request: RetryOperationRequest):
    """
    Manually retry a failed operation.
    
    Attempts to retry a previously failed operation by its operation ID.
    The operation will be executed with fresh retry attempts.
    """
    try:
        result = await error_recovery_service.retry_failed_operation(request.operation_id)
        
        return {
            "operation_id": request.operation_id,
            "status": "retry_initiated",
            "message": "Operation retry initiated successfully",
            "result": result if result is not None else "Operation completed",
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": ErrorCodes.VIDEO_NOT_FOUND,
                "message": str(exc),
            }
        )
    except VideoProcessingException as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail,
        )
    except Exception as exc:
        logger.error(f"Failed to retry operation {request.operation_id}: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": f"Failed to retry operation {request.operation_id}",
            }
        )


@router.post("/recovery/schedule")
async def schedule_recovery(request: ScheduleRecoveryRequest):
    """
    Schedule automatic recovery for a failed operation.
    
    Schedules a failed operation for automatic retry after the specified delay.
    The operation will be retried in the background.
    """
    try:
        success = await error_recovery_service.schedule_recovery(
            request.operation_id,
            request.delay_seconds
        )
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail={
                    "error_code": ErrorCodes.VIDEO_NOT_FOUND,
                    "message": f"Failed operation {request.operation_id} not found",
                }
            )
        
        return {
            "operation_id": request.operation_id,
            "status": "recovery_scheduled",
            "message": f"Recovery scheduled in {request.delay_seconds} seconds",
            "delay_seconds": request.delay_seconds,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to schedule recovery for {request.operation_id}: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": f"Failed to schedule recovery for operation {request.operation_id}",
            }
        )


@router.delete("/recovery/failed-operations/{operation_id}")
async def clear_failed_operation(operation_id: str):
    """
    Clear a failed operation from the recovery system.
    
    Removes a failed operation from the recovery registry, canceling
    any scheduled recovery tasks. Use this for operations that should
    not be retried.
    """
    try:
        success = await error_recovery_service.clear_failed_operation(operation_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail={
                    "error_code": ErrorCodes.VIDEO_NOT_FOUND,
                    "message": f"Failed operation {operation_id} not found",
                }
            )
        
        return {
            "operation_id": operation_id,
            "status": "cleared",
            "message": "Failed operation cleared successfully",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to clear operation {operation_id}: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": f"Failed to clear operation {operation_id}",
            }
        )


@router.post("/recovery/cleanup")
async def cleanup_old_operations(
    max_age_hours: int = Query(24, ge=1, le=168, description="Maximum age in hours")
):
    """
    Clean up old failed operations.
    
    Removes failed operations older than the specified age from the
    recovery system to prevent memory buildup.
    """
    try:
        cleaned_count = await error_recovery_service.cleanup_old_operations(max_age_hours)
        
        return {
            "status": "cleanup_completed",
            "message": f"Cleaned up {cleaned_count} old operations",
            "cleaned_count": cleaned_count,
            "max_age_hours": max_age_hours,
        }
    except Exception as exc:
        logger.error(f"Failed to cleanup old operations: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": "Failed to cleanup old operations",
            }
        )


@router.post("/alerts/clear")
async def clear_old_alerts(
    max_age_hours: int = Query(24, ge=1, le=168, description="Maximum age in hours")
):
    """
    Clear old alerts from the monitoring system.

    Removes alerts older than the specified age to keep the
    active alerts list manageable.
    """
    try:
        cleared_count = error_monitoring_service.clear_old_alerts(max_age_hours)

        return {
            "status": "alerts_cleared",
            "message": f"Cleared {cleared_count} old alerts",
            "cleared_count": cleared_count,
            "max_age_hours": max_age_hours,
        }
    except Exception as exc:
        logger.error(f"Failed to clear old alerts: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCodes.SERVER_ERROR,
                "message": "Failed to clear old alerts",
            }
        )


@router.get("/gemini-test")
async def test_gemini_connection():
    """
    Test Gemini API connection and model availability.

    Returns current model configuration and tests a simple API call.
    """
    import os
    from app.core.ai_config import ai_client_manager

    result = {
        "env_vars": {
            "GENAI_API_KEY": "SET" if os.getenv("GENAI_API_KEY") else "NOT SET",
            "VERTEX_AI_MODEL": os.getenv("VERTEX_AI_MODEL", "NOT SET"),
            "SUMMARIZATION_MODEL": os.getenv("SUMMARIZATION_MODEL", "NOT SET"),
        },
        "config": {
            "vertex_model_name": ai_client_manager.config.vertex_model_name,
            "genai_api_key": "SET" if ai_client_manager.config.genai_api_key else "NOT SET",
        },
        "api_test": None,
    }

    # Test actual API call
    try:
        client = ai_client_manager.get_genai_client()
        response = client.models.generate_content(
            model=ai_client_manager.config.vertex_model_name,
            contents=["Say 'Hello, Gemini is working!' in one line."],
        )
        result["api_test"] = {
            "status": "SUCCESS",
            "model_used": ai_client_manager.config.vertex_model_name,
            "response": response.text[:200] if response and response.text else "Empty response",
        }
    except Exception as e:
        result["api_test"] = {
            "status": "FAILED",
            "model_used": ai_client_manager.config.vertex_model_name,
            "error": str(e),
        }

    return result