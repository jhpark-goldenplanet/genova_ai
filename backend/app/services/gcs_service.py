"""
Google Cloud Storage service for handling file uploads and management.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import aiofiles
from fastapi import UploadFile
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError

from app.core.ai_config import ai_client_manager
from app.core.exceptions import ErrorCodes, StorageException

logger = logging.getLogger(__name__)


class GCSService:
    """Service for Google Cloud Storage operations."""

    def __init__(self, bucket_name: Optional[str] = None):
        """
        Initialize GCS service.

        Args:
            bucket_name: GCS bucket name. If None, uses environment variable.
        """
        self.bucket_name = bucket_name or os.getenv(
            "GCS_BUCKET_NAME", "genova-ai-videos"
        )
        self.project_id = os.getenv("GCP_PROJECT_ID")
        
        # Initialize the client
        try:
            self.client = storage.Client(project=self.project_id)
            self.bucket = self.client.bucket(self.bucket_name)
        except Exception as e:
            raise StorageException(f"Failed to initialize GCS client: {str(e)}")

    def _generate_gcs_path(
        self, 
        video_id: uuid.UUID, 
        filename: str, 
        folder: str = "videos"
    ) -> str:
        """
        Generate organized GCS path for file storage.

        Args:
            video_id: Video UUID
            filename: Original filename
            folder: Storage folder (default: "videos")

        Returns:
            GCS path string
        """
        # Extract file extension
        _, ext = os.path.splitext(filename)
        
        # Create date-based organization
        now = datetime.now(timezone.utc)
        date_path = now.strftime("%Y/%m/%d")
        
        # Generate unique filename with video ID
        unique_filename = f"{video_id}{ext}"
        
        gcs_path = f"{folder}/{date_path}/{unique_filename}"
        logger.debug(f"Generated GCS path: {gcs_path}")
        return gcs_path

    def _generate_thumbnail_path(self, video_id: uuid.UUID) -> str:
        """
        Generate GCS path for video thumbnail.

        Args:
            video_id: Video UUID

        Returns:
            GCS thumbnail path string
        """
        now = datetime.now(timezone.utc)
        date_path = now.strftime("%Y/%m/%d")
        return f"thumbnails/{date_path}/{video_id}.jpg"

    def _generate_segment_path(
        self, 
        video_id: uuid.UUID, 
        segment_no: int, 
        extension: str = ".mp4"
    ) -> str:
        """
        Generate GCS path for video segment.

        Args:
            video_id: Video UUID
            segment_no: Segment number
            extension: File extension

        Returns:
            GCS segment path string
        """
        now = datetime.now(timezone.utc)
        date_path = now.strftime("%Y/%m/%d")
        return f"segments/{date_path}/{video_id}/segment_{segment_no:02d}{extension}"

    async def upload_file(
        self, 
        file: UploadFile, 
        video_id: uuid.UUID,
        content_type: Optional[str] = None
    ) -> Tuple[str, dict]:
        """
        Upload file to Google Cloud Storage.

        Args:
            file: FastAPI UploadFile object
            video_id: Video UUID for path generation
            content_type: Optional content type override

        Returns:
            Tuple of (gcs_path, metadata_dict)

        Raises:
            StorageException: If upload fails
        """
        try:
            # Generate GCS path
            gcs_path = self._generate_gcs_path(video_id, file.filename or "video")
            
            # Create blob
            blob = self.bucket.blob(gcs_path)
            
            # Set content type
            if content_type:
                blob.content_type = content_type
            elif file.content_type:
                blob.content_type = file.content_type
            
            # Set metadata
            metadata = {
                "video_id": str(video_id),
                "original_filename": file.filename or "unknown",
                "upload_timestamp": datetime.now(timezone.utc).isoformat(),
                "file_size": str(file.size) if file.size else "unknown"
            }
            blob.metadata = metadata
            
            # Upload file content
            file_content = await file.read()
            blob.upload_from_string(file_content, content_type=blob.content_type)
            
            # Reset file pointer for potential reuse
            await file.seek(0)
            
            # Extract additional metadata
            file_metadata = {
                "gcs_path": gcs_path,
                "bucket_name": self.bucket_name,
                "blob_name": gcs_path,
                "content_type": blob.content_type,
                "size_bytes": len(file_content),
                "md5_hash": blob.md5_hash,
                "etag": blob.etag,
                "time_created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "generation": blob.generation,
                "metageneration": blob.metageneration,
            }
            
            return gcs_path, file_metadata
            
        except GoogleCloudError as e:
            raise StorageException(f"GCS upload failed: {str(e)}")
        except Exception as e:
            raise StorageException(f"File upload failed: {str(e)}")

    async def upload_from_url(
        self, 
        url: str, 
        video_id: uuid.UUID,
        filename: str,
        content_type: Optional[str] = None
    ) -> Tuple[str, dict]:
        """
        Upload file from URL to Google Cloud Storage.

        Args:
            url: Source URL
            video_id: Video UUID for path generation
            filename: Filename for storage
            content_type: Optional content type

        Returns:
            Tuple of (gcs_path, metadata_dict)

        Raises:
            StorageException: If upload fails
        """
        try:
            import httpx
            
            # Download file from URL
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                file_content = response.content
            
            # Generate GCS path
            gcs_path = self._generate_gcs_path(video_id, filename)
            
            # Create blob
            blob = self.bucket.blob(gcs_path)
            
            # Set content type
            if content_type:
                blob.content_type = content_type
            elif response.headers.get("content-type"):
                blob.content_type = response.headers["content-type"]
            
            # Set metadata
            metadata = {
                "video_id": str(video_id),
                "original_filename": filename,
                "source_url": url,
                "upload_timestamp": datetime.now(timezone.utc).isoformat(),
                "file_size": str(len(file_content))
            }
            blob.metadata = metadata
            
            # Upload file content
            blob.upload_from_string(file_content)
            
            # Extract additional metadata
            file_metadata = {
                "gcs_path": gcs_path,
                "bucket_name": self.bucket_name,
                "blob_name": gcs_path,
                "content_type": blob.content_type,
                "size_bytes": len(file_content),
                "md5_hash": blob.md5_hash,
                "etag": blob.etag,
                "time_created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "generation": blob.generation,
                "metageneration": blob.metageneration,
                "source_url": url,
            }
            
            return gcs_path, file_metadata
            
        except httpx.HTTPError as e:
            raise StorageException(f"Failed to download from URL: {str(e)}")
        except GoogleCloudError as e:
            raise StorageException(f"GCS upload failed: {str(e)}")
        except Exception as e:
            raise StorageException(f"URL upload failed: {str(e)}")

    async def upload_thumbnail(
        self, 
        thumbnail_data: bytes, 
        video_id: uuid.UUID,
        content_type: str = "image/jpeg"
    ) -> Tuple[str, dict]:
        """
        Upload thumbnail image to Google Cloud Storage.

        Args:
            thumbnail_data: Thumbnail image bytes
            video_id: Video UUID for path generation
            content_type: Image content type

        Returns:
            Tuple of (gcs_path, metadata_dict)

        Raises:
            StorageException: If upload fails
        """
        try:
            # Generate GCS path
            gcs_path = self._generate_thumbnail_path(video_id)
            
            # Create blob
            blob = self.bucket.blob(gcs_path)

            # Set metadata
            metadata = {
                "video_id": str(video_id),
                "type": "thumbnail",
                "upload_timestamp": datetime.now(timezone.utc).isoformat(),
                "file_size": str(len(thumbnail_data))
            }
            blob.metadata = metadata

            # Upload thumbnail with explicit content type
            blob.upload_from_string(thumbnail_data, content_type=content_type)
            
            # Extract metadata
            file_metadata = {
                "gcs_path": gcs_path,
                "bucket_name": self.bucket_name,
                "blob_name": gcs_path,
                "content_type": blob.content_type,
                "size_bytes": len(thumbnail_data),
                "md5_hash": blob.md5_hash,
                "etag": blob.etag,
                "time_created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
            }
            
            return gcs_path, file_metadata
            
        except GoogleCloudError as e:
            raise StorageException(f"Thumbnail upload failed: {str(e)}")
        except Exception as e:
            raise StorageException(f"Thumbnail upload failed: {str(e)}")

    async def upload_segment(
        self,
        segment_data: bytes,
        video_id: uuid.UUID,
        segment_no: int,
        content_type: str = "video/mp4"
    ) -> Tuple[str, dict]:
        """
        Upload video segment to Google Cloud Storage.

        Args:
            segment_data: Segment video bytes
            video_id: Video UUID for path generation
            segment_no: Segment number
            content_type: Video content type

        Returns:
            Tuple of (gcs_path, metadata_dict)

        Raises:
            StorageException: If upload fails
        """
        try:
            # Generate GCS path
            gcs_path = self._generate_segment_path(video_id, segment_no)

            # Create blob
            blob = self.bucket.blob(gcs_path)

            # Set metadata
            metadata = {
                "video_id": str(video_id),
                "segment_no": str(segment_no),
                "type": "segment",
                "upload_timestamp": datetime.now(timezone.utc).isoformat(),
                "file_size": str(len(segment_data))
            }
            blob.metadata = metadata

            # Upload segment with explicit content type
            blob.upload_from_string(segment_data, content_type=content_type)
            
            # Extract metadata
            file_metadata = {
                "gcs_path": gcs_path,
                "bucket_name": self.bucket_name,
                "blob_name": gcs_path,
                "content_type": blob.content_type,
                "size_bytes": len(segment_data),
                "md5_hash": blob.md5_hash,
                "etag": blob.etag,
                "time_created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "segment_no": segment_no,
            }
            
            return gcs_path, file_metadata
            
        except GoogleCloudError as e:
            raise StorageException(f"Segment upload failed: {str(e)}")
        except Exception as e:
            raise StorageException(f"Segment upload failed: {str(e)}")

    def generate_signed_url(
        self,
        gcs_path: str,
        expiration_hours: int = 24,
        method: str = "GET"
    ) -> str:
        """
        Generate signed URL for temporary access to GCS object.

        Uses IAM signBlob API for Cloud Run environments where service account
        credentials don't have private keys.

        Args:
            gcs_path: GCS object path
            expiration_hours: URL expiration time in hours
            method: HTTP method (GET, PUT, etc.)

        Returns:
            Signed URL string

        Raises:
            StorageException: If URL generation fails
        """
        try:
            blob = self.bucket.blob(gcs_path)
            expiration = datetime.now(timezone.utc) + timedelta(hours=expiration_hours)

            # Try standard method first (works with service account keys)
            try:
                signed_url = blob.generate_signed_url(
                    expiration=expiration,
                    method=method,
                    version="v4"
                )
                return signed_url
            except Exception as e:
                # Check if this is a credentials error (Cloud Run environment)
                error_msg = str(e).lower()
                if "private key" not in error_msg and "credentials" not in error_msg:
                    raise

                logger.info(f"[GCS_SIGNING] Using IAM Signer for Cloud Run environment")

                # Fall back to IAM Signer for Cloud Run
                import google.auth
                from google.auth import iam
                from google.auth.transport import requests as google_requests
                from google.auth import credentials as auth_credentials

                # Get credentials
                credentials, project = google.auth.default()

                # Get service account email from GCP metadata server
                try:
                    import requests as sync_requests
                    metadata_url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email"
                    headers = {"Metadata-Flavor": "Google"}
                    response = sync_requests.get(metadata_url, headers=headers, timeout=5)
                    response.raise_for_status()
                    service_account_email = response.text.strip()
                    logger.info(f"[GCS_SIGNING] Retrieved service account from metadata: {service_account_email}")
                except Exception as meta_err:
                    logger.error(f"[GCS_SIGNING] Failed to get SA from metadata: {str(meta_err)}")
                    raise StorageException("Unable to determine service account email for signing")

                logger.info(f"[GCS_SIGNING] Using service account: {service_account_email}")

                # Create IAM Signer
                if not credentials.valid:
                    credentials.refresh(google_requests.Request())

                signer = iam.Signer(
                    request=google_requests.Request(),
                    credentials=credentials,
                    service_account_email=service_account_email
                )

                # Create signing credentials that implement both Signing and Credentials
                class SigningCredentials(auth_credentials.Signing, auth_credentials.Credentials):
                    """Credentials that use IAM Signer for signing operations."""

                    def __init__(self, signer_instance, sa_email):
                        super().__init__()
                        self._signer = signer_instance
                        self._service_account_email = sa_email

                    @property
                    def service_account_email(self):
                        """Return the service account email."""
                        return self._service_account_email

                    @property
                    def signer_email(self):
                        """Return the signer email (required by Signing interface)."""
                        return self._service_account_email

                    @property
                    def signer(self):
                        """Return the signer instance (required by Signing interface)."""
                        return self._signer

                    def sign_bytes(self, message):
                        """Sign bytes using IAM Signer."""
                        return self._signer.sign(message)

                    def refresh(self, request):
                        """Refresh credentials (not needed for signing)."""
                        pass

                signing_creds = SigningCredentials(signer, service_account_email)

                # Generate signed URL using signing credentials
                signed_url = blob.generate_signed_url(
                    expiration=expiration,
                    method=method,
                    version="v4",
                    credentials=signing_creds
                )

                logger.info(f"[GCS_SIGNING] Successfully generated signed URL using IAM Signer")
                return signed_url

        except GoogleCloudError as e:
            logger.error(f"[GCS_SIGNING] GCS error: {str(e)}", exc_info=True)
            raise StorageException(f"Failed to generate signed URL: {str(e)}")
        except Exception as e:
            logger.error(f"[GCS_SIGNING] URL generation error: {str(e)}", exc_info=True)
            raise StorageException(f"URL generation failed: {str(e)}")

    def get_file_metadata(self, gcs_path: str) -> dict:
        """
        Get metadata for a file in GCS.

        Args:
            gcs_path: GCS object path

        Returns:
            File metadata dictionary

        Raises:
            StorageException: If metadata retrieval fails
        """
        try:
            blob = self.bucket.blob(gcs_path)
            blob.reload()
            
            metadata = {
                "gcs_path": gcs_path,
                "bucket_name": self.bucket_name,
                "blob_name": gcs_path,
                "content_type": blob.content_type,
                "size_bytes": blob.size,
                "md5_hash": blob.md5_hash,
                "etag": blob.etag,
                "time_created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "generation": blob.generation,
                "metageneration": blob.metageneration,
                "custom_metadata": blob.metadata or {},
            }
            
            return metadata
            
        except GoogleCloudError as e:
            raise StorageException(f"Failed to get file metadata: {str(e)}")
        except Exception as e:
            raise StorageException(f"Metadata retrieval failed: {str(e)}")

    def delete_file(self, gcs_path: str) -> bool:
        """
        Delete file from GCS.

        Args:
            gcs_path: GCS object path

        Returns:
            True if deletion successful

        Raises:
            StorageException: If deletion fails
        """
        try:
            blob = self.bucket.blob(gcs_path)
            blob.delete()
            return True
            
        except GoogleCloudError as e:
            raise StorageException(f"Failed to delete file: {str(e)}")
        except Exception as e:
            raise StorageException(f"File deletion failed: {str(e)}")

    def file_exists(self, gcs_path: str) -> bool:
        """
        Check if file exists in GCS.

        Args:
            gcs_path: GCS object path

        Returns:
            True if file exists
        """
        try:
            blob = self.bucket.blob(gcs_path)
            return blob.exists()
        except Exception:
            return False

    def generate_upload_signed_url(
        self,
        video_id: uuid.UUID,
        filename: str,
        content_type: str = "video/mp4",
        expiration_hours: int = 2
    ) -> Tuple[str, str]:
        """
        Generate signed URL for direct GCS upload (PUT method).

        This allows clients to upload files directly to GCS without going through
        the backend server, bypassing Cloud Run's 32MB request size limit.

        Args:
            video_id: Video UUID for path generation
            filename: Original filename
            content_type: MIME type for the video file
            expiration_hours: URL expiration time in hours (default: 2)

        Returns:
            Tuple of (signed_url, gcs_path)

        Raises:
            StorageException: If URL generation fails
        """
        try:
            # Generate GCS path for the video
            gcs_path = self._generate_gcs_path(video_id, filename)

            # Generate signed URL with PUT method for upload
            signed_url = self.generate_signed_url(
                gcs_path=gcs_path,
                expiration_hours=expiration_hours,
                method="PUT"
            )

            logger.info(f"Generated upload signed URL for video {video_id}: {gcs_path}")
            return signed_url, gcs_path

        except Exception as e:
            logger.error(f"Failed to generate upload signed URL: {str(e)}")
            raise StorageException(f"Failed to generate upload URL: {str(e)}")

    async def download_to_temp(self, gcs_path: str, temp_dir: str) -> str:
        """
        Download file from GCS to a temporary local file.

        Args:
            gcs_path: GCS object path
            temp_dir: Directory for temporary file

        Returns:
            Path to downloaded temporary file

        Raises:
            StorageException: If download fails
        """
        try:
            blob = self.bucket.blob(gcs_path)

            # Extract filename from gcs_path
            filename = os.path.basename(gcs_path)
            temp_file_path = os.path.join(temp_dir, filename)

            # Download to temporary file
            logger.info(f"Downloading {gcs_path} to {temp_file_path}")
            blob.download_to_filename(temp_file_path)

            logger.info(f"Successfully downloaded {gcs_path} ({blob.size} bytes)")
            return temp_file_path

        except GoogleCloudError as e:
            logger.error(f"GCS download failed: {str(e)}")
            raise StorageException(f"Failed to download from GCS: {str(e)}")
        except Exception as e:
            logger.error(f"Download failed: {str(e)}")
            raise StorageException(f"Download failed: {str(e)}")

    def list_files(self, prefix: str = "", max_results: int = 100) -> list[dict]:
        """
        List files in GCS bucket with optional prefix filter.

        Args:
            prefix: Path prefix to filter results
            max_results: Maximum number of results to return

        Returns:
            List of file metadata dictionaries

        Raises:
            StorageException: If listing fails
        """
        try:
            blobs = self.client.list_blobs(
                self.bucket_name, 
                prefix=prefix, 
                max_results=max_results
            )
            
            files = []
            for blob in blobs:
                file_info = {
                    "gcs_path": blob.name,
                    "bucket_name": self.bucket_name,
                    "content_type": blob.content_type,
                    "size_bytes": blob.size,
                    "time_created": blob.time_created.isoformat() if blob.time_created else None,
                    "updated": blob.updated.isoformat() if blob.updated else None,
                    "custom_metadata": blob.metadata or {},
                }
                files.append(file_info)
            
            return files
            
        except GoogleCloudError as e:
            raise StorageException(f"Failed to list files: {str(e)}")
        except Exception as e:
            raise StorageException(f"File listing failed: {str(e)}")


    async def download_video_for_processing(
        self, gcs_path: str, video_id: uuid.UUID
    ) -> str:
        """
        Download video from GCS to local temporary file for processing.

        Args:
            gcs_path: GCS path to the video file
            video_id: Video UUID for temporary file naming

        Returns:
            Local file path to downloaded video

        Raises:
            StorageException: If download fails
        """
        try:
            import tempfile
            import os
            import asyncio

            # Create temporary file
            temp_dir = tempfile.gettempdir()
            temp_filename = f"video_{video_id}.mp4"
            local_path = os.path.join(temp_dir, temp_filename)

            # Get blob
            blob = self.bucket.blob(gcs_path)

            if not await asyncio.to_thread(blob.exists):
                raise StorageException(f"Video file not found in GCS: {gcs_path}")

            # Download to local file
            await asyncio.to_thread(blob.download_to_filename, local_path)

            return local_path

        except GoogleCloudError as e:
            raise StorageException(f"Video download failed: {str(e)}")
        except Exception as e:
            raise StorageException(f"Video download failed: {str(e)}")

    async def delete_local_temp_file(self, local_path: str) -> bool:
        """
        Delete temporary local file after processing.

        Args:
            local_path: Local file path to delete

        Returns:
            True if deletion successful, False otherwise
        """
        try:
            import os

            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"Deleted temporary file: {local_path}")
                return True
            else:
                logger.warning(f"Temporary file not found: {local_path}")
                return False

        except Exception as e:
            logger.error(f"Failed to delete temporary file {local_path}: {str(e)}")
            return False

    async def delete_file(self, gcs_path: str) -> bool:
        """
        Delete file from GCS.

        Args:
            gcs_path: GCS path to the file

        Returns:
            True if deleted successfully, False if file not found

        Raises:
            StorageException: If deletion fails
        """
        try:
            blob = self.bucket.blob(gcs_path)
            
            if not blob.exists():
                return False
            
            blob.delete()
            return True
            
        except GoogleCloudError as e:
            raise StorageException(f"File deletion failed: {str(e)}")
        except Exception as e:
            raise StorageException(f"File deletion failed: {str(e)}")
# Global GCS service instance
gcs_service = GCSService()