"""
Video processing pipeline orchestrator that coordinates all processing steps.
"""

import aiofiles
import logging
import tempfile
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.exceptions import ErrorCodes, VideoProcessingException
from app.services.background_task_service import background_task_manager
from app.services.video_service import VideoService
from app.services.video_status_service import video_status_service

logger = logging.getLogger(__name__)


class VideoProcessingPipeline:
    """
    Orchestrates the complete video processing workflow from upload to completion.
    """

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "genova_video_processing"
        self.temp_dir.mkdir(exist_ok=True)

    async def start_processing_from_file(
        self, video_id: UUID, file: UploadFile, language: Optional[str] = "ko"
    ) -> None:
        """
        Start the complete video processing pipeline from an uploaded file.

        Args:
            video_id: Unique video identifier
            file: Uploaded video file
            language: Language for analysis

        Raises:
            VideoProcessingException: If pipeline initialization fails
        """
        try:
            logger.info(f"Starting video processing pipeline for {video_id}")

            # Save file to temporary location before starting background task
            # This is necessary because the UploadFile will be closed after the request completes
            temp_file_path = self.temp_dir / f"{video_id}_{file.filename}"

            # Read and save file content
            content = await file.read()
            async with aiofiles.open(temp_file_path, 'wb') as f:
                await f.write(content)

            # Store file metadata for background task
            file_metadata = {
                'filename': file.filename,
                'content_type': file.content_type,
                'size': len(content)
            }

            # Start background processing with temp file path
            await background_task_manager.start_video_processing_from_file(
                video_id, str(temp_file_path), file_metadata, language
            )

        except Exception as e:
            logger.error(f"Failed to start processing pipeline for {video_id}: {str(e)}")
            await video_status_service.fail_processing(
                video_id, f"Failed to start processing: {str(e)}"
            )
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to start video processing: {str(e)}",
                status_code=500,
            )

    async def start_processing_from_url(self, video_id: UUID, url: str) -> None:
        """
        Start the complete video processing pipeline from a URL.

        Args:
            video_id: Unique video identifier
            url: Video URL to download and process

        Raises:
            VideoProcessingException: If pipeline initialization fails
        """
        try:
            logger.info(f"Starting video processing pipeline for {video_id} from URL")

            # Start background processing
            await background_task_manager.start_video_processing_from_url(video_id, url)

        except Exception as e:
            logger.error(f"Failed to start processing pipeline for {video_id}: {str(e)}")
            await video_status_service.fail_processing(
                video_id, f"Failed to start processing: {str(e)}"
            )
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to start video processing: {str(e)}",
                status_code=500,
            )

    async def start_processing_from_gcs(
        self, video_id: UUID, gcs_path: str, language: Optional[str] = "ko",
        split_count: Optional[int] = None, analysis_id: Optional[UUID] = None,
    ) -> None:
        """
        Start the complete video processing pipeline for a video already in GCS.

        This is used when videos are uploaded directly to GCS via signed URL,
        bypassing the Cloud Run 32MB request size limit.

        Args:
            video_id: Unique video identifier
            gcs_path: GCS path where video is stored
            language: Language for analysis

        Raises:
            VideoProcessingException: If pipeline initialization fails
        """
        try:
            logger.info(f"Starting video processing pipeline for {video_id} from GCS: {gcs_path}")

            # Start background processing
            await background_task_manager.start_video_processing_from_gcs(
                video_id, gcs_path, language,
                split_count=split_count, analysis_id=analysis_id,
            )

        except Exception as e:
            logger.error(f"Failed to start processing pipeline for {video_id}: {str(e)}")
            await video_status_service.fail_processing(
                video_id, f"Failed to start processing: {str(e)}"
            )
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to start video processing: {str(e)}",
                status_code=500,
            )

    async def start_reanalysis(
        self, video_id: UUID, segments: list[dict], language: str = "ko"
    ) -> None:
        """
        Start re-analysis pipeline with user-defined segment boundaries.

        Args:
            video_id: Video identifier
            segments: List of segment dicts with segment_no, start_time, end_time
            language: Source language for analysis
        """
        try:
            logger.info(f"Starting re-analysis pipeline for {video_id} with {len(segments)} segments")
            await background_task_manager.start_reanalysis(video_id, segments, language)
        except Exception as e:
            logger.error(f"Failed to start re-analysis for {video_id}: {str(e)}")
            await video_status_service.fail_processing(
                video_id, f"Failed to start re-analysis: {str(e)}"
            )
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to start re-analysis: {str(e)}",
                status_code=500,
            )

    async def cancel_processing(self, video_id: UUID) -> bool:
        """
        Cancel an active video processing pipeline.

        Args:
            video_id: Video identifier

        Returns:
            True if processing was cancelled, False if no active processing
        """
        try:
            logger.info(f"Cancelling video processing for {video_id}")
            return await background_task_manager.cancel_task(video_id)

        except Exception as e:
            logger.error(f"Failed to cancel processing for {video_id}: {str(e)}")
            return False

    async def get_processing_status(self, video_id: UUID) -> Optional[dict]:
        """
        Get comprehensive processing status including pipeline state.

        Args:
            video_id: Video identifier

        Returns:
            Status dictionary with processing information
        """
        try:
            # Get status from Redis
            redis_status = await video_status_service.get_status(video_id)

            # Get task status from background manager
            task_status = await background_task_manager.get_task_status(video_id)

            # Get processing metadata
            metadata = await video_status_service.get_processing_metadata(video_id)

            # Combine all status information
            status = {
                "video_id": str(video_id),
                "redis_status": redis_status,
                "task_status": task_status,
                "metadata": metadata,
                "is_active": task_status == "RUNNING" if task_status else False,
            }

            return status

        except Exception as e:
            logger.error(f"Failed to get processing status for {video_id}: {str(e)}")
            return None

    async def get_active_processing_count(self) -> int:
        """
        Get the number of currently active processing tasks.

        Returns:
            Number of active processing tasks
        """
        try:
            active_tasks = await background_task_manager.get_active_tasks()
            return len(active_tasks)

        except Exception as e:
            logger.error(f"Failed to get active processing count: {str(e)}")
            return 0

    async def get_active_processing_videos(self) -> list[str]:
        """
        Get list of video IDs currently being processed.

        Returns:
            List of video IDs with active processing
        """
        try:
            return await background_task_manager.get_active_tasks()

        except Exception as e:
            logger.error(f"Failed to get active processing videos: {str(e)}")
            return []

    async def cleanup_failed_processing(self, video_id: UUID) -> bool:
        """
        Clean up resources for failed processing tasks.

        Args:
            video_id: Video identifier

        Returns:
            True if cleanup was successful
        """
        try:
            logger.info(f"Cleaning up failed processing for {video_id}")

            # Cancel any active task
            await background_task_manager.cancel_task(video_id)

            # Clean up temporary files
            await self._cleanup_temp_files(video_id)

            # Update status to failed if not already
            status = await video_status_service.get_status(video_id)
            if status and status.get("status") not in ["FAILED", "COMPLETE"]:
                await video_status_service.fail_processing(
                    video_id, "Processing was cleaned up due to failure"
                )

            logger.info(f"Cleanup completed for {video_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to cleanup processing for {video_id}: {str(e)}")
            return False

    async def retry_failed_processing(self, video_id: UUID) -> bool:
        """
        Retry processing for a failed video.

        Args:
            video_id: Video identifier

        Returns:
            True if retry was initiated successfully
        """
        try:
            logger.info(f"Retrying processing for {video_id}")

            # Check current status
            status = await video_status_service.get_status(video_id)
            if not status or status.get("status") != "FAILED":
                logger.warning(f"Cannot retry processing for {video_id}: not in failed state")
                return False

            # Get video information from database
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                video = await video_service.get_video_by_id(video_id)

                if video.source_type == "FILE_UPLOAD":
                    # For file uploads, we need the original file (not available for retry)
                    logger.error(f"Cannot retry file upload processing for {video_id}")
                    return False
                elif video.source_type == "URL_UPLOAD" and video.source_url:
                    # For URL uploads, we can retry with the original URL
                    await self.start_processing_from_url(video_id, video.source_url)
                    return True
                else:
                    logger.error(f"Cannot determine retry method for {video_id}")
                    return False

        except Exception as e:
            logger.error(f"Failed to retry processing for {video_id}: {str(e)}")
            return False

    async def _cleanup_temp_files(self, video_id: UUID) -> None:
        """
        Clean up temporary files for a video processing task.

        Args:
            video_id: Video identifier
        """
        try:
            video_temp_dir = self.temp_dir / str(video_id)
            if video_temp_dir.exists():
                import shutil
                shutil.rmtree(video_temp_dir)
                logger.debug(f"Cleaned up temp directory for {video_id}")

        except Exception as e:
            logger.warning(f"Failed to cleanup temp files for {video_id}: {str(e)}")

    async def get_pipeline_health(self) -> dict:
        """
        Get overall pipeline health status.

        Returns:
            Dictionary with pipeline health information
        """
        try:
            active_count = await self.get_active_processing_count()
            active_videos = await self.get_active_processing_videos()

            # Get Redis status
            redis_healthy = True
            try:
                await video_status_service.redis.client.ping()
            except Exception:
                redis_healthy = False

            # Get database status
            db_healthy = True
            try:
                async with db_manager.get_session_context() as session:
                    await session.execute("SELECT 1")
            except Exception:
                db_healthy = False

            return {
                "status": "healthy" if redis_healthy and db_healthy else "unhealthy",
                "active_processing_count": active_count,
                "active_video_ids": active_videos,
                "redis_healthy": redis_healthy,
                "database_healthy": db_healthy,
                "temp_directory": str(self.temp_dir),
                "temp_directory_exists": self.temp_dir.exists(),
            }

        except Exception as e:
            logger.error(f"Failed to get pipeline health: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "active_processing_count": 0,
                "active_video_ids": [],
                "redis_healthy": False,
                "database_healthy": False,
            }


# Global pipeline orchestrator instance
video_processing_pipeline = VideoProcessingPipeline()