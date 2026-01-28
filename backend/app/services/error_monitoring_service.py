"""
Error monitoring and alerting service for tracking system health and critical errors.
"""

import asyncio
import logging
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.core.exceptions import ErrorCodes, ErrorSeverity, VideoProcessingException
from app.core.logging_config import LoggerMixin

logger = logging.getLogger(__name__)


class ErrorMetrics:
    """Container for error metrics and statistics."""

    def __init__(self, window_minutes: int = 60):
        self.window_minutes = window_minutes
        self.error_counts: Dict[int, deque] = defaultdict(lambda: deque())
        self.error_rates: Dict[str, deque] = defaultdict(lambda: deque())
        self.severity_counts: Dict[str, deque] = defaultdict(lambda: deque())
        self.video_errors: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
    def add_error(
        self,
        error_code: int,
        severity: str,
        video_id: Optional[str] = None,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add an error to the metrics."""
        now = datetime.now(timezone.utc)
        
        # Add to error counts
        self.error_counts[error_code].append(now)
        
        # Add to severity counts
        self.severity_counts[severity].append(now)
        
        # Add to step-specific rates if step provided
        if step:
            self.error_rates[f"step_{step}"].append(now)
        
        # Add to video-specific errors if video_id provided
        if video_id:
            self.video_errors[video_id].append({
                "timestamp": now,
                "error_code": error_code,
                "severity": severity,
                "step": step,
                "context": context or {},
            })
        
        # Clean old entries
        self._cleanup_old_entries()
    
    def _cleanup_old_entries(self) -> None:
        """Remove entries older than the window."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=self.window_minutes)
        
        # Clean error counts
        for error_code in list(self.error_counts.keys()):
            while self.error_counts[error_code] and self.error_counts[error_code][0] < cutoff:
                self.error_counts[error_code].popleft()
            if not self.error_counts[error_code]:
                del self.error_counts[error_code]
        
        # Clean severity counts
        for severity in list(self.severity_counts.keys()):
            while self.severity_counts[severity] and self.severity_counts[severity][0] < cutoff:
                self.severity_counts[severity].popleft()
            if not self.severity_counts[severity]:
                del self.severity_counts[severity]
        
        # Clean error rates
        for key in list(self.error_rates.keys()):
            while self.error_rates[key] and self.error_rates[key][0] < cutoff:
                self.error_rates[key].popleft()
            if not self.error_rates[key]:
                del self.error_rates[key]
        
        # Clean video errors
        for video_id in list(self.video_errors.keys()):
            self.video_errors[video_id] = [
                error for error in self.video_errors[video_id]
                if error["timestamp"] >= cutoff
            ]
            if not self.video_errors[video_id]:
                del self.video_errors[video_id]
    
    def get_error_rate(self, error_code: Optional[int] = None, step: Optional[str] = None) -> float:
        """Get error rate per minute."""
        if error_code:
            count = len(self.error_counts.get(error_code, []))
        elif step:
            count = len(self.error_rates.get(f"step_{step}", []))
        else:
            count = sum(len(errors) for errors in self.error_counts.values())
        
        return count / self.window_minutes
    
    def get_severity_distribution(self) -> Dict[str, int]:
        """Get distribution of errors by severity."""
        return {
            severity: len(timestamps)
            for severity, timestamps in self.severity_counts.items()
        }
    
    def get_top_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top error codes by frequency."""
        error_list = [
            {"error_code": code, "count": len(timestamps)}
            for code, timestamps in self.error_counts.items()
        ]
        return sorted(error_list, key=lambda x: x["count"], reverse=True)[:limit]


class AlertRule:
    """Defines an alerting rule for error monitoring."""

    def __init__(
        self,
        name: str,
        condition_func: callable,
        severity: str = ErrorSeverity.MEDIUM,
        cooldown_minutes: int = 15,
        description: str = "",
    ):
        self.name = name
        self.condition_func = condition_func
        self.severity = severity
        self.cooldown_minutes = cooldown_minutes
        self.description = description
        self.last_triggered: Optional[datetime] = None
    
    def should_trigger(self, metrics: ErrorMetrics) -> bool:
        """Check if the alert should trigger."""
        # Check cooldown
        if self.last_triggered:
            cooldown_end = self.last_triggered + timedelta(minutes=self.cooldown_minutes)
            if datetime.now(timezone.utc) < cooldown_end:
                return False
        
        # Check condition
        return self.condition_func(metrics)
    
    def trigger(self) -> None:
        """Mark the alert as triggered."""
        self.last_triggered = datetime.now(timezone.utc)


class ErrorMonitoringService(LoggerMixin):
    """
    Service for monitoring errors, tracking metrics, and generating alerts.
    """

    def __init__(self, metrics_window_minutes: int = 60):
        self.metrics = ErrorMetrics(metrics_window_minutes)
        self.alert_rules: List[AlertRule] = []
        self.active_alerts: List[Dict[str, Any]] = []
        self.monitoring_task: Optional[asyncio.Task] = None
        
        # Initialize default alert rules
        self._setup_default_alert_rules()
    
    def _setup_default_alert_rules(self) -> None:
        """Set up default alerting rules."""
        
        # High error rate alert
        self.alert_rules.append(AlertRule(
            name="high_error_rate",
            condition_func=lambda m: m.get_error_rate() > 10,  # More than 10 errors per minute
            severity=ErrorSeverity.HIGH,
            cooldown_minutes=10,
            description="Overall error rate is too high",
        ))
        
        # Critical error alert
        self.alert_rules.append(AlertRule(
            name="critical_errors",
            condition_func=lambda m: len(m.severity_counts.get(ErrorSeverity.CRITICAL, [])) > 0,
            severity=ErrorSeverity.CRITICAL,
            cooldown_minutes=5,
            description="Critical errors detected",
        ))
        
        # Database error spike
        self.alert_rules.append(AlertRule(
            name="database_error_spike",
            condition_func=lambda m: (
                m.get_error_rate(ErrorCodes.DATABASE_ERROR) > 2 or
                m.get_error_rate(ErrorCodes.DATABASE_CONNECTION_ERROR) > 1
            ),
            severity=ErrorSeverity.HIGH,
            cooldown_minutes=15,
            description="Database errors are spiking",
        ))
        
        # Storage error spike
        self.alert_rules.append(AlertRule(
            name="storage_error_spike",
            condition_func=lambda m: (
                m.get_error_rate(ErrorCodes.STORAGE_ERROR) > 3 or
                m.get_error_rate(ErrorCodes.UPLOAD_FAILED) > 2
            ),
            severity=ErrorSeverity.HIGH,
            cooldown_minutes=15,
            description="Storage errors are spiking",
        ))
        
        # AI service error spike
        self.alert_rules.append(AlertRule(
            name="ai_service_error_spike",
            condition_func=lambda m: m.get_error_rate(ErrorCodes.AI_SERVICE_ERROR) > 5,
            severity=ErrorSeverity.MEDIUM,
            cooldown_minutes=20,
            description="AI service errors are increasing",
        ))
        
        # Processing timeout spike
        self.alert_rules.append(AlertRule(
            name="processing_timeout_spike",
            condition_func=lambda m: m.get_error_rate(ErrorCodes.PROCESSING_TIMEOUT) > 3,
            severity=ErrorSeverity.MEDIUM,
            cooldown_minutes=30,
            description="Processing timeouts are increasing",
        ))
    
    async def start_monitoring(self, check_interval_seconds: int = 60) -> None:
        """Start the error monitoring background task."""
        if self.monitoring_task and not self.monitoring_task.done():
            return
        
        self.monitoring_task = asyncio.create_task(
            self._monitoring_loop(check_interval_seconds),
            name="error_monitoring",
        )
        
        self.log_with_context("info", "Error monitoring started")
    
    async def stop_monitoring(self) -> None:
        """Stop the error monitoring background task."""
        if self.monitoring_task and not self.monitoring_task.done():
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        self.log_with_context("info", "Error monitoring stopped")
    
    async def _monitoring_loop(self, check_interval_seconds: int) -> None:
        """Main monitoring loop."""
        while True:
            try:
                await asyncio.sleep(check_interval_seconds)
                await self._check_alerts()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                self.log_with_context(
                    "error",
                    f"Error in monitoring loop: {str(exc)}",
                    exception_type=type(exc).__name__,
                )
    
    async def _check_alerts(self) -> None:
        """Check all alert rules and trigger alerts if needed."""
        for rule in self.alert_rules:
            try:
                if rule.should_trigger(self.metrics):
                    await self._trigger_alert(rule)
            except Exception as exc:
                self.log_with_context(
                    "error",
                    f"Error checking alert rule {rule.name}: {str(exc)}",
                    rule_name=rule.name,
                )
    
    async def _trigger_alert(self, rule: AlertRule) -> None:
        """Trigger an alert."""
        rule.trigger()
        
        alert = {
            "rule_name": rule.name,
            "severity": rule.severity,
            "description": rule.description,
            "triggered_at": datetime.now(timezone.utc).isoformat(),
            "metrics_snapshot": self._get_metrics_snapshot(),
        }
        
        self.active_alerts.append(alert)
        
        # Log the alert
        self.log_with_context(
            "critical" if rule.severity == ErrorSeverity.CRITICAL else "error",
            f"Alert triggered: {rule.name} - {rule.description}",
            rule_name=rule.name,
            severity=rule.severity,
            description=rule.description,
        )
        
        # Here you could integrate with external alerting systems
        # like PagerDuty, Slack, email, etc.
        await self._send_alert_notification(alert)
    
    async def _send_alert_notification(self, alert: Dict[str, Any]) -> None:
        """Send alert notification (placeholder for external integrations)."""
        # This is where you would integrate with external alerting systems
        # For now, we just log it
        self.log_with_context(
            "info",
            f"Alert notification sent for: {alert['rule_name']}",
            alert_data=alert,
        )
    
    def record_error(
        self,
        exception: VideoProcessingException,
        video_id: Optional[UUID] = None,
        step: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record an error in the monitoring system."""
        self.metrics.add_error(
            error_code=exception.error_code,
            severity=exception.severity,
            video_id=str(video_id) if video_id else exception.video_id,
            step=step or exception.step,
            context=context or exception.context,
        )
        
        # Log the error recording
        self.log_with_context(
            "debug",
            f"Error recorded: {exception.error_code} - {exception.detail['message']}",
            error_code=exception.error_code,
            severity=exception.severity,
            video_id=str(video_id) if video_id else exception.video_id,
            step=step or exception.step,
        )
    
    def _get_metrics_snapshot(self) -> Dict[str, Any]:
        """Get a snapshot of current metrics."""
        return {
            "total_errors": sum(len(errors) for errors in self.metrics.error_counts.values()),
            "error_rate_per_minute": self.metrics.get_error_rate(),
            "severity_distribution": self.metrics.get_severity_distribution(),
            "top_errors": self.metrics.get_top_errors(5),
            "window_minutes": self.metrics.window_minutes,
        }
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get overall system health status based on error metrics."""
        metrics_snapshot = self._get_metrics_snapshot()
        error_rate = metrics_snapshot["error_rate_per_minute"]
        severity_dist = metrics_snapshot["severity_distribution"]
        
        # Determine health status
        if severity_dist.get(ErrorSeverity.CRITICAL, 0) > 0:
            status = "critical"
        elif error_rate > 10 or severity_dist.get(ErrorSeverity.HIGH, 0) > 5:
            status = "degraded"
        elif error_rate > 5 or severity_dist.get(ErrorSeverity.MEDIUM, 0) > 10:
            status = "warning"
        else:
            status = "healthy"
        
        return {
            "status": status,
            "metrics": metrics_snapshot,
            "active_alerts": len(self.active_alerts),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    
    def get_video_error_history(self, video_id: UUID, limit: int = 50) -> List[Dict[str, Any]]:
        """Get error history for a specific video."""
        video_id_str = str(video_id)
        errors = self.metrics.video_errors.get(video_id_str, [])
        
        # Sort by timestamp (newest first) and limit
        sorted_errors = sorted(errors, key=lambda x: x["timestamp"], reverse=True)
        return sorted_errors[:limit]
    
    def clear_old_alerts(self, max_age_hours: int = 24) -> int:
        """Clear old alerts from the active alerts list."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        
        initial_count = len(self.active_alerts)
        self.active_alerts = [
            alert for alert in self.active_alerts
            if datetime.fromisoformat(alert["triggered_at"].replace("Z", "+00:00")) >= cutoff
        ]
        
        cleared_count = initial_count - len(self.active_alerts)
        if cleared_count > 0:
            self.log_with_context(
                "info",
                f"Cleared {cleared_count} old alerts",
                cleared_count=cleared_count,
                max_age_hours=max_age_hours,
            )
        
        return cleared_count
    
    def add_custom_alert_rule(self, rule: AlertRule) -> None:
        """Add a custom alert rule."""
        self.alert_rules.append(rule)
        self.log_with_context(
            "info",
            f"Added custom alert rule: {rule.name}",
            rule_name=rule.name,
            severity=rule.severity,
        )
    
    def get_monitoring_statistics(self) -> Dict[str, Any]:
        """Get comprehensive monitoring statistics."""
        return {
            "metrics": self._get_metrics_snapshot(),
            "alert_rules": [
                {
                    "name": rule.name,
                    "severity": rule.severity,
                    "description": rule.description,
                    "cooldown_minutes": rule.cooldown_minutes,
                    "last_triggered": rule.last_triggered.isoformat() if rule.last_triggered else None,
                }
                for rule in self.alert_rules
            ],
            "active_alerts": self.active_alerts,
            "health_status": self.get_health_status(),
        }


# Global error monitoring service instance
error_monitoring_service = ErrorMonitoringService()