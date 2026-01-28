"""
Enhanced video upload service with Google Cloud Storage integration.
"""

import uuid
from typing import Optional, Tuple

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ErrorCodes, StorageException, VideoProcessingException
from app.core.gcs_config import get_gcs_settings
from app.core.validation import validate_video_file, validate_video_url
from app.repositories.gcs_repository import GCSRepository
from app.repositories.video_repository import VideoRepository
from app.schemas.video import VideoCreate, VideoResponse
from app.services.gcs_service import GCSService


class VideoUploadService:
    """Enhanced video upload service with GCS integration."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.video_repository = VideoRepository(session)
        self.gcs_repository = GCSRepository(session)
        self.gcs_service = GCSService()
        self.gcs_settings = get_gcs_settings()

    async def upload_video_file(
        self,
        file: UploadFile,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[VideoResponse, str]:
        """
        Upload video file to GCS and create database record.

        Args:
            file: Uploaded video file
            title: Optional video title
            description: Optional video description

        Returns:
            Tuple of (VideoResponse, gcs_path)

        Raises:
            VideoProcessingException: If validation or upload fails
        """
        try:
            # Validate the uploaded file
            mime_type, file_size, duration = await validate_video_file(file)

            # Create video record first
            video_data = VideoCreate(
                title=title or self._generate_title_from_filename(file.filename),
                description=description,
                source_type="FILE_UPLOAD",
                original_filename=file.filename or "unknown_video",
                mime_type=mime_type,
            )

            video = await self.video_repository.create(
                video_data=video_data.model_dump(),
                duration_seconds=duration,
                file_size_bytes=file_size,
            )

            # Upload to GCS
            try:
                gcs_path, file_metadata = await self.gcs_service.upload_file(
                    file=file,
                    video_id=video.id,
                    content_type=mime_type
                )

                # Update video record with GCS path and metadata
                await self.gcs_repository.update_video_gcs_path(
                    video_id=video.id,
                    gcs_path=gcs_path,
                    file_metadata=file_metadata
                )

                # Update file metadata if extracted during upload
                if file_metadata.get("size_bytes"):
                    await self.gcs_repository.update_video_file_metadata(
                        video_id=video.id,
                        file_size_bytes=file_metadata["size_bytes"],
                        duration_seconds=duration,
                        mime_type=mime_type
                    )

                response = VideoResponse.from_video(
                    video,
                    message="Video uploaded successfully to cloud storage. Processing will begin shortly."
                )

                return response, gcs_path

            except StorageException as e:
                # If GCS upload fails, we should clean up the database record
                await self.video_repository.delete(video.id)
                raise VideoProcessingException(
                    ErrorCodes.UPLOAD_FAILED,
                    f"Failed to upload video to cloud storage: {str(e)}",
                    status_code=500,
                )

        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to upload video: {str(e)}",
                status_code=500,
            )

    async def upload_video_from_url(
        self,
        url: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[VideoResponse, str]:
        """
        Download video from URL and upload to GCS.
        Supports both direct video file URLs and YouTube URLs.

        Args:
            url: Video URL to download (supports YouTube)
            title: Optional video title
            description: Optional video description

        Returns:
            Tuple of (VideoResponse, gcs_path)

        Raises:
            VideoProcessingException: If validation or upload fails
        """
        try:
            # Validate URL (returns is_youtube flag)
            validated_url, content_type, is_youtube = await validate_video_url(url)

            # Handle YouTube URLs differently
            if is_youtube:
                return await self._upload_from_youtube(
                    validated_url, title, description
                )

            # Original logic for direct video file URLs
            validated_url, content_type = validated_url, content_type

            # Generate filename from URL
            filename = self._generate_filename_from_url(validated_url, content_type)

            # Create video record first
            video_data = VideoCreate(
                title=title or self._generate_title_from_filename(filename),
                description=description,
                source_type="URL_UPLOAD",
                original_filename=filename,
                mime_type=content_type,
            )

            video = await self.video_repository.create(
                video_data=video_data.model_dump(),
                source_url=validated_url
            )

            # Upload from URL to GCS
            try:
                gcs_path, file_metadata = await self.gcs_service.upload_from_url(
                    url=validated_url,
                    video_id=video.id,
                    filename=filename,
                    content_type=content_type
                )

                # Update video record with GCS path and metadata
                await self.gcs_repository.update_video_gcs_path(
                    video_id=video.id,
                    gcs_path=gcs_path,
                    file_metadata=file_metadata
                )

                # Update file metadata
                if file_metadata.get("size_bytes"):
                    await self.gcs_repository.update_video_file_metadata(
                        video_id=video.id,
                        file_size_bytes=file_metadata["size_bytes"],
                        mime_type=content_type
                    )

                response = VideoResponse.from_video(
                    video,
                    message="Video downloaded and uploaded successfully to cloud storage. Processing will begin shortly."
                )

                return response, gcs_path

            except StorageException as e:
                # If GCS upload fails, clean up the database record
                await self.video_repository.delete(video.id)
                raise VideoProcessingException(
                    ErrorCodes.UPLOAD_FAILED,
                    f"Failed to upload video to cloud storage: {str(e)}",
                    status_code=500,
                )

        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to upload video from URL: {str(e)}",
                status_code=500,
            )

    async def get_video_download_url(
        self,
        video_id: uuid.UUID,
        expiration_hours: int = 24
    ) -> str:
        """
        Generate signed URL for video download.

        Args:
            video_id: Video UUID
            expiration_hours: URL expiration time in hours

        Returns:
            Signed download URL

        Raises:
            VideoProcessingException: If video not found or URL generation fails
        """
        try:
            # Get video GCS path
            gcs_path = await self.gcs_repository.get_video_gcs_path(video_id)
            if not gcs_path:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_NOT_FOUND,
                    f"Video {video_id} not found in cloud storage",
                    status_code=404,
                )

            # Generate signed URL
            signed_url = self.gcs_service.generate_signed_url(
                gcs_path=gcs_path,
                expiration_hours=expiration_hours,
                method="GET"
            )

            return signed_url

        except StorageException as e:
            raise VideoProcessingException(
                ErrorCodes.STORAGE_ERROR,
                f"Failed to generate download URL: {str(e)}",
                status_code=500,
            )
        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to get download URL: {str(e)}",
                status_code=500,
            )

    async def upload_thumbnail(
        self,
        video_id: uuid.UUID,
        thumbnail_data: bytes,
        content_type: str = "image/jpeg"
    ) -> str:
        """
        Upload thumbnail for video.

        Args:
            video_id: Video UUID
            thumbnail_data: Thumbnail image bytes
            content_type: Image content type

        Returns:
            GCS path of uploaded thumbnail

        Raises:
            VideoProcessingException: If upload fails
        """
        try:
            # Verify video exists
            video = await self.gcs_repository.get_video_by_id(video_id)
            if not video:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_NOT_FOUND,
                    f"Video {video_id} not found",
                    status_code=404,
                )

            # Upload thumbnail to GCS
            gcs_path, metadata = await self.gcs_service.upload_thumbnail(
                thumbnail_data=thumbnail_data,
                video_id=video_id,
                content_type=content_type
            )

            return gcs_path

        except StorageException as e:
            raise VideoProcessingException(
                ErrorCodes.UPLOAD_FAILED,
                f"Failed to upload thumbnail: {str(e)}",
                status_code=500,
            )
        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to upload thumbnail: {str(e)}",
                status_code=500,
            )

    async def upload_video_segment(
        self,
        video_id: uuid.UUID,
        segment_no: int,
        segment_data: bytes,
        content_type: str = "video/mp4"
    ) -> str:
        """
        Upload video segment.

        Args:
            video_id: Video UUID
            segment_no: Segment number
            segment_data: Segment video bytes
            content_type: Video content type

        Returns:
            GCS path of uploaded segment

        Raises:
            VideoProcessingException: If upload fails
        """
        try:
            # Verify video exists
            video = await self.gcs_repository.get_video_by_id(video_id)
            if not video:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_NOT_FOUND,
                    f"Video {video_id} not found",
                    status_code=404,
                )

            # Upload segment to GCS
            gcs_path, metadata = await self.gcs_service.upload_segment(
                segment_data=segment_data,
                video_id=video_id,
                segment_no=segment_no,
                content_type=content_type
            )

            return gcs_path

        except StorageException as e:
            raise VideoProcessingException(
                ErrorCodes.UPLOAD_FAILED,
                f"Failed to upload video segment: {str(e)}",
                status_code=500,
            )
        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to upload video segment: {str(e)}",
                status_code=500,
            )

    async def get_video_file_metadata(self, video_id: uuid.UUID) -> dict:
        """
        Get file metadata for video from GCS.

        Args:
            video_id: Video UUID

        Returns:
            File metadata dictionary

        Raises:
            VideoProcessingException: If video not found or metadata retrieval fails
        """
        try:
            # Get video GCS path
            gcs_path = await self.gcs_repository.get_video_gcs_path(video_id)
            if not gcs_path:
                raise VideoProcessingException(
                    ErrorCodes.VIDEO_NOT_FOUND,
                    f"Video {video_id} not found in cloud storage",
                    status_code=404,
                )

            # Get file metadata from GCS
            metadata = self.gcs_service.get_file_metadata(gcs_path)
            return metadata

        except StorageException as e:
            raise VideoProcessingException(
                ErrorCodes.STORAGE_ERROR,
                f"Failed to get file metadata: {str(e)}",
                status_code=500,
            )
        except VideoProcessingException:
            raise
        except Exception as e:
            raise VideoProcessingException(
                ErrorCodes.SERVER_ERROR,
                f"Failed to get file metadata: {str(e)}",
                status_code=500,
            )

    def _generate_title_from_filename(self, filename: Optional[str]) -> str:
        """Generate title from filename."""
        if not filename:
            return "Untitled Video"
        
        import os
        base_name = os.path.splitext(filename)[0]
        return base_name.replace("_", " ").replace("-", " ").title()

    async def _upload_from_youtube(
        self,
        url: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[VideoResponse, str]:
        """
        Download video from YouTube and upload to GCS.

        Args:
            url: YouTube video URL
            title: Optional video title override
            description: Optional video description override

        Returns:
            Tuple of (VideoResponse, gcs_path)

        Raises:
            VideoProcessingException: If download or upload fails
        """
        import logging
        from app.services.youtube_download_service import youtube_download_service

        logger = logging.getLogger(__name__)

        # Get YouTube video metadata first
        logger.info(f"Fetching YouTube video metadata: {url}")
        video_metadata = await youtube_download_service.get_video_info(url)

        # Use YouTube metadata if title/description not provided
        final_title = title or video_metadata.get("title", "YouTube Video")
        final_description = description or video_metadata.get("description", "")

        # Create video record first
        video_data = VideoCreate(
            title=final_title,
            description=final_description,
            source_type="URL_UPLOAD",
            original_filename=f"{video_metadata['id']}.mp4",
            mime_type="video/mp4",
        )

        video = await self.video_repository.create(
            video_data=video_data.model_dump(),
            source_url=url,
            duration_seconds=video_metadata.get("duration"),
        )

        temp_file_path = None
        try:
            # Download YouTube video to temporary file
            logger.info(f"Downloading YouTube video {video_metadata['id']} for video {video.id}")
            temp_file_path, download_metadata = await youtube_download_service.download_video(url)

            # Upload to GCS
            logger.info(f"Uploading YouTube video {video.id} to GCS")

            # Read the downloaded file
            import aiofiles
            async with aiofiles.open(temp_file_path, "rb") as f:
                file_content = await f.read()

            # Upload to GCS using existing service
            from fastapi import UploadFile
            from io import BytesIO

            # Create a fake UploadFile object for GCS service
            fake_file = UploadFile(
                filename=download_metadata["downloaded_file_path"].split("/")[-1],
                file=BytesIO(file_content),
            )

            gcs_path, file_metadata = await self.gcs_service.upload_file(
                file=fake_file,
                video_id=video.id,
                content_type="video/mp4"
            )

            # Update video record with GCS path and metadata
            await self.gcs_repository.update_video_gcs_path(
                video_id=video.id,
                gcs_path=gcs_path,
                file_metadata=file_metadata
            )

            # Update file metadata
            await self.gcs_repository.update_video_file_metadata(
                video_id=video.id,
                file_size_bytes=download_metadata["downloaded_file_size"],
                duration_seconds=video_metadata["duration"],
                mime_type="video/mp4"
            )

            # Upload thumbnail if available
            if video_metadata.get("thumbnail"):
                try:
                    import aiohttp
                    async with aiohttp.ClientSession() as session:
                        async with session.get(video_metadata["thumbnail"]) as resp:
                            if resp.status == 200:
                                thumbnail_data = await resp.read()
                                thumbnail_gcs_path = await self.gcs_service.upload_thumbnail(
                                    thumbnail_data=thumbnail_data,
                                    video_id=video.id,
                                    content_type="image/jpeg"
                                )
                                logger.info(f"Uploaded YouTube thumbnail for video {video.id}")
                except Exception as thumb_err:
                    logger.warning(f"Failed to upload YouTube thumbnail: {str(thumb_err)}")

            response = VideoResponse.from_video(
                video,
                message=f"YouTube video '{video_metadata['title']}' downloaded and uploaded successfully to cloud storage. Processing will begin shortly."
            )

            return response, gcs_path

        except Exception as e:
            # If upload fails, clean up database record
            await self.video_repository.delete(video.id)
            logger.error(f"Failed to upload YouTube video: {str(e)}", exc_info=True)
            raise VideoProcessingException(
                ErrorCodes.UPLOAD_FAILED,
                f"Failed to upload YouTube video to cloud storage: {str(e)}",
                status_code=500,
            )
        finally:
            # Always clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    # Also try to remove parent directory if it's a temp directory
                    parent_dir = os.path.dirname(temp_file_path)
                    if parent_dir and os.path.exists(parent_dir) and "youtube_download_" in parent_dir:
                        import shutil
                        shutil.rmtree(parent_dir, ignore_errors=True)
                except OSError:
                    pass

    def _generate_filename_from_url(self, url: str, content_type: str) -> str:
        """Generate filename from URL and content type."""
        from urllib.parse import urlparse
        import os

        parsed_url = urlparse(url)
        filename = os.path.basename(parsed_url.path) or "video_from_url"

        # Ensure filename has proper extension
        if not os.path.splitext(filename)[1]:
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
            filename += extension

        return filename