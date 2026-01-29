"""
Background task processing system for video processing pipeline.
"""

import asyncio
import logging
import os
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import UploadFile

import aiofiles

from app.core.background_exceptions import (
    BackgroundTaskException,
    TaskTimeoutException,
    background_error_handler,
)
from app.core.config import get_google_cloud_settings
from app.core.exceptions import ErrorCodes, VideoProcessingException, exception_handler
from app.services.ai_orchestrator_service import ai_orchestrator
from app.services.gcs_service import gcs_service
from app.services.video_service import VideoService
from app.services.video_status_service import video_status_service

logger = logging.getLogger(__name__)


class BackgroundTaskManager:
    """
    Manages background video processing tasks with timeout handling and error recovery.
    """

    def __init__(self):
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.task_timeouts: Dict[str, asyncio.Task] = {}
        self.timeout_seconds = 3600  # 60 minutes (increased for long video processing)

    async def start_video_processing_from_file(
        self, video_id: UUID, temp_file_path: str, file_metadata: dict, language: Optional[str] = "ko"
    ) -> None:
        """
        Start video processing pipeline from uploaded file.

        Args:
            video_id: Unique video identifier
            temp_file_path: Path to temporary file containing video data
            file_metadata: Metadata about the uploaded file (filename, content_type, size)
            language: Language for analysis
        """
        video_id_str = str(video_id)

        # Check if task is already running (in-memory check)
        if video_id_str in self.active_tasks:
            logger.warning(f"Task already running for video {video_id_str} (in-memory)")
            return

        # Check retry count in Redis to prevent infinite loops
        retry_count = await self._get_retry_count(video_id_str)
        max_retries = 3  # Maximum number of complete pipeline retries

        if retry_count >= max_retries:
            logger.error(
                f"Video {video_id_str} has reached maximum retry limit ({max_retries}). "
                f"Aborting to prevent infinite loop.",
                extra={"video_id": video_id_str, "retry_count": retry_count, "max_retries": max_retries}
            )
            await video_status_service.fail_processing(
                video_id,
                f"Maximum retry limit reached ({max_retries} attempts). Please check the video or contact support.",
                error_code=ErrorCodes.PROCESSING_FAILED,
                http_status=500
            )
            return

        # Increment retry count
        await self._increment_retry_count(video_id_str)
        logger.info(
            f"Starting video processing for {video_id_str} from file (attempt {retry_count + 1}/{max_retries})",
            extra={
                "video_id": video_id_str,
                "retry_count": retry_count + 1,
                "max_retries": max_retries,
                "file_name": file_metadata.get('filename')  # Changed from 'filename' to avoid LogRecord conflict
            }
        )

        # Initialize processing status
        await video_status_service.initialize_video_processing(video_id)

        # Create background task
        task = asyncio.create_task(
            self._process_video_from_file(video_id, temp_file_path, file_metadata, language),
            name=f"process_video_{video_id_str}",
        )

        # Store task reference
        self.active_tasks[video_id_str] = task

        # Set up timeout handler
        timeout_task = asyncio.create_task(
            self._handle_task_timeout(video_id_str), name=f"timeout_{video_id_str}"
        )
        self.task_timeouts[video_id_str] = timeout_task

        logger.info(f"Started background processing for video {video_id_str}")

    async def start_video_processing_from_url(
        self, video_id: UUID, url: str, language: Optional[str] = "ko"
    ) -> None:
        """
        Start video processing pipeline from URL.

        Args:
            video_id: Unique video identifier
            url: Video URL to download and process
            language: Language for analysis
        """
        video_id_str = str(video_id)

        # Check if task is already running (in-memory check)
        if video_id_str in self.active_tasks:
            logger.warning(f"Task already running for video {video_id_str} (in-memory)")
            return

        # Check retry count in Redis to prevent infinite loops
        retry_count = await self._get_retry_count(video_id_str)
        max_retries = 3  # Maximum number of complete pipeline retries

        if retry_count >= max_retries:
            logger.error(
                f"Video {video_id_str} has reached maximum retry limit ({max_retries}). "
                f"Aborting to prevent infinite loop.",
                extra={"video_id": video_id_str, "retry_count": retry_count, "max_retries": max_retries}
            )
            await video_status_service.fail_processing(
                video_id,
                f"Maximum retry limit reached ({max_retries} attempts). Please check the video or contact support.",
                error_code=ErrorCodes.PROCESSING_FAILED,
                http_status=500
            )
            return

        # Increment retry count
        await self._increment_retry_count(video_id_str)
        logger.info(
            f"Starting video processing for {video_id_str} from URL (attempt {retry_count + 1}/{max_retries})",
            extra={"video_id": video_id_str, "retry_count": retry_count + 1, "max_retries": max_retries, "url": url}
        )

        # Initialize processing status
        await video_status_service.initialize_video_processing(video_id)

        # Create background task
        task = asyncio.create_task(
            self._process_video_from_url(video_id, url, language),
            name=f"process_video_url_{video_id_str}",
        )

        # Store task reference
        self.active_tasks[video_id_str] = task

        # Set up timeout handler
        timeout_task = asyncio.create_task(
            self._handle_task_timeout(video_id_str), name=f"timeout_{video_id_str}"
        )
        self.task_timeouts[video_id_str] = timeout_task

        logger.info(f"Started background processing for video {video_id_str} from URL")

    async def start_video_processing_from_gcs(
        self, video_id: UUID, gcs_path: str, language: Optional[str] = "ko"
    ) -> None:
        """
        Start video processing pipeline for a video already uploaded to GCS.

        This is used when videos are uploaded directly to GCS via signed URL.

        Args:
            video_id: Unique video identifier
            gcs_path: GCS path where video is stored
            language: Language for analysis
        """
        video_id_str = str(video_id)

        # Check if task is already running (in-memory check)
        if video_id_str in self.active_tasks:
            logger.warning(f"Task already running for video {video_id_str} (in-memory)")
            return

        # Check retry count in Redis to prevent infinite loops
        retry_count = await self._get_retry_count(video_id_str)
        max_retries = 3

        if retry_count >= max_retries:
            logger.error(
                f"Video {video_id_str} has reached maximum retry limit ({max_retries}). "
                f"Aborting to prevent infinite loop.",
                extra={"video_id": video_id_str, "retry_count": retry_count, "max_retries": max_retries}
            )
            await video_status_service.fail_processing(
                video_id,
                f"Maximum retry limit reached ({max_retries} attempts). Please check the video or contact support.",
                error_code=ErrorCodes.PROCESSING_FAILED,
                http_status=500
            )
            return

        # Increment retry count
        await self._increment_retry_count(video_id_str)
        logger.info(
            f"Starting video processing for {video_id_str} from GCS (attempt {retry_count + 1}/{max_retries})",
            extra={"video_id": video_id_str, "retry_count": retry_count + 1, "max_retries": max_retries, "gcs_path": gcs_path}
        )

        # Initialize processing status
        await video_status_service.initialize_video_processing(video_id)

        # Create background task
        task = asyncio.create_task(
            self._process_video_from_gcs(video_id, gcs_path, language),
            name=f"process_video_gcs_{video_id_str}",
        )

        # Store task reference
        self.active_tasks[video_id_str] = task

        # Set up timeout handler
        timeout_task = asyncio.create_task(
            self._handle_task_timeout(video_id_str), name=f"timeout_{video_id_str}"
        )
        self.task_timeouts[video_id_str] = timeout_task

        logger.info(f"Started background processing for video {video_id_str} from GCS")

    async def _run_ai_pipeline(self, video_id: UUID, local_video_path: str, language: Optional[str] = "ko") -> None:
        """Runs the sequential AI processing steps."""
        video_id_str = str(video_id)
        logger.info(f"[{video_id_str}] Starting AI pipeline.")

        # Step 3: AI Analysis and Summary Generation (50% progress)
        logger.info(f"[{video_id_str}] Step 3: Starting AI analysis.")
        await self._ai_analysis_step(video_id, local_video_path, language)
        logger.info(f"[{video_id_str}] Step 3: AI analysis complete.")

        # Step 4: Speech-to-Text Transcription (80% progress)
        logger.info(f"[{video_id_str}] Step 4: Starting transcription.")
        await self._transcription_step(video_id, local_video_path)
        logger.info(f"[{video_id_str}] Step 4: Transcription complete.")

        # Step 5: Video Segmentation (90% progress)
        logger.info(f"[{video_id_str}] Step 5: Starting video segmentation.")
        await self._segmentation_step(video_id, local_video_path)
        logger.info(f"[{video_id_str}] Step 5: Video segmentation complete.")

        # Translation is now handled on-demand via API, not in the processing pipeline



    async def _process_video_from_file(self, video_id: UUID, temp_file_path: str, file_metadata: dict, language: Optional[str] = "ko") -> None:
        """
        Main video processing pipeline for uploaded files.

        Args:
            video_id: Unique video identifier
            temp_file_path: Path to temporary file containing video data
            file_metadata: Metadata about the uploaded file
            language: Language for analysis
        """
        video_id_str = str(video_id)

        try:
            await video_status_service.start_processing(video_id)
            logger.info(f"[{video_id_str}] Starting video processing pipeline.")

            # IMPORTANT: Reset YouTube-specific attributes for file uploads
            # This prevents YouTube caption download from being attempted on file uploads
            self.current_video_url = None
            self.is_youtube_video = False

            # Step 1: Upload to Google Cloud Storage (20% progress)
            logger.info(f"[{video_id_str}] Step 1: Uploading to Google Cloud Storage.")
            await self._upload_to_gcs_step(video_id, temp_file_path, file_metadata)
            logger.info(f"[{video_id_str}] Step 1: Upload to Google Cloud Storage complete.")

            # The video file is already available at temp_file_path. No download needed.

            # Step 2: Extract video metadata (30% progress)
            logger.info(f"[{video_id_str}] Step 2: Extracting video metadata.")
            await self._extract_metadata_step(video_id, temp_file_path)
            logger.info(f"[{video_id_str}] Step 2: Extracting video metadata complete.")

            # Steps 3-6: Run AI Pipeline
            await self._run_ai_pipeline(video_id, temp_file_path, language)

            # Step 7: Finalize and save results (100% progress)
            logger.info(f"[{video_id_str}] Step 7: Finalizing processing.")
            await self._finalization_step(video_id)
            logger.info(f"[{video_id_str}] Step 7: Finalization complete.")

            # Mark as complete
            await video_status_service.complete_processing(video_id)

            # Reset retry count on success
            await self._reset_retry_count(video_id_str)

            logger.info(f"Video processing completed successfully for {video_id_str}")

        except asyncio.CancelledError:
            logger.warning(f"Video processing cancelled for {video_id_str}")
            await video_status_service.fail_processing(
                video_id, "Processing was cancelled due to timeout"
            )
            raise
        except Exception as e:
            # Use enhanced error handling with recovery
            from app.services.error_recovery_service import error_recovery_service
            
            try:
                # Convert to VideoProcessingException for consistent handling
                processed_exc = await exception_handler.handle_exception(
                    e, video_id=video_id, step="PROCESSING_PIPELINE_FILE"
                )
                
                # Log the error with full context
                retry_count = await self._get_retry_count(video_id_str)
                logger.error(
                    f"Video processing pipeline failed for {video_id_str}: {str(processed_exc)} (attempt {retry_count})",
                    extra={
                        "video_id": video_id_str,
                        "step": "PROCESSING_PIPELINE_FILE",
                        "error_code": processed_exc.error_code,
                        "category": processed_exc.category,
                        "severity": processed_exc.severity,
                        "retryable": processed_exc.retryable,
                        "retry_count": retry_count,
                    },
                    exc_info=e,
                )

                # Note: Automatic retry is now handled by the caller (e.g., API endpoint)
                # based on retry count. We no longer use error_recovery_service.schedule_recovery()
                # to prevent infinite retry loops.

                # Update status with detailed error information
                error_msg = f"{processed_exc.category}: {processed_exc.detail['message']}"
                if retry_count >= 3:
                    error_msg += f" (Maximum retries reached: {retry_count} attempts)"

                await video_status_service.fail_processing(
                    video_id,
                    error_msg,
                    error_code=processed_exc.error_code,
                    http_status=processed_exc.status_code,
                )
                
            except Exception as handler_error:
                # Fallback error handling
                logger.critical(
                    f"Error handler failed for video {video_id_str}: {str(handler_error)}",
                    extra={"video_id": video_id_str, "original_error": str(e)},
                    exc_info=handler_error,
                )
                await video_status_service.fail_processing(
                    video_id, f"Processing failed: {str(e)}"
                )
        finally:
            # Clean up the original temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary video file for {video_id_str}: {temp_file_path}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup temp file: {str(cleanup_error)}")
            # Clean up task references
            self._cleanup_task(video_id_str)

    async def _process_video_from_url(self, video_id: UUID, url: str, language: Optional[str] = "ko") -> None:
        """
        Main video processing pipeline for URL downloads.

        Args:
            video_id: Unique video identifier
            url: Video URL to download
            language: Language for analysis
        """
        video_id_str = str(video_id)
        temp_file_path = None

        try:
            await video_status_service.start_processing(video_id)
            logger.info(f"Starting video processing pipeline for {video_id_str} from URL")

            # Check if this is a YouTube URL
            from app.core.youtube_utils import is_youtube_url
            is_youtube = is_youtube_url(url)

            # Store URL for later use (e.g., in caption download)
            self.current_video_url = url
            self.is_youtube_video = is_youtube

            # Step 1: Download video from URL (10% progress)
            # This step downloads the file and stores its path in self.temp_file_path
            await self._download_from_url_step(video_id, url)
            temp_file_path = getattr(self, 'temp_file_path', None)

            if not temp_file_path or not os.path.exists(temp_file_path):
                raise VideoProcessingException(
                    ErrorCodes.PROCESSING_FAILED,
                    "Downloaded video file not found for processing"
                )

            # Step 2: Upload to Google Cloud Storage (20% progress)
            await self._upload_downloaded_to_gcs_step(video_id)

            # The video file is now available at temp_file_path. No further download needed.

            # Step 2.5: Extract video metadata (30% progress)
            logger.info(f"[{video_id_str}] Step 2.5: Extracting video metadata.")
            await self._extract_metadata_step(video_id, temp_file_path)
            logger.info(f"[{video_id_str}] Step 2.5: Extracting video metadata complete.")

            # Steps 3-6: Run AI Pipeline (with YouTube caption support)
            await self._run_ai_pipeline(video_id, temp_file_path, language)

            # Step 7: Finalize and save results (100% progress)
            logger.info(f"[{video_id_str}] Step 7: Finalizing processing.")
            await self._finalization_step(video_id)
            logger.info(f"[{video_id_str}] Step 7: Finalization complete.")

            # Mark as complete
            await video_status_service.complete_processing(video_id)

            # Reset retry count on success
            await self._reset_retry_count(video_id_str)

            logger.info(f"Video processing completed successfully for {video_id_str}")

        except asyncio.CancelledError:
            logger.warning(f"Video processing cancelled for {video_id_str}")
            await video_status_service.fail_processing(
                video_id, "Processing was cancelled due to timeout"
            )
            raise
        except Exception as e:
            # Use enhanced error handling with recovery
            from app.services.error_recovery_service import error_recovery_service
            
            try:
                # Convert to VideoProcessingException for consistent handling
                processed_exc = await exception_handler.handle_exception(
                    e, video_id=video_id, step="PROCESSING_PIPELINE_URL"
                )
                
                # Log the error with full context
                retry_count = await self._get_retry_count(video_id_str)
                logger.error(
                    f"Video processing pipeline from URL failed for {video_id_str}: {str(processed_exc)} (attempt {retry_count})",
                    extra={
                        "video_id": video_id_str,
                        "step": "PROCESSING_PIPELINE_URL",
                        "error_code": processed_exc.error_code,
                        "category": processed_exc.category,
                        "severity": processed_exc.severity,
                        "retryable": processed_exc.retryable,
                        "retry_count": retry_count,
                        "url": url,
                    },
                    exc_info=e,
                )

                # Note: Automatic retry is now handled by the caller (e.g., API endpoint)
                # based on retry count. We no longer use error_recovery_service.schedule_recovery()
                # to prevent infinite retry loops.

                # Update status with detailed error information
                error_msg = f"{processed_exc.category}: {processed_exc.detail['message']}"
                if retry_count >= 3:
                    error_msg += f" (Maximum retries reached: {retry_count} attempts)"

                await video_status_service.fail_processing(
                    video_id,
                    error_msg,
                    error_code=processed_exc.error_code,
                    http_status=processed_exc.status_code,
                )
                
            except Exception as handler_error:
                # Fallback error handling
                logger.critical(
                    f"Error handler failed for video {video_id_str}: {str(handler_error)}",
                    extra={"video_id": video_id_str, "original_error": str(e), "url": url},
                    exc_info=handler_error,
                )
                await video_status_service.fail_processing(
                    video_id, f"Processing failed: {str(e)}"
                )
        finally:
            # Clean up the temporary file from the URL download
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary video file for {video_id_str}: {temp_file_path}")
                    if hasattr(self, 'temp_file_path'):
                        delattr(self, 'temp_file_path')
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup temp file: {str(cleanup_error)}")
            # Clean up task references
            self._cleanup_task(video_id_str)

    async def _process_video_from_gcs(self, video_id: UUID, gcs_path: str, language: Optional[str] = "ko") -> None:
        """
        Main video processing pipeline for videos already in GCS (direct upload via signed URL).

        Args:
            video_id: Unique video identifier
            gcs_path: GCS path where video is stored
            language: Language for analysis
        """
        video_id_str = str(video_id)
        temp_file_path = None

        try:
            await video_status_service.start_processing(video_id)
            logger.info(f"[{video_id_str}] Starting video processing pipeline from GCS.")

            # IMPORTANT: Reset YouTube-specific attributes
            self.current_video_url = None
            self.is_youtube_video = False

            # Step 1: Download from GCS to local temp file (10% progress)
            logger.info(f"[{video_id_str}] Step 1: Downloading from GCS.")
            temp_file_path = await self._download_from_gcs_step(video_id, gcs_path)
            logger.info(f"[{video_id_str}] Step 1: Download from GCS complete.")

            # Step 2: Extract video metadata (30% progress)
            logger.info(f"[{video_id_str}] Step 2: Extracting video metadata.")
            await self._extract_metadata_step(video_id, temp_file_path)
            logger.info(f"[{video_id_str}] Step 2: Extracting video metadata complete.")

            # Steps 3-6: Run AI Pipeline
            await self._run_ai_pipeline(video_id, temp_file_path, language)

            # Step 7: Finalize and save results (100% progress)
            logger.info(f"[{video_id_str}] Step 7: Finalizing processing.")
            await self._finalization_step(video_id)
            logger.info(f"[{video_id_str}] Step 7: Finalization complete.")

            # Mark as complete
            await video_status_service.complete_processing(video_id)

            # Reset retry count on success
            await self._reset_retry_count(video_id_str)

            logger.info(f"Video processing completed successfully for {video_id_str}")

        except asyncio.CancelledError:
            logger.warning(f"Video processing cancelled for {video_id_str}")
            await video_status_service.fail_processing(
                video_id, "Processing was cancelled due to timeout"
            )
            raise
        except Exception as e:
            # Use enhanced error handling with recovery
            from app.services.error_recovery_service import error_recovery_service

            try:
                # Convert to VideoProcessingException for consistent handling
                processed_exc = await exception_handler.handle_exception(
                    e, video_id=video_id, step="PROCESSING_PIPELINE_GCS"
                )

                # Log the error with full context
                retry_count = await self._get_retry_count(video_id_str)
                logger.error(
                    f"Video processing pipeline from GCS failed for {video_id_str}: {str(processed_exc)} (attempt {retry_count})",
                    extra={
                        "video_id": video_id_str,
                        "step": "PROCESSING_PIPELINE_GCS",
                        "error_code": processed_exc.error_code,
                        "category": processed_exc.category,
                        "severity": processed_exc.severity,
                        "retryable": processed_exc.retryable,
                        "retry_count": retry_count,
                        "gcs_path": gcs_path,
                    },
                    exc_info=e,
                )

                # Update status with detailed error information
                error_msg = f"{processed_exc.category}: {processed_exc.detail['message']}"
                if retry_count >= 3:
                    error_msg += f" (Maximum retries reached: {retry_count} attempts)"

                await video_status_service.fail_processing(
                    video_id,
                    error_msg,
                    error_code=processed_exc.error_code,
                    http_status=processed_exc.status_code,
                )

            except Exception as handler_error:
                # Fallback error handling
                logger.critical(
                    f"Error handler failed for video {video_id_str}: {str(handler_error)}",
                    extra={"video_id": video_id_str, "original_error": str(e), "gcs_path": gcs_path},
                    exc_info=handler_error,
                )
                await video_status_service.fail_processing(
                    video_id, f"Processing failed: {str(e)}"
                )
        finally:
            # Clean up the temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary video file for {video_id_str}: {temp_file_path}")
                    if hasattr(self, 'temp_file_path'):
                        delattr(self, 'temp_file_path')
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup temp file: {str(cleanup_error)}")
            # Clean up task references
            self._cleanup_task(video_id_str)

    async def _handle_task_timeout(self, video_id_str: str) -> None:
        """
        Handle task timeout by cancelling the processing task.

        Args:
            video_id_str: Video ID as string
        """
        try:
            # Wait for timeout duration
            await asyncio.sleep(self.timeout_seconds)

            # If we reach here, the task has timed out
            if video_id_str in self.active_tasks:
                task = self.active_tasks[video_id_str]
                if not task.done():
                    logger.warning(f"Cancelling timed out task for video {video_id_str}")
                    task.cancel()

                    # Update status to failed
                    video_id = UUID(video_id_str)
                    await video_status_service.fail_processing(
                        video_id, f"Processing timeout after {self.timeout_seconds} seconds"
                    )

        except asyncio.CancelledError:
            # Timeout task was cancelled (normal completion)
            pass
        except Exception as e:
            logger.error(f"Error in timeout handler for {video_id_str}: {str(e)}")

    def _cleanup_task(self, video_id_str: str) -> None:
        """
        Clean up task references and cancel timeout handler.

        Args:
            video_id_str: Video ID as string
        """
        # Remove from active tasks
        if video_id_str in self.active_tasks:
            del self.active_tasks[video_id_str]

        # Cancel and remove timeout task
        if video_id_str in self.task_timeouts:
            timeout_task = self.task_timeouts[video_id_str]
            if not timeout_task.done():
                timeout_task.cancel()
            del self.task_timeouts[video_id_str]

        logger.debug(f"Cleaned up task references for video {video_id_str}")

    async def cancel_task(self, video_id: UUID) -> bool:
        """
        Cancel a running video processing task.

        Args:
            video_id: Video identifier

        Returns:
            True if task was cancelled, False if no task was running
        """
        video_id_str = str(video_id)

        if video_id_str not in self.active_tasks:
            return False

        task = self.active_tasks[video_id_str]
        if not task.done():
            task.cancel()
            await video_status_service.fail_processing(
                video_id, "Processing was manually cancelled"
            )
            logger.info(f"Cancelled processing task for video {video_id_str}")
            return True

        return False

    async def get_active_tasks(self) -> list[str]:
        """
        Get list of currently active video processing tasks.

        Returns:
            List of video IDs with active processing tasks
        """
        active_video_ids = []
        for video_id_str, task in self.active_tasks.items():
            if not task.done():
                active_video_ids.append(video_id_str)

        return active_video_ids

    async def get_task_status(self, video_id: UUID) -> Optional[str]:
        """
        Get the current status of a processing task.

        Args:
            video_id: Video identifier

        Returns:
            Task status string or None if no task exists
        """
        video_id_str = str(video_id)

        if video_id_str not in self.active_tasks:
            return None

        task = self.active_tasks[video_id_str]
        if task.done():
            if task.cancelled():
                return "CANCELLED"
            elif task.exception():
                return "FAILED"
            else:
                return "COMPLETED"
        else:
            return "RUNNING"

    # Processing step methods - fully integrated implementations
    async def _upload_to_gcs_step(self, video_id: UUID, temp_file_path: str, file_metadata: dict) -> str:
        """Upload video file and generate thumbnail to Google Cloud Storage."""
        await video_status_service.update_processing_step(video_id, "UPLOADING_TO_GCS", 20)

        try:
            # Generate GCS path
            from app.services.gcs_service import GCSService
            gcs_svc = GCSService()
            gcs_path = gcs_svc._generate_gcs_path(video_id, file_metadata['filename'])

            # Create blob and upload
            blob = gcs_svc.bucket.blob(gcs_path)
            content_type = file_metadata.get('content_type', 'video/mp4')

            # Set metadata
            from datetime import datetime, timezone
            metadata = {
                "video_id": str(video_id),
                "original_filename": file_metadata['filename'],
                "upload_timestamp": datetime.now(timezone.utc).isoformat(),
                "file_size": str(file_metadata['size'])
            }
            blob.metadata = metadata

            # Upload file content directly from file (streaming) with explicit content type and configurable timeout
            gcs_config = get_google_cloud_settings()
            upload_timeout = gcs_config.gcs_upload_timeout_sec

            # Set content type before upload
            blob.content_type = content_type

            # Use upload_from_filename for efficient streaming upload
            await asyncio.to_thread(
                blob.upload_from_filename,
                temp_file_path,
                content_type=content_type,
                timeout=upload_timeout
            )
            logger.debug(f"[{video_id}] GCS upload call completed.")

            # Reload blob metadata to get updated properties
            blob.reload()

            # Extract file metadata
            gcs_file_metadata = {
                "gcs_path": gcs_path,
                "bucket_name": gcs_svc.bucket_name,
                "blob_name": gcs_path,
                "content_type": blob.content_type,
                "size_bytes": blob.size,
                "md5_hash": blob.md5_hash,
                "etag": blob.etag,
                "time_created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "generation": blob.generation,
                "metageneration": blob.metageneration,
            }

            # Update video record with GCS path and metadata
            from app.core.database import db_manager
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                await video_service.update_video_metadata(video_id, {
                    "gcs_path": gcs_path,
                    "file_metadata": gcs_file_metadata,
                    "file_size_bytes": blob.size
                })

            logger.info(f"GCS upload completed for video {video_id}: {gcs_path}")

            # Generate and upload thumbnail from video file using FFmpeg
            try:
                import tempfile
                import ffmpeg

                logger.info(f"Generating thumbnail for video {video_id} from video file")

                # Create temporary file for thumbnail
                thumbnail_temp_path = os.path.join(tempfile.gettempdir(), f"{video_id}_thumbnail.jpg")

                # Extract thumbnail at 1 second using FFmpeg
                await asyncio.to_thread(
                    lambda: (
                        ffmpeg
                        .input(temp_file_path, ss=1)
                        .filter('scale', 640, -1)
                        .output(thumbnail_temp_path, vframes=1, format='image2', vcodec='mjpeg')
                        .overwrite_output()
                        .run(capture_stdout=True, capture_stderr=True, quiet=True)
                    )
                )

                # Read thumbnail data
                import aiofiles
                async with aiofiles.open(thumbnail_temp_path, 'rb') as f:
                    thumbnail_data = await f.read()

                # Upload thumbnail to GCS
                thumbnail_gcs_path, thumbnail_metadata = await gcs_svc.upload_thumbnail(
                    thumbnail_data=thumbnail_data,
                    video_id=video_id,
                    content_type="image/jpeg"
                )

                # Update video record with thumbnail GCS path
                async with db_manager.get_session_context() as session:
                    video_service = VideoService(session)
                    await video_service.update_video_metadata(video_id, {
                        "thumbnail_gcs_path": thumbnail_gcs_path
                    })

                # Clean up temp thumbnail file
                if os.path.exists(thumbnail_temp_path):
                    os.unlink(thumbnail_temp_path)

                logger.info(f"Thumbnail generated and uploaded to GCS for video {video_id}: {thumbnail_gcs_path}")

            except Exception as thumbnail_error:
                # Log error but don't fail the entire upload
                logger.warning(f"Failed to generate/upload thumbnail for video {video_id}: {str(thumbnail_error)}")

            return gcs_path

        except VideoProcessingException:
            # Re-raise VideoProcessingException to preserve original error code
            raise
        except Exception as e:
            logger.error(f"GCS upload failed for video {video_id}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to upload video to cloud storage: {str(e)}"
            )

    async def _download_from_url_step(self, video_id: UUID, url: str) -> None:
        """Download video from URL."""
        await video_status_service.update_processing_step(video_id, "DOWNLOADING", 10)
        
        try:
            # Get video information from database
            from app.core.database import db_manager
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                video = await video_service.get_video_by_id(video_id)

                # Check if YouTube URL
                from app.core.youtube_utils import is_youtube_url

                # Store temporary file path for download
                import tempfile

                temp_dir = tempfile.gettempdir()
                temp_filename = f"downloaded_{video_id}.mp4"
                self.temp_file_path = os.path.join(temp_dir, temp_filename)

                if is_youtube_url(url):
                    # Use YouTube download service
                    from app.services.youtube_download_service import youtube_download_service

                    logger.info(f"[URL_DEBUG] Downloading YouTube video for {video_id}: {url}")
                    logger.info(f"[URL_DEBUG] URL type: {type(url).__name__}, repr: {repr(url)}, len: {len(url)}")
                    logger.info(f"[URL_DEBUG] URL bytes: {url.encode('utf-8')}")

                    # Get video info first to check resolution
                    video_info = await youtube_download_service.get_video_info(url)

                    # Determine quality based on resolution
                    # For 4K videos (2160p or higher), download as 1080p to reduce file size and processing time
                    video_height = video_info.get('height', 0)
                    if video_height >= 2160:
                        quality = "1080p"
                        logger.info(f"[QUALITY_AUTO] 4K video detected ({video_height}p), downloading as 1080p for optimal processing")
                    elif video_height >= 1080:
                        quality = "1080p"
                        logger.info(f"[QUALITY_AUTO] High resolution video detected ({video_height}p), downloading as 1080p")
                    else:
                        quality = "best"
                        logger.info(f"[QUALITY_AUTO] Standard resolution video ({video_height}p), using best quality")

                    # Download YouTube video with auto-selected quality
                    downloaded_path, metadata = await youtube_download_service.download_video(
                        url, self.temp_file_path, quality=quality
                    )

                    # Update temp_file_path if it's different
                    self.temp_file_path = downloaded_path
                    file_size = metadata['downloaded_file_size']
                    duration = metadata['duration']

                    # Update video metadata with YouTube info
                    await video_service.update_video_metadata(video_id, {
                        "file_size_bytes": file_size,
                        "duration_seconds": duration,
                        "download_completed": True,
                        "temp_file_path": self.temp_file_path,
                        "title": metadata.get('title'),
                        "description": metadata.get('description'),
                        "thumbnail_url": metadata.get('thumbnail'),
                    })
                else:
                    # Download and validate video from URL
                    from app.core.validation import download_video_from_url

                    # Download video to temporary file
                    file_size, duration = await download_video_from_url(url, self.temp_file_path)

                    # Update video metadata (no title/description for direct URLs)
                    await video_service.update_video_metadata(video_id, {
                        "file_size_bytes": file_size,
                        "duration_seconds": duration,
                        "download_completed": True,
                        "temp_file_path": self.temp_file_path
                    })
                
                logger.info(f"URL download completed for video {video_id}: {file_size} bytes")
                
        except VideoProcessingException:
            # Re-raise VideoProcessingException (including user errors like VIDEO_TOO_LONG)
            # to preserve original error code and severity
            raise
        except Exception as e:
            logger.error(f"URL download failed for video {video_id}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to download video from URL: {str(e)}"
            )

    async def _upload_downloaded_to_gcs_step(self, video_id: UUID) -> None:
        """Upload downloaded video and thumbnail to Google Cloud Storage."""
        await video_status_service.update_processing_step(video_id, "UPLOADING_TO_GCS", 20)

        try:
            # Get video information from database
            from app.core.database import db_manager
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                video = await video_service.get_video_by_id(video_id)

                # Get temporary file path
                temp_file_path = getattr(self, 'temp_file_path', None)
                if not temp_file_path or not os.path.exists(temp_file_path):
                    raise VideoProcessingException(
                        ErrorCodes.PROCESSING_FAILED,
                        "Downloaded video file not found for upload"
                    )

                # Upload the downloaded file to GCS
                # Read the local file and create an UploadFile object
                import aiofiles
                from fastapi import UploadFile
                from io import BytesIO

                # Read the downloaded file
                async with aiofiles.open(self.temp_file_path, "rb") as f:
                    file_content = await f.read()

                # Create a fake UploadFile object for GCS service
                fake_file = UploadFile(
                    filename=video.original_filename or "video.mp4",
                    file=BytesIO(file_content),
                )

                # Upload to GCS using the upload_file method
                gcs_path, file_metadata = await gcs_service.upload_file(
                    file=fake_file,
                    video_id=video_id,
                    content_type=video.mime_type or "video/mp4"
                )

                # Update video record with GCS path
                await video_service.update_video_metadata(video_id, {
                    "gcs_path": gcs_path,
                    "file_metadata": file_metadata
                })

                logger.info(f"Downloaded file GCS upload completed for video {video_id}: {gcs_path}")

                # Upload thumbnail if available (from YouTube or other sources)
                thumbnail_gcs_path = None
                if video.analysis_result and video.analysis_result.get("video_metadata", {}).get("thumbnail_url"):
                    thumbnail_url = video.analysis_result["video_metadata"]["thumbnail_url"]
                    logger.info(f"Downloading and uploading thumbnail for video {video_id} from: {thumbnail_url}")

                    try:
                        import httpx

                        # Download thumbnail from URL
                        async with httpx.AsyncClient() as client:
                            response = await client.get(thumbnail_url)
                            response.raise_for_status()
                            thumbnail_data = response.content

                        # Upload thumbnail to GCS
                        thumbnail_gcs_path, thumbnail_metadata = await gcs_service.upload_thumbnail(
                            thumbnail_data=thumbnail_data,
                            video_id=video_id,
                            content_type="image/jpeg"
                        )

                        # Update video record with thumbnail GCS path
                        await video_service.update_video_metadata(video_id, {
                            "thumbnail_gcs_path": thumbnail_gcs_path
                        })

                        logger.info(f"Thumbnail uploaded to GCS for video {video_id}: {thumbnail_gcs_path}")

                    except Exception as thumbnail_error:
                        # Log error but don't fail the entire upload
                        logger.warning(f"Failed to upload thumbnail for video {video_id}: {str(thumbnail_error)}")

        except VideoProcessingException:
            # Re-raise VideoProcessingException to preserve original error code
            raise
        except Exception as e:
            logger.error(f"Downloaded file GCS upload failed for video {video_id}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to upload downloaded video to cloud storage: {str(e)}"
            )

    async def _download_from_gcs_step(self, video_id: UUID, gcs_path: str) -> str:
        """
        Download video from GCS to local temporary file.

        This is used for videos that were uploaded directly to GCS via signed URL.

        Args:
            video_id: Video UUID
            gcs_path: GCS path where video is stored

        Returns:
            Path to downloaded temporary file

        Raises:
            VideoProcessingException: If download fails
        """
        await video_status_service.update_processing_step(video_id, "DOWNLOADING", 10)
        video_id_str = str(video_id)

        try:
            from app.services.gcs_service import GCSService
            from pathlib import Path
            import tempfile

            # Create temp directory
            temp_dir = Path(tempfile.gettempdir()) / "genova_video_processing"
            temp_dir.mkdir(exist_ok=True)

            # Download from GCS
            gcs_service = GCSService()
            temp_file_path = await gcs_service.download_to_temp(gcs_path, str(temp_dir))

            # Store temp file path for cleanup
            self.temp_file_path = temp_file_path

            logger.info(
                f"[{video_id_str}] Downloaded video from GCS: {gcs_path} -> {temp_file_path}",
                extra={"video_id": video_id_str, "gcs_path": gcs_path}
            )

            return temp_file_path

        except Exception as e:
            logger.error(
                f"[{video_id_str}] Failed to download from GCS: {str(e)}",
                extra={"video_id": video_id_str, "gcs_path": gcs_path},
                exc_info=True
            )
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to download video from GCS: {str(e)}"
            )

    async def _extract_metadata_step(self, video_id: UUID, local_video_path: str) -> None:
        """Extract video metadata."""
        await video_status_service.update_processing_step(video_id, "EXTRACTING_METADATA", 30)
        
        try:
            # Get video information from database
            from app.core.database import db_manager
            from app.services.video_segmentation_service import video_segmentation_service
            
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                
                try:
                    # Extract metadata using video segmentation service
                    metadata = await video_segmentation_service.extract_video_metadata(
                        local_video_path
                    )
                    
                    # Update video with extracted metadata
                    await video_service.update_video_metadata(video_id, metadata)
                    
                    # Store metadata in Redis for other steps
                    await video_status_service.store_processing_metadata(
                        video_id, {"video_metadata": metadata}
                    )
                    
                    logger.info(f"Metadata extraction completed for video {video_id}: {metadata.get('duration_seconds')}s")
                    
                finally:
                    # The temporary file is no longer cleaned up here, but in the main processing function
                    pass

        except VideoProcessingException:
            # Re-raise VideoProcessingException to preserve original error code
            raise
        except Exception as e:
            logger.error(f"Metadata extraction failed for video {video_id}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Failed to extract video metadata: {str(e)}"
            )

    async def _ai_analysis_step(self, video_id: UUID, local_video_path: str, language: Optional[str] = "ko") -> None:
        """Perform AI analysis and summary generation (with YouTube caption support)."""
        await video_status_service.update_processing_step(video_id, "SUMMARIZATION", 50)

        try:
            # Check if this is a YouTube video with captions
            is_youtube = getattr(self, 'is_youtube_video', False)
            video_url = getattr(self, 'current_video_url', None)

            caption_segments = None
            if is_youtube and video_url:
                # Try to download and parse YouTube captions
                logger.info(f"Attempting to download YouTube captions for video {video_id}")
                try:
                    from app.services.youtube_download_service import youtube_download_service

                    # Download ALL available captions to detect actual language
                    captions_dict = await youtube_download_service.get_captions_as_segments(
                        video_url, languages=None  # None = download all available languages
                    )

                    # Detect language from downloaded captions (don't assume)
                    if captions_dict:
                        available_languages = list(captions_dict.keys())
                        logger.info(f"Available caption languages for video {video_id}: {available_languages}")

                        # Priority: ko > en > first available
                        if 'ko' in captions_dict:
                            detected_language = 'ko'
                        elif 'en' in captions_dict:
                            detected_language = 'en'
                        else:
                            detected_language = available_languages[0]

                        caption_segments = captions_dict[detected_language]
                        # Update language to the DETECTED language (not assumed)
                        language = detected_language

                        logger.info(
                            f"Downloaded {len(caption_segments)} caption segments for video {video_id} "
                            f"(detected language: {detected_language})"
                        )

                except Exception as caption_error:
                    logger.warning(
                        f"Failed to download YouTube captions for video {video_id}: {str(caption_error)}. "
                        f"Falling back to standard processing."
                    )

            # Get video information from database
            from app.core.database import db_manager
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)

                try:
                    # Choose processing method based on caption availability
                    if caption_segments:
                        logger.info(f"Using YouTube caption-based processing for video {video_id}")
                        ai_results = await ai_orchestrator.process_youtube_video_with_captions(
                            video_id, local_video_path, caption_segments, language, session
                        )
                    else:
                        logger.info(f"Using standard video processing for video {video_id}")
                        ai_results = await ai_orchestrator.process_video_with_ai(
                            video_id, local_video_path, session, source_language=language
                        )

                    logger.info(f"AI orchestrator completed, storing results for video {video_id}")

                    # Store AI analysis results in database
                    await video_service.update_video_analysis(video_id, ai_results)

                    # Store processing metadata in Redis
                    await video_status_service.store_processing_metadata(
                        video_id, {"ai_analysis": ai_results}
                    )

                    logger.info(f"AI analysis completed successfully for video {video_id}")

                finally:
                    # The temporary file is no longer cleaned up here, but in the main processing function
                    pass

        except Exception as e:
            logger.error(
                f"AI analysis failed for video {video_id}: {str(e)}",
                exc_info=True,
                extra={
                    "video_id": str(video_id),
                    "error_type": type(e).__name__,
                    "step": "AI_ANALYSIS"
                }
            )
            # Store error but continue processing
            await video_status_service.store_processing_metadata(
                video_id, {
                    "ai_analysis_error": {
                        "error": str(e),
                        "error_type": type(e).__name__,
                        "failed_at_step": "AI_ANALYSIS"
                    }
                }
            )

    async def _transcription_step(self, video_id: UUID, local_video_path: str) -> None:
        """Store transcription from AI analysis step."""
        await video_status_service.update_processing_step(video_id, "TRANSCRIBE", 80)

        try:
            # Check if transcription was already done in AI analysis step
            ai_metadata = await video_status_service.get_processing_metadata(video_id)

            if ai_metadata and "ai_analysis" in ai_metadata:
                ai_results = ai_metadata["ai_analysis"]
                if ai_results.get("transcription") or ai_results.get("transcript"):
                    logger.info(f"✓ Transcription already completed in AI orchestrator, storing results for video {video_id}")

                    # Ensure transcription is stored in database
                    from app.core.database import db_manager
                    async with db_manager.get_session_context() as session:
                        video_service = VideoService(session)
                        transcription_data = ai_results.get("transcription") or {"transcript": ai_results.get("transcript", "")}
                        await video_service.update_video_transcription(video_id, transcription_data)

                    return

            # If transcription not found, raise error
            logger.error(f"❌ Transcription not found in AI orchestrator results for video {video_id}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                "AI analysis did not provide transcription. Video processing cannot continue."
            )

        except VideoProcessingException:
            raise
        except Exception as e:
            logger.error(f"Transcription step failed for video {video_id}: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Transcription step failed: {str(e)}"
            )

    async def _segmentation_step(self, video_id: UUID, local_video_path: str) -> None:
        """Generate video segments."""
        await video_status_service.update_processing_step(video_id, "SEGMENTING", 90)
        
        try:
            # Get video information from database
            from app.core.database import db_manager
            from app.services.video_segmentation_service import video_segmentation_service
            from app.repositories.segment_repository import SegmentRepository
            
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                segment_repository = SegmentRepository(session)
                
                try:
                    # Extract video metadata using FFmpeg
                    metadata = await video_segmentation_service.extract_video_metadata(
                        local_video_path
                    )
                    
                    # Get AI analysis results from previous steps
                    all_metadata = await video_status_service.get_processing_metadata(video_id)
                    ai_metadata = all_metadata.get("ai_analysis") if all_metadata else None

                    # Vertex AI now provides segments with transcripts, so we don't need Speech-to-Text
                    # The transcription is already included in ai_metadata
                    transcription_metadata = None
                    if ai_metadata:
                        # Check if we have transcript from Vertex AI
                        vertex_transcript = ai_metadata.get("transcript", "")
                        if vertex_transcript:
                            transcription_metadata = {
                                "transcript": vertex_transcript,
                                "source": "vertex_ai",
                                "confidence": 0.95
                            }
                            logger.info(f"Using Vertex AI transcript: {len(vertex_transcript)} chars")

                    await segment_repository.delete_segments_by_video_id(video_id)

                    # Generate video segments (will use Vertex AI segments if available)
                    segments = await video_segmentation_service.generate_video_segments(
                        video_id,
                        local_video_path,
                        metadata,
                        ai_analysis=ai_metadata,
                        transcription=transcription_metadata
                    )
                    
                    # Save segments to database
                    await segment_repository.create_segments(video_id, segments)
                    
                    # Update video with metadata
                    await video_service.update_video_metadata(video_id, {
                        "duration_seconds": metadata.get("duration_seconds"),
                        "file_size_bytes": metadata.get("file_size_bytes"),
                        "metadata": metadata
                    })
                    
                    # Store segmentation results in Redis
                    await video_status_service.store_processing_metadata(
                        video_id, {
                            "segmentation": {
                                "segments_count": len(segments),
                                "metadata": metadata,
                                "segments": segments
                            }
                        }
                    )
                    
                    logger.info(f"Segmentation completed for video {video_id}: {len(segments)} segments created")
                    
                finally:
                    # The temporary file is no longer cleaned up here, but in the main processing function
                    pass
                        
        except Exception as e:
            logger.error(f"Segmentation failed for video {video_id}: {str(e)}")
            # Store error but continue processing
            await video_status_service.store_processing_metadata(
                video_id, {"segmentation_error": {"error": str(e)}}
            )
            # Create fallback single segment
            try:
                from app.core.database import db_manager
                from app.repositories.segment_repository import SegmentRepository
                
                async with db_manager.get_session_context() as session:
                    segment_repository = SegmentRepository(session)
                    fallback_segment = [{
                        "segment_no": 1,
                        "start_time": "00:00:00",
                        "end_time": "00:01:00",  # Will be updated with actual duration
                        "title": "Complete Video",
                        "summary": "Complete video content - segmentation failed",
                        "keywords": ["video", "content"],
                        "scripts": "",
                        "class_type": "content"
                    }]
                    await segment_repository.create_segments(video_id, fallback_segment)
                    logger.info(f"Created fallback segment for video {video_id}")
            except Exception as fallback_error:
                logger.error(f"Failed to create fallback segment for video {video_id}: {str(fallback_error)}")

    async def _translation_step(self, video_id: UUID) -> None:
        """Translate content to target languages."""
        await video_status_service.update_processing_step(video_id, "TRANSLATING", 95)
        
        try:
            # Check if translation was already done in AI analysis step
            all_metadata = await video_status_service.get_processing_metadata(video_id)
            ai_metadata = all_metadata.get("ai_analysis") if all_metadata else None

            # Check if translation was already done in AI orchestrator
            if ai_metadata and (ai_metadata.get("translated_analysis") or ai_metadata.get("translated_summary")):
                logger.info(f"✓ Translation already completed in AI orchestrator, reusing results for video {video_id}")

                # Ensure translations are stored in database
                from app.core.database import db_manager
                async with db_manager.get_session_context() as session:
                    video_service = VideoService(session)

                    # Update video translations if not already stored
                    if ai_metadata.get("translated_summary") or ai_metadata.get("translated_keywords"):
                        translation_data = {
                            "translated_summary": ai_metadata.get("translated_summary"),
                            "translated_keywords": ai_metadata.get("translated_keywords")
                        }
                        await video_service.update_video_translations(video_id, translation_data)

                return

            # Fallback: If translation not found in AI results, perform it now
            logger.warning(f"⚠ Translation not found in AI orchestrator results, performing standalone translation for video {video_id}")

            # Get video analysis and transcription data
            from app.core.database import db_manager
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                video = await video_service.get_video_by_id(video_id)

                if not video.analysis_result:
                    logger.warning(f"No analysis result found for translation for video {video_id}")
                    return

                # Translate analysis results
                from app.services.translation_service import translation_service
                translated_analysis = await translation_service.translate_video_analysis(
                    video.analysis_result, target_language="en"
                )

                # Get segments for translation
                segments = await video_service.get_video_segments(video_id)
                if segments:
                    segment_dicts = [
                        {
                            "title": seg.title,
                            "summary": seg.summary,
                            "keywords": seg.keywords,
                            "scripts": seg.scripts,
                            "start_time": seg.start_time,
                            "end_time": seg.end_time,
                            "segment_no": seg.segment_no,
                            "class_type": seg.class_type
                        }
                        for seg in segments
                    ]

                    translated_segments = await translation_service.translate_segments(
                        segment_dicts, target_language="en"
                    )

                    # Update segments with translations
                    await video_service.update_segments_translations(video_id, translated_segments)

                # Store translation results
                await video_service.update_video_translations(video_id, translated_analysis)

                # Store processing metadata in Redis
                await video_status_service.store_processing_metadata(
                    video_id, {
                        "translation": {
                            "translated_analysis": translated_analysis,
                            "target_language": "en"
                        }
                    }
                )
                
                logger.info(f"Translation completed for video {video_id}")
                
        except Exception as e:
            logger.error(f"Translation failed for video {video_id}: {str(e)}")
            # Store error but continue processing
            await video_status_service.store_processing_metadata(
                video_id, {"translation_error": {"error": str(e)}}
            )

    async def _finalization_step(self, video_id: UUID) -> None:
        """Finalize processing and save results."""
        await video_status_service.update_processing_step(video_id, "FINALIZING", 99)
        
        try:
            # Get video information from database
            from app.core.database import db_manager
            
            async with db_manager.get_session_context() as session:
                video_service = VideoService(session)
                video = await video_service.get_video_by_id(video_id)
                
                # Consolidate all processing results
                ai_metadata = await video_status_service.get_processing_metadata(video_id)
                
                # Update video status to COMPLETE in database
                await video_service.update_video_status(video_id, "COMPLETE", 100)
                
                # Store final processing summary in Redis
                final_summary = {
                    "processing_completed_at": datetime.now(timezone.utc).isoformat(),
                    "total_segments": len(video.segments) if hasattr(video, 'segments') else 0,
                    "ai_analysis_available": bool(ai_metadata and ai_metadata.get("ai_analysis")),
                    "transcription_available": bool(ai_metadata and ai_metadata.get("transcription")),
                    "translation_available": bool(ai_metadata and ai_metadata.get("translation")),
                    "segmentation_available": bool(ai_metadata and ai_metadata.get("segmentation")),
                    "video_duration": video.duration_seconds,
                    "file_size": video.file_size_bytes,
                    "gcs_path": video.gcs_path
                }
                
                await video_status_service.store_processing_metadata(
                    video_id, {"final_summary": final_summary}
                )
                
                logger.info(f"Finalization completed for video {video_id}: {final_summary}")
                
        except Exception as e:
            logger.error(f"Finalization failed for video {video_id}: {str(e)}")
            # Don't raise exception here - processing is essentially complete
            logger.warning(f"Video {video_id} processing completed with finalization errors")

    async def _get_retry_count(self, video_id_str: str) -> int:
        """
        Get the retry count for a video from Redis.

        Args:
            video_id_str: Video ID as string

        Returns:
            Current retry count (0 if not found)
        """
        try:
            from app.core.redis import redis_manager

            if not redis_manager.is_initialized or not redis_manager.client:
                logger.warning(f"Redis not initialized, returning retry count 0 for {video_id_str}")
                return 0

            retry_key = f"video_retry_count:{video_id_str}"
            count = await redis_manager.client.get(retry_key)
            return int(count) if count else 0
        except Exception as e:
            logger.warning(f"Failed to get retry count for {video_id_str}: {str(e)}")
            return 0

    async def _increment_retry_count(self, video_id_str: str) -> None:
        """
        Increment the retry count for a video in Redis.

        Args:
            video_id_str: Video ID as string
        """
        try:
            from app.core.redis import redis_manager

            if not redis_manager.is_initialized or not redis_manager.client:
                logger.warning(f"Redis not initialized, skipping retry count increment for {video_id_str}")
                return

            retry_key = f"video_retry_count:{video_id_str}"
            # Set expiry to 24 hours to prevent accumulation
            await redis_manager.client.incr(retry_key)
            await redis_manager.client.expire(retry_key, 86400)
        except Exception as e:
            logger.warning(f"Failed to increment retry count for {video_id_str}: {str(e)}")

    async def _reset_retry_count(self, video_id_str: str) -> None:
        """
        Reset the retry count for a video in Redis (called on success).

        Args:
            video_id_str: Video ID as string
        """
        try:
            from app.core.redis import redis_manager

            if not redis_manager.is_initialized or not redis_manager.client:
                logger.warning(f"Redis not initialized, skipping retry count reset for {video_id_str}")
                return

            retry_key = f"video_retry_count:{video_id_str}"
            await redis_manager.client.delete(retry_key)
        except Exception as e:
            logger.warning(f"Failed to reset retry count for {video_id_str}: {str(e)}")


# Global background task manager instance
background_task_manager = BackgroundTaskManager()