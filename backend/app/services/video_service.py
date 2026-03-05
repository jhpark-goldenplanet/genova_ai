"""
Video service for handling video upload and processing logic.
"""

import logging
import os
import tempfile
import uuid
from typing import Optional, Tuple

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ErrorCodes, VideoProcessingException
from app.core.validation import (
    download_video_from_url,
    validate_filename,
    validate_video_file,
    validate_video_url,
)
from app.models.video import Video
from app.repositories.video_repository import VideoRepository
from app.schemas.video import VideoCreate, VideoResponse
from app.services.gcs_service import GCSService

logger = logging.getLogger(__name__)


class VideoService:
    """Service class for video-related operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.video_repository = VideoRepository(session)

    async def create_video_from_file(
        self,
        file: UploadFile,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> VideoResponse:
        """
        Create a new video record from uploaded file.

        Args:
            file: Uploaded video file
            title: Optional video title
            description: Optional video description

        Returns:
            VideoResponse with video ID and status

        Raises:
            VideoProcessingException: If validation or creation fails
        """
        try:
            # Validate the uploaded file
            mime_type, file_size, duration = await validate_video_file(file)

            # Sanitize filename
            original_filename = validate_filename(file.filename or "unknown_video")

            # Generate title if not provided
            if not title:
                title = os.path.splitext(original_filename)[0].replace("_", " ").title()

            # Create video record
            video_data = VideoCreate(
                title=title,
                description=description,
                source_type="FILE_UPLOAD",
                original_filename=original_filename,
                mime_type=mime_type,
            )

            video = await self.video_repository.create(
                video_data=video_data.model_dump(),
                duration_seconds=duration,
                file_size_bytes=file_size,
            )

            return VideoResponse.from_video(
                video,
                message="Video uploaded successfully. Processing will begin shortly.",
            )

        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to create video record: {str(e)}",
                status_code=500,
            )

    async def create_video_from_url(
        self, url: str, title: Optional[str] = None, description: Optional[str] = None
    ) -> VideoResponse:
        """
        Create a new video record from URL.

        Args:
            url: Video URL to download
            title: Optional video title
            description: Optional video description

        Returns:
            VideoResponse with video ID and status

        Raises:
            VideoProcessingException: If validation or creation fails
        """
        try:
            # Validate URL (returns is_youtube flag as well)
            validated_url, content_type, _is_youtube = await validate_video_url(url)

            # Generate filename from URL
            from urllib.parse import urlparse

            parsed_url = urlparse(validated_url)
            original_filename = os.path.basename(parsed_url.path) or "video_from_url"
            original_filename = validate_filename(original_filename)

            # Ensure filename has extension
            if not os.path.splitext(original_filename)[1]:
                # Try to determine extension from content type
                extension_map = {
                    "video/mp4": ".mp4",
                    "video/quicktime": ".mov",
                    "video/x-msvideo": ".avi",
                    "video/x-ms-wmv": ".wmv",
                    "video/x-flv": ".flv",
                    "video/webm": ".webm",
                    "video/x-matroska": ".mkv",
                }
                extension = extension_map.get(content_type, ".mp4")
                original_filename += extension

            # Generate title if not provided
            if not title:
                title = os.path.splitext(original_filename)[0].replace("_", " ").title()

            # Create video record (we'll download and validate during processing)
            video_data = VideoCreate(
                title=title,
                description=description,
                source_type="URL_UPLOAD",
                original_filename=original_filename,
                mime_type=content_type,
            )

            video = await self.video_repository.create(
                video_data=video_data.model_dump(), source_url=validated_url
            )

            return VideoResponse.from_video(
                video,
                message="Video URL validated successfully. Download and processing will begin shortly.",
            )

        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to create video record from URL: {str(e)}",
                status_code=500,
            )

    async def get_video_by_id(self, video_id: uuid.UUID) -> Video:
        """
        Get video by ID.

        Args:
            video_id: Video UUID

        Returns:
            Video model instance

        Raises:
            VideoProcessingException: If video not found
        """
        video = await self.video_repository.get_by_id_with_segments(video_id)
        if not video:
            raise VideoProcessingException(
                ErrorCodes.VIDEO_NOT_FOUND,
                f"Video with ID {video_id} not found",
                status_code=404,
            )
        return video

    async def update_video_status(
        self, video_id: uuid.UUID, status: str, progress: int = 0
    ) -> Video:
        """
        Update video processing status.

        Args:
            video_id: Video UUID
            status: New status
            progress: Processing progress (0-100)

        Returns:
            Updated video model
        """
        return await self.video_repository.update_status(
            video_id=video_id, status=status, progress=progress
        )
    async def update_video_analysis(
        self, video_id: uuid.UUID, analysis_result: dict
    ) -> Video:
        """
        Update video with AI analysis results.

        Args:
            video_id: Video UUID
            analysis_result: AI analysis results (may contain raw_results and source_language)

        Returns:
            Updated video model
        """
        summary = analysis_result.get("summary")
        keywords = analysis_result.get("keywords")
        source_language = analysis_result.get("source_language", "ko")

        # Extract raw_results if present
        raw_results = analysis_result.get("raw_results")

        # Update video with analysis results and source_language
        await self.video_repository.update_processing_results(
            video_id=video_id,
            summary=summary,
            keywords=keywords,
            analysis_result=analysis_result,
            raw_results=raw_results,
        )

        # Update source_language separately
        return await self.video_repository.update(
            video_id=video_id,
            update_data={"source_language": source_language}
        )

    async def update_video_transcription(
        self, video_id: uuid.UUID, transcription_result: dict
    ) -> Video:
        """
        Update video with transcription results.

        Args:
            video_id: Video UUID
            transcription_result: Speech-to-text transcription results

        Returns:
            Updated video model
        """
        # Store transcription in analysis_result for now
        # In a more complex system, this might be a separate field
        video = await self.get_video_by_id(video_id)
        current_analysis = video.analysis_result or {}
        current_analysis["transcription"] = transcription_result
        
        return await self.video_repository.update_analysis_result(
            video_id=video_id, analysis_result=current_analysis
        )

    async def update_video_translations(
        self, video_id: uuid.UUID, translated_analysis: dict
    ) -> Video:
        """
        Update video with translation results.

        Args:
            video_id: Video UUID
            translated_analysis: Translated analysis results

        Returns:
            Updated video model
        """
        video = await self.get_video_by_id(video_id)
        current_analysis = video.analysis_result or {}
        current_analysis["translations"] = translated_analysis
        
        return await self.video_repository.update_analysis_result(
            video_id=video_id, analysis_result=current_analysis
        )

    async def get_video_segments(self, video_id: uuid.UUID) -> list:
        """
        Get video segments by video ID.

        Args:
            video_id: Video UUID

        Returns:
            List of video segments
        """
        # This would typically query a segments table
        # For now, return empty list as segments are handled differently
        return []

    async def update_segments_translations(
        self, video_id: uuid.UUID, translated_segments: list[dict]
    ) -> None:
        """
        Update video segments with translations.

        Args:
            video_id: Video UUID
            translated_segments: List of translated segment data
        """
        # This would typically update segments in the database
        # For now, store in video analysis_result
        video = await self.get_video_by_id(video_id)
        current_analysis = video.analysis_result or {}
        current_analysis["translated_segments"] = translated_segments
        
        await self.video_repository.update_analysis_result(
            video_id=video_id, analysis_result=current_analysis
        )

    async def update_video_metadata(
        self, video_id: uuid.UUID, metadata: dict
    ) -> Video:
        """
        Update video with metadata information.

        Args:
            video_id: Video UUID
            metadata: Dictionary containing metadata to update

        Returns:
            Updated Video object

        Raises:
            VideoProcessingException: If video not found or update fails
        """
        try:
            video = await self.get_video_by_id(video_id)
            
            # Update allowed metadata fields
            update_data = {}

            if "gcs_path" in metadata:
                update_data["gcs_path"] = metadata["gcs_path"]

            if "thumbnail_gcs_path" in metadata:
                update_data["thumbnail_gcs_path"] = metadata["thumbnail_gcs_path"]

            if "duration_seconds" in metadata:
                update_data["duration_seconds"] = metadata["duration_seconds"]

            if "file_size_bytes" in metadata:
                update_data["file_size_bytes"] = metadata["file_size_bytes"]

            # Store full metadata in analysis_result
            current_analysis = video.analysis_result or {}
            current_analysis["video_metadata"] = metadata
            update_data["analysis_result"] = current_analysis
            
            # Update video record
            updated_video = await self.video_repository.update(
                video_id=video_id, update_data=update_data
            )
            
            return updated_video

        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to update video metadata: {str(e)}",
                status_code=500,
            )

    async def create_video_for_direct_upload(
        self,
        filename: str,
        file_size: int,
        content_type: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> tuple[Video, str, str]:
        """
        Create video record and generate signed upload URL for direct GCS upload.

        This method creates a video record with PENDING_UPLOAD status and generates
        a signed URL that allows the client to upload directly to GCS, bypassing
        the Cloud Run 32MB request size limit.

        Args:
            filename: Original filename
            file_size: File size in bytes
            content_type: MIME type of the video
            title: Optional video title
            description: Optional video description

        Returns:
            Tuple of (video, upload_url, gcs_path)

        Raises:
            VideoProcessingException: If validation or creation fails
        """
        try:
            normalized_content_type = (content_type or "video/mp4").split(";")[0].strip().lower()

            # Validate file size (2GB limit)
            MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB
            if file_size > MAX_FILE_SIZE:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_FILE_SIZE,
                    f"File size {file_size} bytes exceeds maximum allowed size of {MAX_FILE_SIZE} bytes (2GB)",
                    status_code=400,
                )

            # Validate content type
            ALLOWED_VIDEO_TYPES = [
                "video/mp4",
                "video/quicktime",
                "video/x-msvideo",
                "video/x-ms-wmv",
                "video/x-flv",
                "video/webm",
                "video/x-matroska",
            ]
            if normalized_content_type not in ALLOWED_VIDEO_TYPES:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_FILE_TYPE,
                    f"Invalid video type: {normalized_content_type}. Allowed types: {', '.join(ALLOWED_VIDEO_TYPES)}",
                    status_code=400,
                )

            # Sanitize filename
            original_filename = validate_filename(filename)

            # Generate title if not provided
            if not title:
                title = os.path.splitext(original_filename)[0].replace("_", " ").title()

            # Create video record with PENDING_UPLOAD status
            video_data = VideoCreate(
                title=title,
                description=description,
                source_type="FILE_UPLOAD",
                original_filename=original_filename,
                mime_type=normalized_content_type,
            )

            video = await self.video_repository.create(
                video_data=video_data.model_dump(),
                file_size_bytes=file_size,
            )

            # Update status to PENDING_UPLOAD
            await self.video_repository.update(
                video_id=video.id,
                update_data={"status": "PENDING_UPLOAD"},
            )
            video.status = "PENDING_UPLOAD"

            # Generate signed URL for direct GCS upload
            gcs_service = GCSService()
            upload_url, gcs_path = gcs_service.generate_upload_signed_url(
                video_id=video.id,
                filename=original_filename,
                content_type=normalized_content_type,
                expiration_hours=2,
            )

            logger.info(
                f"Created video {video.id} for direct upload: {gcs_path}",
                extra={"video_id": str(video.id), "file_size": file_size},
            )

            return video, upload_url, gcs_path

        except VideoProcessingException:
            raise
        except Exception as e:
            logger.error(f"Failed to create video for direct upload: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to create video for direct upload: {str(e)}",
                status_code=500,
            )

    async def confirm_upload_and_start_processing(
        self,
        video_id: uuid.UUID,
    ) -> Video:
        """
        Confirm that file has been uploaded to GCS and prepare for processing.

        This method verifies that the file exists in GCS and updates the video
        status from PENDING_UPLOAD to UPLOADED, ready for processing.

        Args:
            video_id: Video UUID

        Returns:
            Updated video record

        Raises:
            VideoProcessingException: If video not found or file not in GCS
        """
        try:
            # Get video record
            video = await self.video_repository.get_by_id(video_id)
            if not video:
                raise VideoProcessingException(
                    ErrorCodes.INVALID_VIDEO_ID,
                    f"Video not found: {video_id}",
                    status_code=404,
                )

            # Check current status
            if video.status != "PENDING_UPLOAD":
                raise VideoProcessingException(
                    ErrorCodes.PROCESSING_FAILED,
                    f"Invalid video status: {video.status}. Expected PENDING_UPLOAD.",
                    status_code=400,
                )

            # Generate expected GCS path
            gcs_service = GCSService()
            gcs_path = gcs_service._generate_gcs_path(video_id, video.original_filename)

            # Verify file exists in GCS
            if not gcs_service.file_exists(gcs_path):
                raise VideoProcessingException(
                    ErrorCodes.PROCESSING_FAILED,
                    "File not found in GCS. Upload may have failed or expired.",
                    status_code=400,
                )

            # Get file metadata from GCS
            file_metadata = gcs_service.get_file_metadata(gcs_path)

            # Update video record with GCS info
            update_data = {
                "status": "UPLOADED",
                "gcs_path": gcs_path,
                "file_size_bytes": file_metadata.get("size_bytes", video.file_size_bytes),
            }

            updated_video = await self.video_repository.update(
                video_id=video_id,
                update_data=update_data,
            )

            logger.info(
                f"Confirmed upload for video {video_id}: {gcs_path}",
                extra={
                    "video_id": str(video_id),
                    "gcs_path": gcs_path,
                    "file_size": file_metadata.get("size_bytes"),
                },
            )

            return updated_video

        except VideoProcessingException:
            raise
        except Exception as e:
            logger.error(f"Failed to confirm upload: {str(e)}")
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to confirm upload: {str(e)}",
                status_code=500,
            )
