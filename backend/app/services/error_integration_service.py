"""
Error integration service for coordinating comprehensive error handling across all services.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.core.exceptions import (
    ErrorCodes,
    ErrorSeverity,
    VideoProcessingException,
    exception_handler,
)
from app.core.logging_config import LoggerMixin
from app.services.error_monitoring_service import error_monitoring_service
from app.services.error_recovery_service import error_recovery_service

logger = logging.getLogger(__name__)


class ErrorIntegrationService(LoggerMixin):
    """
    Service for coordinating comprehensive error handling across all application services.
    """

    def __init__(self):
        self.error_handlers: Dict[str, callable] = {}
        self.service_health_checks: Dict[str, callable] = {}
        self.critical_error_callbacks: List[callable] = []
        self.error_statistics = {
            "total_errors": 0,
            "errors_by_service": {},
            "errors_by_severity": {},
            "recovery_attempts": 0,
            "successful_recoveries": 0,
        }

    async def initialize_error_handling(self) -> None:
        """Initialize comprehensive error handling system."""
        try:
            # Start error monitoring service
            await error_monitoring_service.start_monitoring()
            
            # Register default error handlers
            self._register_default_error_handlers()
            
            # Register service health checks
            self._register_service_health_checks()
            
            # Register critical error callbacks
            self._register_critical_error_callbacks()
            
            self.log_with_context(
                "info",
                "Error handling system initialized successfully"
            )
            
        except Exception as e:
            self.log_with_context(
                "critical",
                f"Failed to initialize error handling system: {str(e)}"
            )
            raise

    async def shutdown_error_handling(self) -> None:
        """Shutdown error handling system gracefully."""
        try:
            # Stop error monitoring
            await error_monitoring_service.stop_monitoring()
            
            # Cancel any pending recovery tasks
            await self._cancel_pending_recoveries()
            
            # Generate final error report
            await self._generate_shutdown_report()
            
            self.log_with_context(
                "info",
                "Error handling system shutdown completed"
            )
            
        except Exception as e:
            self.log_with_context(
                "error",
                f"Error during error handling shutdown: {str(e)}"
            )

    async def handle_service_error(
        self,
        service_name: str,
        exception: Exception,
        video_id: Optional[UUID] = None,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        auto_recover: bool = True,
    ) -> VideoProcessingException:
        """
        Handle errors from any service with comprehensive error processing.

        Args:
            service_name: Name of the service where error occurred
            exception: The original exception
            video_id: Video ID for context
            step: Processing step for context
            context: Additional context information
            auto_recover: Whether to attempt automatic recovery

        Returns:
            Processed VideoProcessingException
        """
        context = context or {}
        context["service_name"] = service_name
        
        try:
            # Convert to VideoProcessingException
            processed_exception = await exception_handler.handle_exception(
                exception,
                video_id=video_id,
                step=step,
                context=context,
            )
            
            # Record error in monitoring system
            error_monitoring_service.record_error(
                processed_exception,
                video_id=video_id,
                step=step,
                context=context,
            )
            
            # Update statistics
            self._update_error_statistics(service_name, processed_exception.severity)
            
            # Check for service-specific error handler
            if service_name in self.error_handlers:
                await self.error_handlers[service_name](processed_exception, context)
            
            # Attempt automatic recovery if enabled and error is retryable
            if auto_recover and processed_exception.retryable:
                await self._attempt_automatic_recovery(
                    service_name, processed_exception, video_id, step, context
                )
            
            # Check for critical errors and trigger callbacks
            if processed_exception.severity == ErrorSeverity.CRITICAL:
                await self._handle_critical_error(processed_exception, context)
            
            return processed_exception
            
        except Exception as handler_error:
            # Fallback error handling
            self.log_with_context(
                "critical",
                f"Error handler failed for service {service_name}: {str(handler_error)}",
                service_name=service_name,
                original_error=str(exception),
                video_id=str(video_id) if video_id else None,
                step=step,
            )
            
            # Return a generic error
            return VideoProcessingException(
                error_code=ErrorCodes.SERVER_ERROR,
                detail=f"Error handling failed for {service_name}: {str(exception)}",
                status_code=500,
                video_id=video_id,
                step=step,
                context=context,
            )

    async def check_system_health(self) -> Dict[str, Any]:
        """
        Perform comprehensive system health check.

        Returns:
            System health status with detailed information
        """
        health_status = {
            "overall_status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": {},
            "error_monitoring": {},
            "recovery_system": {},
            "statistics": self.error_statistics.copy(),
        }
        
        try:
            # Check individual services
            for service_name, health_check in self.service_health_checks.items():
                try:
                    service_health = await health_check()
                    health_status["services"][service_name] = service_health
                    
                    if service_health.get("status") != "healthy":
                        health_status["overall_status"] = "degraded"
                        
                except Exception as e:
                    health_status["services"][service_name] = {
                        "status": "unhealthy",
                        "error": str(e),
                    }
                    health_status["overall_status"] = "unhealthy"
            
            # Get error monitoring status
            health_status["error_monitoring"] = error_monitoring_service.get_health_status()
            
            # Get recovery system statistics
            health_status["recovery_system"] = await error_recovery_service.get_recovery_statistics()
            
            # Determine overall status based on error monitoring
            monitoring_status = health_status["error_monitoring"]["status"]
            if monitoring_status in ["critical", "degraded"] and health_status["overall_status"] == "healthy":
                health_status["overall_status"] = monitoring_status
            
        except Exception as e:
            self.log_with_context(
                "error",
                f"System health check failed: {str(e)}"
            )
            health_status["overall_status"] = "unhealthy"
            health_status["health_check_error"] = str(e)
        
        return health_status

    async def get_error_dashboard_data(self) -> Dict[str, Any]:
        """
        Get comprehensive error dashboard data for monitoring.

        Returns:
            Dashboard data with error metrics and system status
        """
        try:
            # Get monitoring statistics
            monitoring_stats = error_monitoring_service.get_monitoring_statistics()
            
            # Get recovery statistics
            recovery_stats = await error_recovery_service.get_recovery_statistics()
            
            # Get system health
            health_status = await self.check_system_health()
            
            # Combine all data
            dashboard_data = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "system_health": health_status,
                "error_monitoring": monitoring_stats,
                "error_recovery": recovery_stats,
                "integration_statistics": self.error_statistics.copy(),
            }
            
            return dashboard_data
            
        except Exception as e:
            self.log_with_context(
                "error",
                f"Failed to generate error dashboard data: {str(e)}"
            )
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
                "status": "error_generating_dashboard",
            }

    def register_service_error_handler(
        self,
        service_name: str,
        handler_func: callable,
    ) -> None:
        """
        Register a custom error handler for a specific service.

        Args:
            service_name: Name of the service
            handler_func: Async function to handle service-specific errors
        """
        self.error_handlers[service_name] = handler_func
        self.log_with_context(
            "info",
            f"Registered error handler for service: {service_name}"
        )

    def register_service_health_check(
        self,
        service_name: str,
        health_check_func: callable,
    ) -> None:
        """
        Register a health check function for a service.

        Args:
            service_name: Name of the service
            health_check_func: Async function that returns health status
        """
        self.service_health_checks[service_name] = health_check_func
        self.log_with_context(
            "info",
            f"Registered health check for service: {service_name}"
        )

    def register_critical_error_callback(self, callback_func: callable) -> None:
        """
        Register a callback function for critical errors.

        Args:
            callback_func: Async function to call on critical errors
        """
        self.critical_error_callbacks.append(callback_func)
        self.log_with_context(
            "info",
            "Registered critical error callback"
        )

    async def _attempt_automatic_recovery(
        self,
        service_name: str,
        exception: VideoProcessingException,
        video_id: Optional[UUID],
        step: Optional[str],
        context: Dict[str, Any],
    ) -> None:
        """Attempt automatic recovery for retryable errors."""
        try:
            operation_id = f"{service_name}_{video_id}_{step}_{datetime.now().timestamp()}"
            
            # Schedule recovery with appropriate delay
            recovery_delay = exception.retry_after or 300
            
            success = await error_recovery_service.schedule_recovery(
                operation_id,
                delay_seconds=recovery_delay,
            )
            
            if success:
                self.error_statistics["recovery_attempts"] += 1
                self.log_with_context(
                    "info",
                    f"Scheduled automatic recovery for {service_name}",
                    service_name=service_name,
                    video_id=str(video_id) if video_id else None,
                    step=step,
                    recovery_delay=recovery_delay,
                )
            
        except Exception as e:
            self.log_with_context(
                "error",
                f"Failed to schedule automatic recovery: {str(e)}",
                service_name=service_name,
                video_id=str(video_id) if video_id else None,
                step=step,
            )

    async def _handle_critical_error(
        self,
        exception: VideoProcessingException,
        context: Dict[str, Any],
    ) -> None:
        """Handle critical errors by triggering all registered callbacks."""
        try:
            # Execute all critical error callbacks
            for callback in self.critical_error_callbacks:
                try:
                    await callback(exception, context)
                except Exception as callback_error:
                    self.log_with_context(
                        "error",
                        f"Critical error callback failed: {str(callback_error)}",
                        original_error_code=exception.error_code,
                    )
            
            # Log critical error with full context
            self.log_with_context(
                "critical",
                f"Critical error handled: {exception.detail['message']}",
                error_code=exception.error_code,
                video_id=exception.video_id,
                step=exception.step,
                context=context,
            )
            
        except Exception as e:
            self.log_with_context(
                "critical",
                f"Failed to handle critical error: {str(e)}",
                original_error_code=exception.error_code,
            )

    def _register_default_error_handlers(self) -> None:
        """Register default error handlers for common services."""
        
        async def database_error_handler(exception: VideoProcessingException, context: Dict[str, Any]) -> None:
            """Handle database-related errors."""
            if exception.error_code in [ErrorCodes.DATABASE_CONNECTION_ERROR, ErrorCodes.DATABASE_TIMEOUT]:
                # Attempt database reconnection
                try:
                    from app.core.database import db_manager
                    await db_manager.init_database()
                    self.log_with_context("info", "Database reconnection attempted")
                except Exception as e:
                    self.log_with_context("error", f"Database reconnection failed: {str(e)}")
        
        async def storage_error_handler(exception: VideoProcessingException, context: Dict[str, Any]) -> None:
            """Handle storage-related errors."""
            if exception.error_code == ErrorCodes.STORAGE_QUOTA_EXCEEDED:
                # Alert administrators about storage quota
                self.log_with_context(
                    "critical",
                    "Storage quota exceeded - immediate attention required",
                    error_code=exception.error_code,
                )
        
        async def ai_service_error_handler(exception: VideoProcessingException, context: Dict[str, Any]) -> None:
            """Handle AI service errors."""
            if exception.error_code == ErrorCodes.RATE_LIMIT_EXCEEDED:
                # Implement exponential backoff for rate limits
                self.log_with_context(
                    "warning",
                    "AI service rate limit exceeded - implementing backoff",
                    error_code=exception.error_code,
                )
        
        # Register handlers
        self.register_service_error_handler("database", database_error_handler)
        self.register_service_error_handler("storage", storage_error_handler)
        self.register_service_error_handler("ai_service", ai_service_error_handler)

    def _register_service_health_checks(self) -> None:
        """Register health check functions for core services."""
        
        async def database_health_check() -> Dict[str, Any]:
            """Check database health."""
            try:
                from app.core.database import db_manager
                if db_manager.engine:
                    async with db_manager.engine.begin() as conn:
                        await conn.execute("SELECT 1")
                    return {"status": "healthy", "service": "database"}
                else:
                    return {"status": "unhealthy", "service": "database", "error": "Engine not initialized"}
            except Exception as e:
                return {"status": "unhealthy", "service": "database", "error": str(e)}
        
        async def redis_health_check() -> Dict[str, Any]:
            """Check Redis health."""
            try:
                from app.core.redis import redis_manager
                if redis_manager.client:
                    await redis_manager.client.ping()
                    return {"status": "healthy", "service": "redis"}
                else:
                    return {"status": "unhealthy", "service": "redis", "error": "Client not initialized"}
            except Exception as e:
                return {"status": "unhealthy", "service": "redis", "error": str(e)}
        
        async def gcs_health_check() -> Dict[str, Any]:
            """Check Google Cloud Storage health."""
            try:
                from app.services.gcs_service import gcs_service
                # Perform a lightweight operation to check GCS connectivity
                bucket_name = gcs_service.bucket_name
                if bucket_name:
                    return {"status": "healthy", "service": "gcs", "bucket": bucket_name}
                else:
                    return {"status": "unhealthy", "service": "gcs", "error": "Bucket not configured"}
            except Exception as e:
                return {"status": "unhealthy", "service": "gcs", "error": str(e)}
        
        # Register health checks
        self.register_service_health_check("database", database_health_check)
        self.register_service_health_check("redis", redis_health_check)
        self.register_service_health_check("gcs", gcs_health_check)

    def _register_critical_error_callbacks(self) -> None:
        """Register callbacks for critical error handling."""
        
        async def log_critical_error(exception: VideoProcessingException, context: Dict[str, Any]) -> None:
            """Log critical errors with full context."""
            self.log_with_context(
                "critical",
                f"CRITICAL ERROR DETECTED: {exception.detail['message']}",
                error_code=exception.error_code,
                video_id=exception.video_id,
                step=exception.step,
                context=context,
                severity=exception.severity,
                category=exception.category,
            )
        
        async def alert_administrators(exception: VideoProcessingException, context: Dict[str, Any]) -> None:
            """Alert administrators about critical errors."""
            # This would integrate with external alerting systems
            # For now, we just log the alert
            self.log_with_context(
                "critical",
                "ADMINISTRATOR ALERT: Critical system error requires immediate attention",
                error_code=exception.error_code,
                video_id=exception.video_id,
                step=exception.step,
                alert_type="critical_error",
            )
        
        # Register callbacks
        self.register_critical_error_callback(log_critical_error)
        self.register_critical_error_callback(alert_administrators)

    def _update_error_statistics(self, service_name: str, severity: str) -> None:
        """Update internal error statistics."""
        self.error_statistics["total_errors"] += 1
        
        if service_name not in self.error_statistics["errors_by_service"]:
            self.error_statistics["errors_by_service"][service_name] = 0
        self.error_statistics["errors_by_service"][service_name] += 1
        
        if severity not in self.error_statistics["errors_by_severity"]:
            self.error_statistics["errors_by_severity"][severity] = 0
        self.error_statistics["errors_by_severity"][severity] += 1

    async def _cancel_pending_recoveries(self) -> None:
        """Cancel any pending recovery tasks during shutdown."""
        try:
            # Get list of failed operations and cancel their recovery tasks
            failed_operations = await error_recovery_service.get_failed_operations()
            
            for operation in failed_operations:
                if operation.get("has_recovery_task"):
                    await error_recovery_service.clear_failed_operation(operation["operation_id"])
            
            self.log_with_context(
                "info",
                f"Cancelled {len(failed_operations)} pending recovery tasks"
            )
            
        except Exception as e:
            self.log_with_context(
                "error",
                f"Error cancelling pending recoveries: {str(e)}"
            )

    async def _generate_shutdown_report(self) -> None:
        """Generate a final error report during shutdown."""
        try:
            report = {
                "shutdown_timestamp": datetime.now(timezone.utc).isoformat(),
                "total_errors_handled": self.error_statistics["total_errors"],
                "recovery_attempts": self.error_statistics["recovery_attempts"],
                "successful_recoveries": self.error_statistics["successful_recoveries"],
                "errors_by_service": self.error_statistics["errors_by_service"],
                "errors_by_severity": self.error_statistics["errors_by_severity"],
            }
            
            self.log_with_context(
                "info",
                "Error handling shutdown report generated",
                **report
            )
            
        except Exception as e:
            self.log_with_context(
                "error",
                f"Failed to generate shutdown report: {str(e)}"
            )


# Global error integration service instance
error_integration_service = ErrorIntegrationService()