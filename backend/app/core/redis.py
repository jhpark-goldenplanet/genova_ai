"""
Redis connection management with async support for video processing state.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import redis.asyncio as redis
from redis.asyncio import Redis


class RedisManager:
    """Manages Redis connections and video processing state."""

    def __init__(self):
        self.client: Redis | None = None
        self._initialized = False

    async def init_redis(self, redis_url: str | None = None) -> None:
        """Initialize Redis connection."""
        if self._initialized:
            return

        # Use provided URL or get from configuration
        if redis_url is None:
            try:
                from app.core.config import get_redis_settings
                redis_settings = get_redis_settings()
                redis_url = redis_settings.url
                socket_timeout = redis_settings.socket_timeout
                socket_connect_timeout = redis_settings.socket_connect_timeout
                health_check_interval = redis_settings.health_check_interval
            except Exception:
                # Fallback to environment variables
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
                socket_timeout = 5
                socket_connect_timeout = 5
                health_check_interval = 30
        else:
            # Use default values when URL is provided directly
            socket_timeout = 5
            socket_connect_timeout = 5
            health_check_interval = 30

        # Create Redis client with connection pool
        self.client = redis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=socket_connect_timeout,
            socket_timeout=socket_timeout,
            retry_on_timeout=True,
            health_check_interval=health_check_interval,
        )

        # Test connection
        await self.client.ping()

        self._initialized = True

    async def close(self) -> None:
        """Close Redis connection."""
        if self.client:
            await self.client.aclose()
            self.client = None
            self._initialized = False

    async def set_video_status(
        self,
        video_id: str,
        status: str,
        progress: int = 0,
        step: Optional[str] = None,
        error_message: Optional[str] = None,
        error_code: Optional[int] = None,
        http_status: Optional[int] = None,
        expiration_hours: int = 24,
    ) -> None:
        """
        Store video processing status in Redis.

        Args:
            video_id: Unique video identifier
            status: Processing status (PENDING, IN_PROGRESS, COMPLETE, FAILED)
            progress: Progress percentage (0-100)
            step: Current processing step (SUMMARIZATION, TRANSCRIBE)
            error_message: Error message if status is FAILED
            error_code: Error code if status is FAILED (e.g., 1008 for VIDEO_TOO_LONG)
            http_status: HTTP status code if status is FAILED (e.g., 400 for user errors)
            expiration_hours: Hours until status expires (default 24)
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        status_data = {
            "status": status,
            "progress": progress,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if step:
            status_data["step"] = step

        if error_message:
            status_data["error_message"] = error_message

        if error_code is not None:
            status_data["error_code"] = str(error_code)

        if http_status is not None:
            status_data["http_status"] = str(http_status)

        # Store status data as hash
        key = f"video:{video_id}:status"
        await self.client.hset(key, mapping=status_data)

        # Set expiration
        await self.client.expire(key, timedelta(hours=expiration_hours))

    async def get_video_status(self, video_id: str) -> Optional[dict[str, Any]]:
        """
        Retrieve video processing status from Redis.

        Args:
            video_id: Unique video identifier

        Returns:
            Dictionary with status information or None if not found
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        key = f"video:{video_id}:status"
        status_data = await self.client.hgetall(key)

        if not status_data:
            return None

        # Convert progress to integer
        if "progress" in status_data:
            status_data["progress"] = int(status_data["progress"])

        # Convert error_code to integer
        if "error_code" in status_data:
            status_data["error_code"] = int(status_data["error_code"])

        # Convert http_status to integer
        if "http_status" in status_data:
            status_data["http_status"] = int(status_data["http_status"])

        return status_data

    async def update_progress(
        self,
        video_id: str,
        progress: int,
        step: Optional[str] = None,
    ) -> None:
        """
        Update video processing progress.

        Args:
            video_id: Unique video identifier
            progress: Progress percentage (0-100)
            step: Current processing step
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        key = f"video:{video_id}:status"

        # Check if status exists
        exists = await self.client.exists(key)
        if not exists:
            # Initialize with IN_PROGRESS status if not exists
            await self.set_video_status(video_id, "IN_PROGRESS", progress, step)
            return

        # Update progress and step
        update_data = {
            "progress": progress,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if step:
            update_data["step"] = step

        await self.client.hset(key, mapping=update_data)

    async def set_processing_error(
        self,
        video_id: str,
        error_message: str,
        progress: int = 0,
        error_code: Optional[int] = None,
        http_status: Optional[int] = None,
    ) -> None:
        """
        Set video processing status to FAILED with error message.

        Args:
            video_id: Unique video identifier
            error_message: Error description
            progress: Progress at time of failure
            error_code: Error code (e.g., 1008 for VIDEO_TOO_LONG)
            http_status: HTTP status code (e.g., 400 for user errors)
        """
        await self.set_video_status(
            video_id=video_id,
            status="FAILED",
            progress=progress,
            error_message=error_message,
            error_code=error_code,
            http_status=http_status,
        )

    async def mark_complete(self, video_id: str) -> None:
        """
        Mark video processing as complete.

        Args:
            video_id: Unique video identifier
        """
        await self.set_video_status(
            video_id=video_id,
            status="COMPLETE",
            progress=100,
        )

    async def delete_video_status(self, video_id: str) -> bool:
        """
        Delete video status from Redis.

        Args:
            video_id: Unique video identifier

        Returns:
            True if status was deleted, False if not found
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        key = f"video:{video_id}:status"
        result = await self.client.delete(key)
        return result > 0

    async def get_all_processing_videos(self) -> list[str]:
        """
        Get list of all video IDs currently being processed.

        Returns:
            List of video IDs with IN_PROGRESS status
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        # Find all video status keys
        pattern = "video:*:status"
        keys = await self.client.keys(pattern)

        processing_videos = []
        for key in keys:
            status_data = await self.client.hgetall(key)
            if status_data.get("status") == "IN_PROGRESS":
                # Extract video ID from key (video:{id}:status)
                video_id = key.split(":")[1]
                processing_videos.append(video_id)

        return processing_videos

    async def cleanup_expired_statuses(self) -> int:
        """
        Clean up expired video statuses (manual cleanup).

        Returns:
            Number of statuses cleaned up
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        pattern = "video:*:status"
        keys = await self.client.keys(pattern)

        cleaned_count = 0
        for key in keys:
            ttl = await self.client.ttl(key)
            if ttl == -1:  # No expiration set
                # Set default expiration of 24 hours
                await self.client.expire(key, timedelta(hours=24))
            elif ttl == -2:  # Key doesn't exist (expired)
                cleaned_count += 1

        return cleaned_count

    async def store_processing_metadata(
        self,
        video_id: str,
        metadata: dict[str, Any],
        expiration_hours: int = 24,
    ) -> None:
        """
        Store additional processing metadata for a video.
        Merges with existing metadata instead of overwriting.

        Args:
            video_id: Unique video identifier
            metadata: Additional metadata to store (will be merged with existing)
            expiration_hours: Hours until metadata expires
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        key = f"video:{video_id}:metadata"

        # Get existing metadata and merge with new data
        existing_metadata = await self.get_processing_metadata(video_id)
        if existing_metadata:
            # Merge new metadata with existing, new values override old ones
            merged_metadata = {**existing_metadata, **metadata}
        else:
            merged_metadata = metadata

        # Store merged metadata as JSON string
        await self.client.set(
            key,
            json.dumps(merged_metadata, default=str),
            ex=timedelta(hours=expiration_hours),
        )

    async def get_processing_metadata(self, video_id: str) -> Optional[dict[str, Any]]:
        """
        Retrieve processing metadata for a video.

        Args:
            video_id: Unique video identifier

        Returns:
            Metadata dictionary or None if not found
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        key = f"video:{video_id}:metadata"
        metadata_json = await self.client.get(key)

        if not metadata_json:
            return None

        return json.loads(metadata_json)

    async def acquire_lock(
        self,
        lock_key: str,
        timeout_seconds: int = 3600,
        blocking: bool = False,
        blocking_timeout: int = 0,
    ) -> bool:
        """
        Acquire a distributed lock.

        Args:
            lock_key: Unique lock identifier
            timeout_seconds: Lock expiration time in seconds (default 1 hour)
            blocking: Whether to wait for lock if already held
            blocking_timeout: Max seconds to wait if blocking (0 = wait forever)

        Returns:
            True if lock acquired, False otherwise
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        lock_value = f"{os.getpid()}:{datetime.now(timezone.utc).isoformat()}"

        if blocking:
            # Wait for lock
            start_time = datetime.now(timezone.utc)
            while True:
                acquired = await self.client.set(
                    lock_key,
                    lock_value,
                    ex=timeout_seconds,
                    nx=True,  # Only set if doesn't exist
                )

                if acquired:
                    return True

                # Check timeout
                if blocking_timeout > 0:
                    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
                    if elapsed >= blocking_timeout:
                        return False

                # Wait a bit before retrying
                import asyncio
                await asyncio.sleep(0.1)
        else:
            # Non-blocking: return immediately
            acquired = await self.client.set(
                lock_key,
                lock_value,
                ex=timeout_seconds,
                nx=True,  # Only set if doesn't exist
            )
            return bool(acquired)

    async def release_lock(self, lock_key: str) -> bool:
        """
        Release a distributed lock.

        Args:
            lock_key: Unique lock identifier

        Returns:
            True if lock was released, False if lock didn't exist
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        result = await self.client.delete(lock_key)
        return result > 0

    async def check_lock_exists(self, lock_key: str) -> bool:
        """
        Check if a lock exists.

        Args:
            lock_key: Unique lock identifier

        Returns:
            True if lock exists, False otherwise
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        return await self.client.exists(lock_key) > 0

    async def get_lock_info(self, lock_key: str) -> Optional[dict[str, Any]]:
        """
        Get information about a lock.

        Args:
            lock_key: Unique lock identifier

        Returns:
            Dictionary with lock info or None if lock doesn't exist
        """
        if not self.client:
            raise RuntimeError("Redis client not initialized")

        lock_value = await self.client.get(lock_key)
        if not lock_value:
            return None

        ttl = await self.client.ttl(lock_key)

        # Parse lock value (format: "pid:timestamp")
        try:
            pid, timestamp = lock_value.split(":", 1)
            return {
                "lock_key": lock_key,
                "pid": pid,
                "acquired_at": timestamp,
                "ttl_seconds": ttl,
            }
        except:
            return {
                "lock_key": lock_key,
                "value": lock_value,
                "ttl_seconds": ttl,
            }

    @property
    def is_initialized(self) -> bool:
        """Check if Redis client is initialized."""
        return self._initialized


# Global Redis manager instance
redis_manager = RedisManager()


# Helper functions for common operations
async def get_redis_client() -> Redis:
    """Get Redis client instance."""
    if not redis_manager.client:
        raise RuntimeError("Redis client not initialized")
    return redis_manager.client
