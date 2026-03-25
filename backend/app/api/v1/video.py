"""
Video API endpoints for upload and processing.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_api_key
from app.core.database import get_db_session
from app.core.exceptions import VideoProcessingException
from app.schemas.video import (
    AnalyzeResponse,
    ConfirmUploadRequest,
    ErrorResponse,
    GetUploadUrlRequest,
    GetUploadUrlResponse,
    ReanalyzeRequest,
    ReanalyzeResponse,
    SegmentResponse,
    SplitDownloadRequest,
    SplitDownloadResponse,
    VideoListItem,
    VideoListResponse,
    VideoResponse,
    VideoStatusResponse,
)
from app.services.video_processing_pipeline import video_processing_pipeline
from app.services.video_service import VideoService
from app.services.video_splitting_service import video_splitting_service
from app.services.video_status_service import video_status_service

router = APIRouter(prefix="/video", tags=["video"])


class VideoUploadByLinkRequest(BaseModel):
    """Request schema for video upload by URL."""

    url: HttpUrl
    title: Optional[str] = None
    description: Optional[str] = None


@router.get("/list", response_model=VideoListResponse, dependencies=[Depends(verify_api_key)])
async def list_videos(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
) -> VideoListResponse:
    """
    Get list of all videos with metadata.

    **Query Parameters:**
    - limit: Max number of videos (default 50, max 100)
    - offset: Pagination offset (default 0)
    - status: Filter by status (PENDING, IN_PROGRESS, COMPLETE, FAILED)

    **Response includes:**
    - Video metadata (title, status, duration, file size, etc.)
    - Segment count per video
    - Thumbnail URL (signed, 1-hour expiry)
    """
    try:
        from app.repositories.video_repository import VideoRepository
        from app.repositories.segment_repository import SegmentRepository
        from app.services.gcs_service import gcs_service

        limit = min(limit, 100)
        video_repo = VideoRepository(session)
        segment_repo = SegmentRepository(session)

        videos = await video_repo.list_videos(limit=limit, offset=offset, status=status)

        # Get total count
        from sqlalchemy import select, func
        from app.models.video import Video
        count_stmt = select(func.count(Video.id))
        if status:
            count_stmt = count_stmt.where(Video.status == status)
        total_result = await session.execute(count_stmt)
        total = total_result.scalar() or 0

        items = []
        for video in videos:
            # Get segment count
            seg_count = await segment_repo.count_segments_by_video_id(video.id)

            # Generate thumbnail URL if available
            thumbnail_url = None
            if video.thumbnail_gcs_path:
                try:
                    thumbnail_url = gcs_service.generate_signed_url(
                        video.thumbnail_gcs_path, expiration_hours=1
                    )
                except Exception:
                    pass

            items.append(VideoListItem(
                id=video.id,
                title=video.title,
                description=video.description,
                source_type=video.source_type,
                status=video.status,
                processing_progress=video.processing_progress,
                duration_seconds=video.duration_seconds,
                file_size_bytes=video.file_size_bytes,
                original_filename=video.original_filename,
                source_language=video.source_language,
                thumbnail_url=thumbnail_url,
                segments_count=seg_count,
                created_at=video.created_at,
                updated_at=video.updated_at,
            ))

        return VideoListResponse(
            videos=items,
            total=total,
            limit=limit,
            offset=offset,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Failed to list videos: {str(e)}",
                "timestamp": datetime.utcnow().isoformat(),
            },
        )


@router.post("/getUploadUrl", response_model=GetUploadUrlResponse, dependencies=[Depends(verify_api_key)])
async def get_upload_url(
    request: GetUploadUrlRequest,
    session: AsyncSession = Depends(get_db_session),
) -> GetUploadUrlResponse:
    """
    Get signed URL for direct GCS upload (bypasses Cloud Run 32MB limit).

    This endpoint generates a temporary signed URL that allows clients to upload
    large video files directly to Google Cloud Storage, bypassing the Cloud Run
    32MB request size limit.

    **Upload flow:**
    1. Call this endpoint with file metadata → receive signed URL
    2. Upload file directly to GCS using PUT request to the signed URL
    3. Call /confirmUpload to verify upload and start processing

    **Supported formats:**
    - MP4, MOV, AVI, WMV, FLV, WebM, MKV
    - Maximum file size: 2GB

    **Example:**
    ```python
    # Step 1: Get upload URL
    response = requests.post("/v1/video/getUploadUrl", json={
        "filename": "my_video.mp4",
        "file_size": 500000000,  # 500MB
        "content_type": "video/mp4",
        "title": "My Video"
    })
    upload_url = response.json()["upload_url"]
    video_id = response.json()["video_id"]

    # Step 2: Upload file to GCS
    with open("my_video.mp4", "rb") as f:
        requests.put(upload_url, data=f, headers={"Content-Type": "video/mp4"})

    # Step 3: Confirm upload
    requests.post("/v1/video/confirmUpload", json={"video_id": video_id})
    ```
    """
    try:
        from datetime import timedelta

        video_service = VideoService(session)

        # Create video record and generate signed URL
        video, upload_url, gcs_path = await video_service.create_video_for_direct_upload(
            filename=request.filename,
            file_size=request.file_size,
            content_type=request.content_type,
            title=request.title,
            description=request.description,
        )

        # Calculate expiration time (2 hours from now)
        from datetime import datetime, timezone
        expires_at = datetime.now(timezone.utc) + timedelta(hours=2)

        return GetUploadUrlResponse(
            video_id=video.id,
            upload_url=upload_url,
            gcs_path=gcs_path,
            expires_at=expires_at,
        )

    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to generate upload URL: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Failed to generate upload URL: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


@router.post("/confirmUpload", response_model=VideoResponse, dependencies=[Depends(verify_api_key)])
async def confirm_upload(
    request: ConfirmUploadRequest,
    session: AsyncSession = Depends(get_db_session),
) -> VideoResponse:
    """
    Confirm GCS upload and start video processing.

    After uploading the file to GCS using the signed URL from /getUploadUrl,
    call this endpoint to verify the upload and start the processing pipeline.

    **Steps:**
    1. File must be uploaded to GCS first (via signed URL from /getUploadUrl)
    2. Call this endpoint with the video_id
    3. Backend verifies file exists in GCS
    4. Processing pipeline starts

    **Processing pipeline:**
    - Download from GCS to Cloud Run temporary storage
    - Extract video metadata
    - AI analysis and summarization
    - Speech-to-text transcription
    - Video segmentation
    - Finalization

    Use the GET /{video_id}/status endpoint to check processing progress.
    """
    try:
        import logging
        logger = logging.getLogger(__name__)

        video_service = VideoService(session)

        # Confirm upload and update video record
        video = await video_service.confirm_upload_and_start_processing(
            video_id=request.video_id,
        )

        logger.info(
            f"Confirmed upload for video {request.video_id}, starting processing",
            extra={"video_id": str(request.video_id), "gcs_path": video.gcs_path}
        )

        # Create first analysis record (analysis_no=1)
        from app.repositories.analysis_repository import AnalysisRepository
        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.create(
            video_id=video.id,
            analysis_no=1,
            title="Analysis 1",
            option=request.option or "B",
            mode=request.mode or "AUTO",
            split_count=request.split_count or 0,
            prompt_tags=request.prompt_tags,
            source_language=request.language or "ko",
        )
        await session.commit()

        split_count = request.split_count if request.split_count and request.split_count > 0 else None

        # Start background processing pipeline
        await video_processing_pipeline.start_processing_from_gcs(
            video_id=video.id,
            gcs_path=video.gcs_path,
            language=request.language,
            split_count=split_count,
            analysis_id=analysis.id,
        )

        return VideoResponse.from_video(
            video,
            message="Upload confirmed. Processing started.",
        )

    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        import logging
        from datetime import datetime, timezone
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to confirm upload: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Failed to confirm upload: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


@router.post("/uploadByLink", response_model=VideoResponse, dependencies=[Depends(verify_api_key)])
async def upload_by_link(
    background_tasks: BackgroundTasks,
    request: VideoUploadByLinkRequest,
    session: AsyncSession = Depends(get_db_session),
) -> VideoResponse:
    """
    Upload video from URL for processing.

    This endpoint accepts URLs pointing to video files in supported formats:
    - MP4, MOV, AVI, WMV, FLV, WebM, MKV
    - Maximum file size: 2GB
    - Minimum duration: 1 minute

    The URL will be validated and the video will be downloaded and processed in the background.
    Use the returned video_id to check processing status.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        video_service = VideoService(session)

        # Log the incoming URL for debugging
        url_str = str(request.url)
        logger.info(f"[URL_DEBUG] API received URL: {url_str} (type={type(request.url).__name__}, str_type={type(url_str).__name__})")

        # Create video record and validate URL
        response = await video_service.create_video_from_url(
            url=url_str, title=request.title, description=request.description
        )

        logger.info(f"[URL_DEBUG] Created video {response.video_id}, passing URL to pipeline: {url_str}")

        # Start background processing pipeline
        await video_processing_pipeline.start_processing_from_url(
            response.video_id, url_str
        )

        return response

    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Internal server error: {str(e)}",
                "timestamp": "2024-01-01T00:00:00Z",
            },
        )

@router.get("/processing/status")
async def get_processing_overview():
    """
    Get overview of all active video processing tasks.

    Returns information about currently running background tasks
    and overall pipeline health.
    """
    try:
        # Get pipeline health
        health = await video_processing_pipeline.get_pipeline_health()

        # Get active processing videos
        active_videos = await video_processing_pipeline.get_active_processing_videos()

        return {
            "pipeline_health": health,
            "active_processing_count": len(active_videos),
            "active_video_ids": active_videos,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Internal server error: {str(e)}",
                "timestamp": "2024-01-01T00:00:00Z",
            },
        )


@router.get("/{video_id}/status", response_model=VideoStatusResponse)
async def get_video_status(
    video_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)
) -> VideoStatusResponse:
    """
    Get video processing status.

    Returns the current processing status, progress, and step information
    for the specified video. When processing is complete, includes segment data.

    **Status Values:**
    - PENDING: Video uploaded, processing not started
    - IN_PROGRESS: Video is being processed
    - COMPLETE: Processing finished successfully
    - FAILED: Processing failed with error
    - CANCELED: Processing was canceled
    - INVALID_VIDEO_ID: Video ID not found

    **Step Values (when IN_PROGRESS):**
    - UPLOADING: File upload in progress
    - UPLOADING_TO_GCS: Uploading to Google Cloud Storage
    - SUMMARIZATION: AI analysis and summary generation
    - TRANSCRIBE: Speech-to-text transcription
    - FINALIZING: Final processing steps

    **Error Codes:**
    - 0: No error (success)
    - 1004: Video not found
    - 1400: Internal server error
    """
    try:
        video_service = VideoService(session)

        # Verify video exists and get basic info
        video = await video_service.get_video_by_id(video_id)

        # Get real-time status from Redis (priority over database)
        redis_status = await video_status_service.get_status(video_id)

        if redis_status:
            status = redis_status.get("status", video.status)
            progress = redis_status.get("progress", video.processing_progress)
            step = redis_status.get("step")
            error_message = redis_status.get("error_message")
            redis_error_code = redis_status.get("error_code")
            redis_http_status = redis_status.get("http_status")
        else:
            # Fallback to database status
            status = video.status
            progress = video.processing_progress
            step = None
            error_message = None
            redis_error_code = None
            redis_http_status = None

        # Include segments if processing is complete
        segments = []
        if status == "COMPLETE":
            from app.repositories.segment_repository import SegmentRepository
            segment_repo = SegmentRepository(session)
            segment_objects = await segment_repo.get_segments_by_video_id(video_id)

            # Convert segments to response format (original content only)
            # Translation is now handled separately via /analyze endpoint with language parameter
            for segment in segment_objects:
                segment_data = {
                    "start_time": segment.start_time,
                    "end_time": segment.end_time,
                    "title": segment.title,
                    "summary": segment.summary or "",
                    "keywords": segment.keywords or [],
                    "scripts": segment.scripts or "",
                }
                segments.append(segment_data)

        # Determine response code and message based on status
        if status == "FAILED":
            # Use error_code and http_status from Redis if available, otherwise use defaults
            code = redis_http_status if redis_http_status is not None else 500
            error_code = redis_error_code if redis_error_code is not None else 1005  # PROCESSING_FAILED
            message = error_message or "Video processing failed"
        elif status == "INVALID_VIDEO_ID":
            code = 404
            error_code = 1004
            message = "Video not found"
        elif status == "CANCELED":
            code = 200
            error_code = 0
            message = "Video processing was canceled"
        elif status == "COMPLETE":
            code = 200
            error_code = 0
            message = "Video processing completed successfully"
        elif status == "IN_PROGRESS":
            code = 200
            error_code = 0
            message = f"Video processing in progress: {step or 'Processing'}"
        else:  # PENDING
            code = 200
            error_code = 0
            message = "Video processing pending"

        return VideoStatusResponse(
            code=code,
            error_code=error_code,
            message=message,
            status=status,
            video_id=video_id,
            progress=progress,
            step=step,
            segments=segments if segments else None,
        )

    except VideoProcessingException as e:
        # Return error in the same format
        return VideoStatusResponse(
            code=e.status_code,
            error_code=e.error_code,
            message=e.detail.get("message", str(e)),
            status="INVALID_VIDEO_ID" if e.error_code == 1004 else "FAILED",
            video_id=video_id,
            progress=0,
            step=None,
            segments=None,
        )
    except Exception as e:
        # Return generic error in the same format
        return VideoStatusResponse(
            code=500,
            error_code=1400,
            message=f"Internal server error: {str(e)}",
            status="FAILED",
            video_id=video_id,
            progress=0,
            step=None,
            segments=None,
        )


@router.get("/{video_id}/statusProgressSummary", response_model=VideoStatusResponse)
async def get_status_progress_summary(
    video_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)
) -> VideoStatusResponse:
    """
    Get video processing status specifically for summarization step.

    This endpoint returns the same information as /status but is specifically
    named for frontend compatibility. It tracks the SUMMARIZATION step progress.

    **Status Values:**
    - PENDING: Video uploaded, summarization not started
    - IN_PROGRESS: Video is being summarized
    - COMPLETE: Summarization finished successfully
    - FAILED: Summarization failed with error
    - CANCELED: Processing was canceled
    - INVALID_VIDEO_ID: Video ID not found

    **Step Values (when IN_PROGRESS):**
    - SUMMARIZATION: AI analysis and summary generation in progress
    - Other steps indicate the current processing stage

    **Error Codes:**
    - 0: No error (success)
    - 1004: Video not found
    - 1005: Processing failed
    - 1400: Internal server error
    """
    # Reuse the same logic as get_video_status
    return await get_video_status(video_id, session)


@router.get("/{video_id}/statusProgressTranscribe", response_model=VideoStatusResponse)
async def get_status_progress_transcribe(
    video_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)
) -> VideoStatusResponse:
    """
    Get video processing status specifically for transcription step.

    This endpoint returns the same information as /status but is specifically
    named for frontend compatibility. It tracks the TRANSCRIBE step progress.

    **Status Values:**
    - PENDING: Video uploaded, transcription not started
    - IN_PROGRESS: Video is being transcribed
    - COMPLETE: Transcription finished successfully
    - FAILED: Transcription failed with error
    - CANCELED: Processing was canceled
    - INVALID_VIDEO_ID: Video ID not found

    **Step Values (when IN_PROGRESS):**
    - TRANSCRIBE: Speech-to-text transcription in progress
    - Other steps indicate the current processing stage

    **Error Codes:**
    - 0: No error (success)
    - 1004: Video not found
    - 1005: Processing failed
    - 1400: Internal server error
    """
    # Reuse the same logic as get_video_status
    return await get_video_status(video_id, session)


@router.post("/{video_id}/analyze", response_model=AnalyzeResponse)
async def analyze_video(
    video_id: uuid.UUID,
    language: Optional[str] = None,
    analysis_id: Optional[uuid.UUID] = None,
    session: AsyncSession = Depends(get_db_session)
) -> AnalyzeResponse:
    """
    Get complete video analysis results with optional translation.

    Returns the full analysis including title, summary, keywords, and segments
    for the specified video. If processing is not complete, returns partial results
    with current processing status.

    **Query Parameters:**
    - language: Optional target language code (e.g., 'en', 'ko', 'ja', 'zh').
      If provided and different from source language, returns translated content.
      If not provided or same as source language, returns original content.

    **Processing Status Values:**
    - PENDING: Video uploaded, processing not started
    - IN_PROGRESS: Video is being processed (partial results may be available)
    - COMPLETE: Processing finished successfully (full results available)
    - FAILED: Processing failed with error

    **Response includes:**
    - Video title, summary, and keywords (in requested language if translation requested)
    - All video segments with timing, summaries, and classifications
    - Translated content when language parameter is provided
    - Current processing status

    **Error Codes:**
    - 1004: Video not found
    - 1400: Internal server error
    """
    import logging
    import asyncio

    logger = logging.getLogger(__name__)

    try:
        video_service = VideoService(session)
        video = await video_service.get_video_by_id(video_id)

        # CRITICAL FIX: Handle race condition where processing is complete but DB not yet committed
        # If video is COMPLETE but gcs_path is missing, refresh from DB with retry

        # Always log current state
        logger.info(f"[GCS_DEBUG] Video {video_id} initial state: status={video.status}, gcs_path={video.gcs_path}, thumbnail_gcs_path={video.thumbnail_gcs_path}")

        if video.status == "COMPLETE" and not video.gcs_path:
            logger.warning(f"[ANALYZE_DEBUG] Video {video_id} is COMPLETE but gcs_path is null, retrying DB read...")
            max_retries = 3
            for retry in range(max_retries):
                await asyncio.sleep(0.5)  # Wait 500ms for DB transaction to commit
                await session.refresh(video)  # Refresh from database
                logger.info(f"[GCS_DEBUG] After refresh {retry + 1}: gcs_path={video.gcs_path}, thumbnail_gcs_path={video.thumbnail_gcs_path}")
                if video.gcs_path:
                    logger.info(f"[ANALYZE_DEBUG] Video {video_id} gcs_path found after retry {retry + 1}")
                    break
            if not video.gcs_path:
                logger.error(f"[ANALYZE_DEBUG] Video {video_id} still has no gcs_path after {max_retries} retries")

        # Get segments from database
        from app.repositories.segment_repository import SegmentRepository
        segment_repo = SegmentRepository(session)
        segment_objects = await segment_repo.get_segments_by_video_id(video_id)

        # DEBUG: Log segment retrieval
        logger.info(f"[ANALYZE_DEBUG] Video {video_id}: status={video.status}, segments_count={len(segment_objects)}, source_language={video.source_language}, requested_language={language}")

        # Determine if translation is needed
        need_translation = language and language != video.source_language

        # Get translations if needed
        video_translation = None
        segment_translations = {}

        if need_translation:
            logger.info(f"Translation requested for video {video_id} to {language}")
            from app.services.translation_helper_service import translation_helper_service

            # Get or create translations for video and all segments in a single batch API call
            video_translation, segment_translations = await translation_helper_service.get_or_create_video_and_segments_translations(
                session, video, segment_objects, language
            )

        # Convert segments to response format
        segments = []
        for idx, segment in enumerate(segment_objects):
            try:
                # Use translated content if available
                seg_translation = segment_translations.get(segment.id) if need_translation else None

                segment_response = SegmentResponse(
                    id=segment.id,
                    video_id=segment.video_id,
                    segment_no=segment.segment_no,
                    start_time=segment.start_time,
                    end_time=segment.end_time,
                    title=seg_translation.translated_title if seg_translation else segment.title,
                    summary=seg_translation.translated_summary if seg_translation else segment.summary,
                    keywords=seg_translation.translated_keywords or [] if seg_translation else segment.keywords or [],
                    scripts=seg_translation.translated_scripts if seg_translation else segment.scripts,
                    class_type=segment.class_type,
                    created_at=segment.created_at,
                    updated_at=segment.updated_at,
                )
                segments.append(segment_response)
            except Exception as seg_err:
                logger.error(f"[ANALYZE_DEBUG] Failed to convert segment {idx}: {str(seg_err)}", exc_info=True)
                raise

        # Sort segments by segment number
        segments.sort(key=lambda x: x.segment_no)

        # DEBUG: Log final segments array
        logger.info(f"[ANALYZE_DEBUG] Video {video_id}: returning {len(segments)} segments in response")

        # Generate GCS URLs for video and thumbnail
        from app.services.gcs_service import gcs_service

        gcs_view_link = None
        thumbnail_url = None

        # Try to generate signed URLs, fallback to public URLs if fails
        if video.gcs_path:
            try:
                gcs_view_link = gcs_service.generate_signed_url(
                    video.gcs_path,
                    expiration_hours=24 * 7  # 7 days
                )
                logger.info(f"[ANALYZE_DEBUG] Generated signed URL for video {video_id}")
            except Exception as url_err:
                logger.error(
                    f"[ANALYZE_DEBUG] Failed to generate signed URL for video {video_id}: {str(url_err)}",
                    exc_info=True
                )
                # Fallback to public GCS URL
                bucket_name = gcs_service.bucket_name
                gcs_view_link = f"https://storage.googleapis.com/{bucket_name}/{video.gcs_path}"
                logger.info(f"[ANALYZE_DEBUG] Using public GCS URL as fallback: {gcs_view_link}")

        if video.thumbnail_gcs_path:
            try:
                thumbnail_url = gcs_service.generate_signed_url(
                    video.thumbnail_gcs_path,
                    expiration_hours=24 * 7  # 7 days
                )
                logger.info(f"[ANALYZE_DEBUG] Generated signed URL for thumbnail {video_id}")
            except Exception as url_err:
                logger.error(
                    f"[ANALYZE_DEBUG] Failed to generate signed URL for thumbnail {video_id}: {str(url_err)}",
                    exc_info=True
                )
                # Fallback to public GCS URL
                bucket_name = gcs_service.bucket_name
                thumbnail_url = f"https://storage.googleapis.com/{bucket_name}/{video.thumbnail_gcs_path}"
                logger.info(f"[ANALYZE_DEBUG] Using public GCS URL as fallback: {thumbnail_url}")

        # Use translated video content if available
        response_title = video_translation.translated_title if video_translation else video.title
        response_summary = video_translation.translated_summary if video_translation else video.summary or ""
        response_keywords = video_translation.translated_keywords or [] if video_translation else video.keywords or []

        return AnalyzeResponse(
            title=response_title,
            summary=response_summary,
            keywords=response_keywords,
            segments=segments,
            processing_status=video.status,
            source_language=video.source_language,
            gcs_view_link=gcs_view_link,
            thumbnail_url=thumbnail_url,
        )

    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(
            f"[ANALYZE_ERROR] Failed to analyze video {video_id}: {str(e)}",
            exc_info=True,
            extra={"video_id": str(video_id)}
        )
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Internal server error: {str(e)}",
                "timestamp": "2024-01-01T00:00:00Z",
            },
        )


@router.post("/{video_id}/cancel", dependencies=[Depends(verify_api_key)])
async def cancel_video_processing(
    video_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)
):
    """
    Cancel active video processing.

    Cancels the background processing task for the specified video.
    The video status will be updated to FAILED with cancellation message.
    """
    try:
        # Verify video exists
        video_service = VideoService(session)
        await video_service.get_video_by_id(video_id)

        # Cancel processing
        cancelled = await video_processing_pipeline.cancel_processing(video_id)

        if cancelled:
            return {
                "message": "Video processing cancelled successfully",
                "video_id": str(video_id),
                "cancelled": True,
            }
        else:
            return {
                "message": "No active processing found for this video",
                "video_id": str(video_id),
                "cancelled": False,
            }

    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Internal server error: {str(e)}",
                "timestamp": "2024-01-01T00:00:00Z",
            },
        )


@router.post("/{video_id}/reanalyze", response_model=ReanalyzeResponse, dependencies=[Depends(verify_api_key)])
async def reanalyze_video(
    video_id: uuid.UUID,
    request: ReanalyzeRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ReanalyzeResponse:
    """
    Re-analyze video with user-defined segment boundaries.

    Deletes existing segments and runs AI analysis (STT + Gemini) on each
    custom segment. Results are permanently saved to DB and GCS.

    **Request Body:**
    - segments: List of segment boundaries with segment_no, start_time (HH:MM:SS), end_time (HH:MM:SS)
    - language: Source language (default: ko)
    """
    try:
        video_service = VideoService(session)
        video = await video_service.get_video_by_id(video_id)

        if video.status != "COMPLETE":
            raise VideoProcessingException(
                1001,
                f"Video must be in COMPLETE status for re-analysis. Current: {video.status}"
            )

        # Check if already processing
        from app.services.background_task_service import background_task_manager
        video_id_str = str(video_id)
        if video_id_str in background_task_manager.active_tasks:
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": 1001,
                    "message": "A processing task is already running for this video",
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )

        # Update video status to IN_PROGRESS
        await video_service.update_video_status(video_id, "IN_PROGRESS", 0)

        # Convert segments to dict format
        segments_data = [
            {
                "segment_no": seg.segment_no,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
            }
            for seg in request.segments
        ]

        # Start re-analysis pipeline
        await video_processing_pipeline.start_reanalysis(
            video_id=video_id,
            segments=segments_data,
            language=request.language or "ko",
        )

        return ReanalyzeResponse(
            video_id=video_id,
            status="IN_PROGRESS",
            message=f"Re-analysis started with {len(request.segments)} custom segments",
        )

    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Internal server error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat(),
            },
        )


@router.post("/{video_id}/splitDownload", response_model=SplitDownloadResponse, dependencies=[Depends(verify_api_key)])
async def split_video_download(
    video_id: uuid.UUID,
    request: SplitDownloadRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SplitDownloadResponse:
    """
    Split video into segments and generate download URLs.

    This endpoint splits the video based on provided segment timing information
    and generates temporary download URLs for each segment. The segments can be
    custom-defined or based on the existing AI-generated segments.

    **Request Body:**
    - segments: List of segment definitions with start_time and end_time
    - thumbnail_image: Optional base64 encoded custom thumbnail image

    **Segment Format:**
    Each segment should contain:
    - start_time: Start time in HH:MM:SS format
    - end_time: End time in HH:MM:SS format  
    - title: Optional segment title

    **Response:**
    - download_urls: List of download URLs for each segment
    - expires_at: When the download URLs expire (24 hours from generation)

    **Features:**
    - Supports up to 10 segments per video
    - Custom thumbnail can be applied to all segments
    - High-quality MP4 output optimized for streaming
    - Temporary URLs valid for 24 hours
    - Automatic validation of segment timing and overlaps

    **Error Codes:**
    - 1001: Invalid request (bad thumbnail image, invalid segments)
    - 1004: Video not found
    - 1005: Video processing failed (invalid segments, FFmpeg errors)
    - 1400: Internal server error
    """
    try:
        # Verify video exists and is processed
        video_service = VideoService(session)
        video = await video_service.get_video_by_id(video_id)

        if video.status != "COMPLETE":
            raise VideoProcessingException(
                ErrorCodes.PROCESSING_FAILED,
                f"Video processing not complete. Current status: {video.status}"
            )

        # Validate request
        if not request.segments:
            raise VideoProcessingException(
                ErrorCodes.INVALID_REQUEST,
                "At least one segment must be provided"
            )

        if len(request.segments) > 10:
            raise VideoProcessingException(
                ErrorCodes.INVALID_REQUEST,
                "Maximum 10 segments allowed"
            )

        # Split video and generate download URLs
        download_urls, expiration_time = await video_splitting_service.split_video_and_generate_urls(
            video_id=video_id,
            segments=request.segments,
            thumbnail_base64=request.thumbnail_image,
            expiration_hours=24
        )

        return SplitDownloadResponse(
            download_urls=download_urls,
            expires_at=expiration_time
        )

    except ValidationError as e:
        # Handle Pydantic validation errors (e.g., invalid base64 thumbnail)
        error_messages = []
        for error in e.errors():
            field = ".".join(str(x) for x in error["loc"])
            message = error["msg"]
            error_messages.append(f"{field}: {message}")

        raise HTTPException(
            status_code=400,
            detail={
                "error_code": 1001,
                "message": "Invalid request data: " + "; ".join(error_messages),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            },
        )
    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error in splitDownload: {str(e)}", exc_info=True)

        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Internal server error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            },
        )


@router.get("/{video_id}/segments")
async def get_video_segments_for_splitting(
    video_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)
):
    """
    Get existing video segments that can be used for splitting.

    Returns the AI-generated segments for the video, which can be used
    as a reference for the splitDownload endpoint. This is helpful when
    you want to download the segments as they were automatically created
    during video processing.

    **Response:**
    List of segments with timing information that can be directly used
    in the splitDownload endpoint.

    **Error Codes:**
    - 1004: Video not found
    - 1400: Internal server error
    """
    try:
        # Verify video exists
        video_service = VideoService(session)
        await video_service.get_video_by_id(video_id)

        # Get segments for splitting
        segments = await video_splitting_service.get_video_segments_for_splitting(video_id)

        return {
            "video_id": str(video_id),
            "segments": segments,
            "total_segments": len(segments),
            "message": "These segments can be used directly in the splitDownload endpoint"
        }

    except VideoProcessingException as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": 1400,
                "message": f"Internal server error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            },
        )


# Exception handlers will be added to the main app
