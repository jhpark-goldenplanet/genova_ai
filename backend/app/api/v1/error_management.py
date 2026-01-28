"""
API endpoints for error management and monitoring.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

# from app.core.dependencies import get_current_user  # Authentication not implemented yet
from app.services.error_integration_service import error_integration_service
from app.services.error_monitoring_service import error_monitoring_service
from app.services.error_recovery_service import error_recovery_service

router = APIRouter(prefix="/error-management", tags=["error-management"])


class ErrorStatisticsResponse(BaseModel):
    """Response model for error statistics."""
    total_errors: int
    errors_by_service: Dict[str, int]
    errors_by_severity: Dict[str, int]
    recovery_attempts: int
    successful_recoveries: int
    timestamp: str


class SystemHealthResponse(BaseModel):
    """Response model for system health check."""
    overall_status: str
    timestamp: str
    services: Dict[str, Any]
    error_monitoring: Dict[str, Any]
    recovery_system: Dict[str, Any]
    statistics: Dict[str, Any]


class ErrorDashboardResponse(BaseModel):
    """Response model for error dashboard data."""
    timestamp: str
    system_health: Dict[str, Any]
    error_monitoring: Dict[str, Any]
    error_recovery: Dict[str, Any]
    integration_statistics: Dict[str, Any]


class FailedOperationResponse(BaseModel):
    """Response model for failed operations."""
    operation_id: str
    video_id: Optional[str]
    step: Optional[str]
    attempt_count: int
    max_retries: int
    created_at: str
    last_attempt_at: Optional[str]
    last_exception: Optional[str]
    has_recovery_task: bool


class VideoErrorHistoryResponse(BaseModel):
    """Response model for video error history."""
    video_id: str
    errors: List[Dict[str, Any]]
    total_errors: int


@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health():
    """
    Get comprehensive system health status.
    
    Returns detailed health information for all services and error handling components.
    """
    try:
        health_data = await error_integration_service.check_system_health()
        return SystemHealthResponse(**health_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve system health: {str(e)}"
        )


@router.get("/dashboard", response_model=ErrorDashboardResponse)
async def get_error_dashboard():
    """
    Get comprehensive error dashboard data for monitoring.
    
    Returns all error metrics, system status, and monitoring information.
    """
    try:
        dashboard_data = await error_integration_service.get_error_dashboard_data()
        return ErrorDashboardResponse(**dashboard_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve dashboard data: {str(e)}"
        )


@router.get("/statistics", response_model=ErrorStatisticsResponse)
async def get_error_statistics():
    """
    Get error statistics and metrics.
    
    Returns aggregated error statistics including counts by service and severity.
    """
    try:
        monitoring_stats = error_monitoring_service.get_monitoring_statistics()
        
        # Extract relevant statistics
        metrics = monitoring_stats.get("metrics", {})
        
        return ErrorStatisticsResponse(
            total_errors=metrics.get("total_errors", 0),
            errors_by_service={},  # Would need to be tracked separately
            errors_by_severity=metrics.get("severity_distribution", {}),
            recovery_attempts=0,  # Would need to be tracked
            successful_recoveries=0,  # Would need to be tracked
            timestamp=monitoring_stats.get("health_status", {}).get("last_updated", ""),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve error statistics: {str(e)}"
        )


@router.get("/failed-operations", response_model=List[FailedOperationResponse])
async def get_failed_operations(
    video_id: Optional[UUID] = Query(None, description="Filter by video ID"),
    step: Optional[str] = Query(None, description="Filter by processing step"),
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of results"),
):
    """
    Get list of failed operations with optional filtering.
    
    Returns failed operations that can be retried or investigated.
    """
    try:
        failed_ops = await error_recovery_service.get_failed_operations(
            video_id=video_id,
            step=step,
        )
        
        # Limit results
        limited_ops = failed_ops[:limit]
        
        return [FailedOperationResponse(**op) for op in limited_ops]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve failed operations: {str(e)}"
        )


@router.post("/retry-operation/{operation_id}")
async def retry_failed_operation(operation_id: str):
    """
    Manually retry a failed operation.
    
    Attempts to re-execute a failed operation that supports retry.
    """
    try:
        result = await error_recovery_service.retry_failed_operation(operation_id)
        return {
            "message": f"Operation {operation_id} retried successfully",
            "operation_id": operation_id,
            "result": "success",
        }
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retry operation: {str(e)}"
        )


@router.delete("/failed-operations/{operation_id}")
async def clear_failed_operation(operation_id: str):
    """
    Clear a failed operation from the registry.
    
    Removes a failed operation that should no longer be tracked.
    """
    try:
        success = await error_recovery_service.clear_failed_operation(operation_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Failed operation {operation_id} not found"
            )
        
        return {
            "message": f"Failed operation {operation_id} cleared successfully",
            "operation_id": operation_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear operation: {str(e)}"
        )


@router.get("/video/{video_id}/errors", response_model=VideoErrorHistoryResponse)
async def get_video_error_history(
    video_id: UUID,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of errors to return"),
):
    """
    Get error history for a specific video.
    
    Returns all errors that occurred during processing of the specified video.
    """
    try:
        errors = error_monitoring_service.get_video_error_history(video_id, limit)
        
        return VideoErrorHistoryResponse(
            video_id=str(video_id),
            errors=errors,
            total_errors=len(errors),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve video error history: {str(e)}"
        )


@router.post("/cleanup/old-operations")
async def cleanup_old_operations(
    max_age_hours: int = Query(24, ge=1, le=168, description="Maximum age in hours"),
):
    """
    Clean up old failed operations and alerts.
    
    Removes old failed operations and alerts that are no longer relevant.
    """
    try:
        # Clean up old failed operations
        operations_cleaned = await error_recovery_service.cleanup_old_operations(max_age_hours)
        
        # Clean up old alerts
        alerts_cleaned = error_monitoring_service.clear_old_alerts(max_age_hours)
        
        return {
            "message": "Cleanup completed successfully",
            "operations_cleaned": operations_cleaned,
            "alerts_cleaned": alerts_cleaned,
            "max_age_hours": max_age_hours,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to perform cleanup: {str(e)}"
        )


@router.get("/monitoring/alerts")
async def get_active_alerts():
    """
    Get currently active error alerts.
    
    Returns all active alerts that require attention.
    """
    try:
        monitoring_stats = error_monitoring_service.get_monitoring_statistics()
        active_alerts = monitoring_stats.get("active_alerts", [])
        
        return {
            "active_alerts": active_alerts,
            "alert_count": len(active_alerts),
            "timestamp": monitoring_stats.get("health_status", {}).get("last_updated"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve active alerts: {str(e)}"
        )


@router.get("/monitoring/metrics")
async def get_monitoring_metrics():
    """
    Get detailed error monitoring metrics.
    
    Returns comprehensive metrics from the error monitoring system.
    """
    try:
        return error_monitoring_service.get_monitoring_statistics()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve monitoring metrics: {str(e)}"
        )


@router.get("/recovery/statistics")
async def get_recovery_statistics():
    """
    Get error recovery system statistics.
    
    Returns statistics about error recovery attempts and success rates.
    """
    try:
        return await error_recovery_service.get_recovery_statistics()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve recovery statistics: {str(e)}"
        )


@router.post("/test/error")
async def test_error_handling(
    error_code: int = Query(1100, description="Error code to test"),
    severity: str = Query("medium", description="Error severity to test"),
    video_id: Optional[UUID] = Query(None, description="Optional video ID for context"),
):
    """
    Test error handling system with a simulated error.
    
    **WARNING: This endpoint is for testing purposes only and should be disabled in production.**
    """
    try:
        from app.core.exceptions import VideoProcessingException, ErrorSeverity
        
        # Create a test exception
        test_exception = VideoProcessingException(
            error_code=error_code,
            detail=f"Test error for error handling validation (code: {error_code})",
            video_id=video_id,
            step="TEST_ERROR_HANDLING",
            context={"test": True, "timestamp": "2024-01-01T00:00:00Z"},
        )
        
        # Process through error integration service
        processed_exception = await error_integration_service.handle_service_error(
            service_name="test_service",
            exception=test_exception,
            video_id=video_id,
            step="TEST_ERROR_HANDLING",
            context={"test": True},
            auto_recover=False,  # Don't actually attempt recovery for test
        )
        
        return {
            "message": "Test error processed successfully",
            "error_code": processed_exception.error_code,
            "severity": processed_exception.severity,
            "category": processed_exception.category,
            "retryable": processed_exception.retryable,
            "test_completed": True,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error handling test failed: {str(e)}"
        )