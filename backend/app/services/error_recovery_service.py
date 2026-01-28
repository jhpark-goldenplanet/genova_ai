"""
Error recovery service for handling failed operations and implementing retry logic.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from uuid import UUID

from app.core.exceptions import (
    ErrorCodes,
    VideoProcessingException,
    error_recovery_manager,
    exception_handler,
)
from app.core.logging_config import LoggerMixin

logger = logging.getLogger(__name__)


class RetryableOperation:
    """Represents a retryable operation with context and recovery strategy."""

    def __init__(
        self,
        operation_id: str,
        operation_func: Callable,
        args: Tuple = (),
        kwargs: Optional[Dict[str, Any]] = None,
        video_id: Optional[UUID] = None,
        step: Optional[str] = None,
        max_retries: int = 3,
        base_delay: float = 1.0,
        backoff_factor: float = 2.0,
        max_delay: float = 300.0,
    ):
        self.operation_id = operation_id
        self.operation_func = operation_func
        self.args = args
        self.kwargs = kwargs or {}
        self.video_id = video_id
        self.step = step
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.backoff_factor = backoff_factor
        self.max_delay = max_delay
        
        self.attempt_count = 0
        self.last_exception: Optional[Exception] = None
        self.created_at = datetime.now(timezone.utc)
        self.last_attempt_at: Optional[datetime] = None


class ErrorRecoveryService(LoggerMixin):
    """
    Service for managing error recovery, retry logic, and failed operation handling.
    """

    def __init__(self):
        self.failed_operations: Dict[str, RetryableOperation] = {}
        self.recovery_tasks: Dict[str, asyncio.Task] = {}

    async def execute_with_retry(
        self,
        operation_func: Callable,
        operation_id: str,
        args: Tuple = (),
        kwargs: Optional[Dict[str, Any]] = None,
        video_id: Optional[UUID] = None,
        step: Optional[str] = None,
        max_retries: int = 3,
        base_delay: float = 1.0,
        backoff_factor: float = 2.0,
        max_delay: float = 300.0,
    ) -> Any:
        """
        Execute an operation with automatic retry logic.

        Args:
            operation_func: Function to execute
            operation_id: Unique identifier for the operation
            args: Positional arguments for the function
            kwargs: Keyword arguments for the function
            video_id: Video ID for context
            step: Processing step for context
            max_retries: Maximum number of retry attempts
            base_delay: Base delay between retries in seconds
            backoff_factor: Exponential backoff factor
            max_delay: Maximum delay between retries

        Returns:
            Result of the operation

        Raises:
            VideoProcessingException: If all retry attempts fail
        """
        kwargs = kwargs or {}
        
        operation = RetryableOperation(
            operation_id=operation_id,
            operation_func=operation_func,
            args=args,
            kwargs=kwargs,
            video_id=video_id,
            step=step,
            max_retries=max_retries,
            base_delay=base_delay,
            backoff_factor=backoff_factor,
            max_delay=max_delay,
        )

        return await self._execute_operation(operation)

    async def _execute_operation(self, operation: RetryableOperation) -> Any:
        """Execute a retryable operation with error handling."""
        while operation.attempt_count < operation.max_retries:
            operation.attempt_count += 1
            operation.last_attempt_at = datetime.now(timezone.utc)

            try:
                self.log_with_context(
                    "info",
                    f"Executing operation {operation.operation_id}, attempt {operation.attempt_count}/{operation.max_retries}",
                    video_id=str(operation.video_id) if operation.video_id else None,
                    step=operation.step,
                    operation_id=operation.operation_id,
                    attempt=operation.attempt_count,
                )

                # Execute the operation
                result = await operation.operation_func(*operation.args, **operation.kwargs)
                
                # Success - log and return result
                self.log_with_context(
                    "info",
                    f"Operation {operation.operation_id} completed successfully on attempt {operation.attempt_count}",
                    video_id=str(operation.video_id) if operation.video_id else None,
                    step=operation.step,
                    operation_id=operation.operation_id,
                    attempt=operation.attempt_count,
                )

                # Remove from failed operations if it was there
                if operation.operation_id in self.failed_operations:
                    del self.failed_operations[operation.operation_id]

                return result

            except Exception as exc:
                operation.last_exception = exc
                
                # Convert to VideoProcessingException for consistent handling
                if not isinstance(exc, VideoProcessingException):
                    exc = await exception_handler.handle_exception(
                        exc,
                        video_id=operation.video_id,
                        step=operation.step,
                        context={
                            "operation_id": operation.operation_id,
                            "attempt": operation.attempt_count,
                        },
                    )

                # Check if we should retry
                should_retry = (
                    operation.attempt_count < operation.max_retries and
                    error_recovery_manager.should_retry(exc, operation.attempt_count)
                )

                if should_retry:
                    # Calculate delay and wait
                    delay = error_recovery_manager.calculate_delay(operation.attempt_count)
                    
                    self.log_with_context(
                        "warning",
                        f"Operation {operation.operation_id} failed on attempt {operation.attempt_count}, retrying in {delay}s: {str(exc)}",
                        video_id=str(operation.video_id) if operation.video_id else None,
                        step=operation.step,
                        operation_id=operation.operation_id,
                        attempt=operation.attempt_count,
                        delay_seconds=delay,
                        error_code=getattr(exc, 'error_code', None),
                    )

                    await asyncio.sleep(delay)
                    continue
                else:
                    # No more retries or not retryable
                    self.log_with_context(
                        "error",
                        f"Operation {operation.operation_id} failed permanently after {operation.attempt_count} attempts: {str(exc)}",
                        video_id=str(operation.video_id) if operation.video_id else None,
                        step=operation.step,
                        operation_id=operation.operation_id,
                        attempt=operation.attempt_count,
                        error_code=getattr(exc, 'error_code', None),
                    )

                    # Store failed operation for potential manual recovery
                    self.failed_operations[operation.operation_id] = operation
                    
                    raise exc

        # This should not be reached, but just in case
        raise VideoProcessingException(
            error_code=ErrorCodes.PROCESSING_FAILED,
            detail=f"Operation {operation.operation_id} exceeded maximum retry attempts",
            video_id=operation.video_id,
            step=operation.step,
        )

    async def schedule_recovery(
        self,
        operation_id: str,
        delay_seconds: int = 300,
    ) -> bool:
        """
        Schedule automatic recovery for a failed operation.

        Args:
            operation_id: ID of the failed operation
            delay_seconds: Delay before attempting recovery

        Returns:
            True if recovery was scheduled, False if operation not found
        """
        if operation_id not in self.failed_operations:
            return False

        operation = self.failed_operations[operation_id]

        # Cancel existing recovery task if any
        if operation_id in self.recovery_tasks:
            self.recovery_tasks[operation_id].cancel()

        # Schedule new recovery task
        recovery_task = asyncio.create_task(
            self._recovery_task(operation, delay_seconds),
            name=f"recovery_{operation_id}",
        )
        
        self.recovery_tasks[operation_id] = recovery_task

        self.log_with_context(
            "info",
            f"Scheduled recovery for operation {operation_id} in {delay_seconds} seconds",
            video_id=str(operation.video_id) if operation.video_id else None,
            step=operation.step,
            operation_id=operation_id,
            delay_seconds=delay_seconds,
        )

        return True

    async def _recovery_task(self, operation: RetryableOperation, delay_seconds: int) -> None:
        """Background task for automatic recovery."""
        try:
            # Wait for the specified delay
            await asyncio.sleep(delay_seconds)

            self.log_with_context(
                "info",
                f"Attempting automatic recovery for operation {operation.operation_id}",
                video_id=str(operation.video_id) if operation.video_id else None,
                step=operation.step,
                operation_id=operation.operation_id,
            )

            # Reset attempt count for recovery
            operation.attempt_count = 0
            
            # Attempt recovery
            await self._execute_operation(operation)

        except asyncio.CancelledError:
            self.log_with_context(
                "info",
                f"Recovery task cancelled for operation {operation.operation_id}",
                operation_id=operation.operation_id,
            )
        except Exception as exc:
            self.log_with_context(
                "error",
                f"Automatic recovery failed for operation {operation.operation_id}: {str(exc)}",
                video_id=str(operation.video_id) if operation.video_id else None,
                step=operation.step,
                operation_id=operation.operation_id,
            )
        finally:
            # Clean up recovery task
            if operation.operation_id in self.recovery_tasks:
                del self.recovery_tasks[operation.operation_id]

    async def retry_failed_operation(self, operation_id: str) -> Any:
        """
        Manually retry a failed operation.

        Args:
            operation_id: ID of the failed operation

        Returns:
            Result of the operation

        Raises:
            ValueError: If operation not found
            VideoProcessingException: If retry fails
        """
        if operation_id not in self.failed_operations:
            raise ValueError(f"Failed operation {operation_id} not found")

        operation = self.failed_operations[operation_id]
        
        # Reset attempt count for manual retry
        operation.attempt_count = 0
        
        return await self._execute_operation(operation)

    async def get_failed_operations(
        self,
        video_id: Optional[UUID] = None,
        step: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get list of failed operations with optional filtering.

        Args:
            video_id: Filter by video ID
            step: Filter by processing step

        Returns:
            List of failed operation details
        """
        failed_ops = []
        
        for operation in self.failed_operations.values():
            # Apply filters
            if video_id and operation.video_id != video_id:
                continue
            if step and operation.step != step:
                continue

            failed_ops.append({
                "operation_id": operation.operation_id,
                "video_id": str(operation.video_id) if operation.video_id else None,
                "step": operation.step,
                "attempt_count": operation.attempt_count,
                "max_retries": operation.max_retries,
                "created_at": operation.created_at.isoformat(),
                "last_attempt_at": operation.last_attempt_at.isoformat() if operation.last_attempt_at else None,
                "last_exception": str(operation.last_exception) if operation.last_exception else None,
                "has_recovery_task": operation.operation_id in self.recovery_tasks,
            })

        return failed_ops

    async def clear_failed_operation(self, operation_id: str) -> bool:
        """
        Clear a failed operation from the registry.

        Args:
            operation_id: ID of the operation to clear

        Returns:
            True if operation was cleared, False if not found
        """
        if operation_id not in self.failed_operations:
            return False

        # Cancel recovery task if any
        if operation_id in self.recovery_tasks:
            self.recovery_tasks[operation_id].cancel()
            del self.recovery_tasks[operation_id]

        # Remove failed operation
        del self.failed_operations[operation_id]

        self.log_with_context(
            "info",
            f"Cleared failed operation {operation_id}",
            operation_id=operation_id,
        )

        return True

    async def cleanup_old_operations(self, max_age_hours: int = 24) -> int:
        """
        Clean up old failed operations.

        Args:
            max_age_hours: Maximum age of operations to keep

        Returns:
            Number of operations cleaned up
        """
        cutoff_time = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
        operations_to_remove = []

        for operation_id, operation in self.failed_operations.items():
            if operation.created_at.timestamp() < cutoff_time:
                operations_to_remove.append(operation_id)

        # Remove old operations
        for operation_id in operations_to_remove:
            await self.clear_failed_operation(operation_id)

        if operations_to_remove:
            self.log_with_context(
                "info",
                f"Cleaned up {len(operations_to_remove)} old failed operations",
                cleanup_count=len(operations_to_remove),
                max_age_hours=max_age_hours,
            )

        return len(operations_to_remove)

    async def get_recovery_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about error recovery operations.

        Returns:
            Dictionary with recovery statistics
        """
        total_failed = len(self.failed_operations)
        active_recoveries = len(self.recovery_tasks)
        
        # Group by error codes and steps
        error_codes = {}
        steps = {}
        
        for operation in self.failed_operations.values():
            if operation.last_exception and hasattr(operation.last_exception, 'error_code'):
                error_code = operation.last_exception.error_code
                error_codes[error_code] = error_codes.get(error_code, 0) + 1
            
            if operation.step:
                steps[operation.step] = steps.get(operation.step, 0) + 1

        return {
            "total_failed_operations": total_failed,
            "active_recovery_tasks": active_recoveries,
            "failed_by_error_code": error_codes,
            "failed_by_step": steps,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# Global error recovery service instance
error_recovery_service = ErrorRecoveryService()