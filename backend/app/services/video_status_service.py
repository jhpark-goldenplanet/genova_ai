"""
Video status management service using Redis for state tracking.
"""

from typing import Any, Optional
from uuid import UUID

from app.core.redis import redis_manager


class VideoStatusService:
    """Service for managing video processing status and progress tracking."""

    def __init__(self):
        self.redis = redis_manager

    async def initialize_video_processing(self, video_id: UUID) -> None:
        """
        Initialize video processing status as PENDING.

        Args:
            video_id: Unique video identifier
        """
        await self.redis.set_video_status(
            video_id=str(video_id),
            status="PENDING",
            progress=0,
        )

    async def start_processing(self, video_id: UUID) -> None:
        """
        Mark video processing as started (IN_PROGRESS).

        Args:
            video_id: Unique video identifier
        """
        await self.redis.set_video_status(
            video_id=str(video_id),
            status="IN_PROGRESS",
            progress=0,
        )

    async def update_processing_step(
        self,
        video_id: UUID,
        step: str,
        progress: int,
    ) -> None:
        """
        Update current processing step and progress.

        Args:
            video_id: Unique video identifier
            step: Current processing step (SUMMARIZATION, TRANSCRIBE)
            progress: Progress percentage (0-100)
        """
        await self.redis.update_progress(
            video_id=str(video_id),
            progress=progress,
            step=step,
        )

    async def complete_processing(self, video_id: UUID) -> None:
        """
        Mark video processing as complete.

        Args:
            video_id: Unique video identifier
        """
        await self.redis.mark_complete(str(video_id))

    async def fail_processing(
        self,
        video_id: UUID,
        error_message: str,
        progress: int = 0,
        error_code: Optional[int] = None,
        http_status: Optional[int] = None,
    ) -> None:
        """
        Mark video processing as failed with error message.

        Args:
            video_id: Unique video identifier
            error_message: Error description
            progress: Progress at time of failure
            error_code: Error code (e.g., 1008 for VIDEO_TOO_LONG)
            http_status: HTTP status code (e.g., 400 for user errors)
        """
        await self.redis.set_processing_error(
            video_id=str(video_id),
            error_message=error_message,
            progress=progress,
            error_code=error_code,
            http_status=http_status,
        )

    async def get_status(self, video_id: UUID) -> Optional[dict[str, Any]]:
        """
        Get current video processing status.

        Args:
            video_id: Unique video identifier

        Returns:
            Status dictionary with status, progress, step, etc.
        """
        return await self.redis.get_video_status(str(video_id))

    async def is_processing(self, video_id: UUID) -> bool:
        """
        Check if video is currently being processed.

        Args:
            video_id: Unique video identifier

        Returns:
            True if video is in PENDING or IN_PROGRESS state
        """
        status_data = await self.get_status(video_id)
        if not status_data:
            return False

        status = status_data.get("status")
        return status in ["PENDING", "IN_PROGRESS"]

    async def is_complete(self, video_id: UUID) -> bool:
        """
        Check if video processing is complete.

        Args:
            video_id: Unique video identifier

        Returns:
            True if video processing is complete
        """
        status_data = await self.get_status(video_id)
        if not status_data:
            return False

        return status_data.get("status") == "COMPLETE"

    async def has_failed(self, video_id: UUID) -> bool:
        """
        Check if video processing has failed.

        Args:
            video_id: Unique video identifier

        Returns:
            True if video processing has failed
        """
        status_data = await self.get_status(video_id)
        if not status_data:
            return False

        return status_data.get("status") == "FAILED"

    async def get_error_message(self, video_id: UUID) -> Optional[str]:
        """
        Get error message for failed processing.

        Args:
            video_id: Unique video identifier

        Returns:
            Error message if processing failed, None otherwise
        """
        status_data = await self.get_status(video_id)
        if not status_data:
            return None

        return status_data.get("error_message")

    async def store_processing_metadata(
        self,
        video_id: UUID,
        metadata: dict[str, Any],
    ) -> None:
        """
        Store additional processing metadata.

        Args:
            video_id: Unique video identifier
            metadata: Additional metadata to store
        """
        await self.redis.store_processing_metadata(
            video_id=str(video_id),
            metadata=metadata,
        )

    async def get_processing_metadata(self, video_id: UUID) -> Optional[dict[str, Any]]:
        """
        Get processing metadata.

        Args:
            video_id: Unique video identifier

        Returns:
            Metadata dictionary or None if not found
        """
        return await self.redis.get_processing_metadata(str(video_id))

    async def cleanup_video_status(self, video_id: UUID) -> bool:
        """
        Remove video status from Redis.

        Args:
            video_id: Unique video identifier

        Returns:
            True if status was removed, False if not found
        """
        return await self.redis.delete_video_status(str(video_id))

    async def get_all_processing_videos(self) -> list[str]:
        """
        Get list of all video IDs currently being processed.

        Returns:
            List of video IDs with IN_PROGRESS status
        """
        return await self.redis.get_all_processing_videos()

    async def track_upload_progress(
        self,
        video_id: UUID,
        bytes_uploaded: int,
        total_bytes: int,
    ) -> None:
        """
        Track file upload progress.

        Args:
            video_id: Unique video identifier
            bytes_uploaded: Number of bytes uploaded
            total_bytes: Total file size in bytes
        """
        progress = min(
            int((bytes_uploaded / total_bytes) * 20), 20
        )  # Upload is 20% of total

        await self.redis.update_progress(
            video_id=str(video_id),
            progress=progress,
            step="UPLOADING",
        )

    async def track_gcs_upload_progress(
        self,
        video_id: UUID,
        progress_percentage: int,
    ) -> None:
        """
        Track Google Cloud Storage upload progress.

        Args:
            video_id: Unique video identifier
            progress_percentage: Upload progress (0-100)
        """
        # GCS upload is 20-30% of total processing
        total_progress = 20 + int(progress_percentage * 0.1)

        await self.redis.update_progress(
            video_id=str(video_id),
            progress=total_progress,
            step="UPLOADING_TO_GCS",
        )

    async def track_ai_analysis_progress(
        self,
        video_id: UUID,
        analysis_step: str,
        step_progress: int,
    ) -> None:
        """
        Track AI analysis progress with different steps.

        Args:
            video_id: Unique video identifier
            analysis_step: Specific AI analysis step
            step_progress: Progress within the step (0-100)
        """
        # AI analysis is 30-80% of total processing
        base_progress = 30
        step_weight = 50  # 50% of total for AI analysis

        total_progress = base_progress + int((step_progress / 100) * step_weight)

        await self.redis.update_progress(
            video_id=str(video_id),
            progress=total_progress,
            step=analysis_step,
        )

    async def track_transcription_progress(
        self,
        video_id: UUID,
        transcription_progress: int,
    ) -> None:
        """
        Track speech-to-text transcription progress.

        Args:
            video_id: Unique video identifier
            transcription_progress: Transcription progress (0-100)
        """
        # Transcription is 80-95% of total processing
        base_progress = 80
        step_weight = 15  # 15% of total for transcription

        total_progress = base_progress + int(
            (transcription_progress / 100) * step_weight
        )

        await self.redis.update_progress(
            video_id=str(video_id),
            progress=total_progress,
            step="TRANSCRIBE",
        )

    async def track_finalization_progress(
        self,
        video_id: UUID,
        finalization_progress: int,
    ) -> None:
        """
        Track final processing steps (segmentation, translation, storage).

        Args:
            video_id: Unique video identifier
            finalization_progress: Finalization progress (0-100)
        """
        # Finalization is 95-100% of total processing
        base_progress = 95
        step_weight = 5  # 5% of total for finalization

        total_progress = base_progress + int(
            (finalization_progress / 100) * step_weight
        )

        await self.redis.update_progress(
            video_id=str(video_id),
            progress=min(total_progress, 99),  # Keep at 99% until truly complete
            step="FINALIZING",
        )


# Global service instance
video_status_service = VideoStatusService()
