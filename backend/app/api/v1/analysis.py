"""
Analysis API endpoints for creating and managing per-video analyses.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_api_key
from app.core.database import get_db_session
from app.models.analysis import Analysis
from app.models.video import Video
from app.repositories.analysis_repository import AnalysisRepository
from app.schemas.video import (
    AnalysisDetailResponse,
    AnalysisListItem,
    AnalysisListResponse,
    AnalysisStatusResponse,
    CreateAnalysisRequest,
    CreateAnalysisResponse,
    PromptPresetItem,
    PromptPresetListResponse,
    SegmentResponse,
    UsageSummaryResponse,
    VideoUsageResponse,
)
from app.services.video_service import VideoService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analysis"])


@router.post(
    "/videos/{video_id}/analyses",
    response_model=CreateAnalysisResponse,
    dependencies=[Depends(verify_api_key)],
)
async def create_analysis(
    video_id: uuid.UUID,
    request: CreateAnalysisRequest,
    session: AsyncSession = Depends(get_db_session),
) -> CreateAnalysisResponse:
    """Create a new analysis for an existing video and start the AI pipeline."""
    try:
        video_service = VideoService(session)
        analysis_repo = AnalysisRepository(session)

        video = await video_service.get_video_by_id(video_id)
        if not video or not video.gcs_path:
            raise HTTPException(status_code=404, detail="Video not found or not uploaded")

        count = await analysis_repo.count_by_video_id(video_id)
        if count >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 analyses per video")

        analysis_no = await analysis_repo.get_next_analysis_no(video_id)
        title = request.title or f"Analysis {analysis_no}"

        analysis = await analysis_repo.create(
            video_id=video_id,
            analysis_no=analysis_no,
            title=title,
            option=request.option,
            mode=request.mode,
            split_count=request.split_count,
            prompt_tags=request.prompt_tags,
            preset_name=request.preset_name,
            preset=request.preset,
            source_language=request.language or "ko",
        )
        await session.commit()

        from app.services.video_processing_pipeline import video_processing_pipeline
        await video_processing_pipeline.start_processing_from_gcs(
            video_id=video.id,
            gcs_path=video.gcs_path,
            language=request.language or "ko",
            split_count=request.split_count if request.split_count > 0 else None,
            analysis_id=analysis.id,
        )

        logger.info(f"Created analysis {analysis.id} for video {video_id} (no={analysis_no})")

        return CreateAnalysisResponse(
            video_id=video_id,
            analysis_id=analysis.id,
            analysis_no=analysis_no,
            status="PENDING",
            message=f"Analysis {analysis_no} created and pipeline started",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create analysis for video {video_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/videos/{video_id}/analyses", response_model=AnalysisListResponse)
async def list_analyses(
    video_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
) -> AnalysisListResponse:
    """List all analyses for a video."""
    try:
        analysis_repo = AnalysisRepository(session)
        analyses = await analysis_repo.get_by_video_id(video_id)

        items = []
        for a in analyses:
            thumbnail_url = None
            if a.thumbnail_gcs_path:
                try:
                    from app.services.gcs_service import gcs_service
                    thumbnail_url = gcs_service.generate_signed_url(a.thumbnail_gcs_path, expiration_hours=24)
                except Exception:
                    pass

            items.append(AnalysisListItem(
                analysis_id=a.id,
                analysis_no=a.analysis_no,
                title=a.title,
                option=a.option,
                mode=a.mode,
                split_count=a.split_count,
                source_language=a.source_language,
                status=a.status,
                processing_progress=a.processing_progress,
                thumbnail_url=thumbnail_url,
                token_usage=a.token_usage,
                created_at=a.created_at,
                updated_at=a.updated_at,
            ))

        return AnalysisListResponse(video_id=video_id, analyses=items, total_count=len(items))

    except Exception as e:
        logger.error(f"Failed to list analyses for video {video_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analyses/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
) -> AnalysisDetailResponse:
    """Get detailed analysis results including segments."""
    try:
        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.get_by_id_with_segments(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        segments = []
        for seg in sorted(analysis.segments, key=lambda s: s.segment_no):
            segments.append(SegmentResponse(
                id=seg.id, video_id=seg.video_id, segment_no=seg.segment_no,
                start_time=seg.start_time, end_time=seg.end_time, title=seg.title,
                summary=seg.summary, keywords=seg.keywords or [], scripts=seg.scripts,
                class_type=seg.class_type, created_at=seg.created_at, updated_at=seg.updated_at,
            ))

        gcs_view_link = None
        thumbnail_url = None
        try:
            from app.services.gcs_service import gcs_service
            video_service = VideoService(session)
            video = await video_service.get_video_by_id(analysis.video_id)
            if video and video.gcs_path:
                gcs_view_link = gcs_service.generate_signed_url(video.gcs_path, expiration_hours=24)
            if analysis.thumbnail_gcs_path:
                thumbnail_url = gcs_service.generate_signed_url(analysis.thumbnail_gcs_path, expiration_hours=24)
        except Exception as url_err:
            logger.warning(f"Failed to generate signed URLs for analysis {analysis_id}: {url_err}")

        return AnalysisDetailResponse(
            analysis_id=analysis.id, analysis_no=analysis.analysis_no, video_id=analysis.video_id,
            title=analysis.title, option=analysis.option, mode=analysis.mode,
            split_count=analysis.split_count, source_language=analysis.source_language,
            status=analysis.status, processing_progress=analysis.processing_progress,
            summary=analysis.summary or "", keywords=analysis.keywords or [], segments=segments,
            token_usage=analysis.token_usage, gcs_view_link=gcs_view_link, thumbnail_url=thumbnail_url,
            created_at=analysis.created_at, updated_at=analysis.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis {analysis_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analyses/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
) -> AnalysisStatusResponse:
    """Get analysis processing status."""
    try:
        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.get_by_id(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        return AnalysisStatusResponse(
            analysis_id=analysis.id, video_id=analysis.video_id,
            status=analysis.status, processing_progress=analysis.processing_progress,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis status {analysis_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/analyses/{analysis_id}", dependencies=[Depends(verify_api_key)])
async def delete_analysis(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    """Delete an analysis and clean up GCS assets."""
    try:
        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.get_by_id(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        try:
            from app.services.gcs_service import gcs_service
            prefix = f"analyses/{analysis.video_id}/{analysis_id}/"
            files = gcs_service.list_files(prefix=prefix)
            for f in files:
                try:
                    gcs_service.delete_file(f["gcs_path"])
                except Exception:
                    pass
            logger.info(f"Cleaned up {len(files)} GCS files for analysis {analysis_id}")
        except Exception as gcs_err:
            logger.warning(f"GCS cleanup failed for analysis {analysis_id}: {gcs_err}")

        await analysis_repo.delete(analysis_id)
        await session.commit()
        return {"message": "Analysis deleted", "analysis_id": str(analysis_id)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete analysis {analysis_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --- Token usage APIs ---

@router.get("/analyses/{analysis_id}/usage")
async def get_analysis_usage(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
):
    """Get token usage for a single analysis."""
    try:
        analysis_repo = AnalysisRepository(session)
        analysis = await analysis_repo.get_by_id(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        usage = analysis.token_usage or {}
        return {
            "analysis_id": str(analysis.id),
            "analysis_no": analysis.analysis_no,
            "video_id": str(analysis.video_id),
            "title": analysis.title,
            "option": analysis.option,
            "status": analysis.status,
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get usage for analysis {analysis_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/videos/{video_id}/usage", response_model=VideoUsageResponse)
async def get_video_usage(
    video_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
) -> VideoUsageResponse:
    """Get token usage summary for a single video across all its analyses."""
    try:
        video_service = VideoService(session)
        analysis_repo = AnalysisRepository(session)

        video = await video_service.get_video_by_id(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        analyses = await analysis_repo.get_by_video_id(video_id)
        total_prompt = total_output = total_all = 0
        analysis_items = []

        for a in analyses:
            usage = a.token_usage or {}
            p = usage.get("prompt_tokens", 0)
            o = usage.get("output_tokens", 0)
            t = usage.get("total_tokens", 0)
            total_prompt += p
            total_output += o
            total_all += t
            analysis_items.append({
                "analysis_id": str(a.id), "analysis_no": a.analysis_no, "title": a.title,
                "option": a.option, "status": a.status,
                "prompt_tokens": p, "output_tokens": o, "total_tokens": t,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })

        return VideoUsageResponse(
            video_id=video_id, video_title=video.title, total_analyses=len(analyses),
            total_prompt_tokens=total_prompt, total_output_tokens=total_output,
            total_tokens=total_all, analyses=analysis_items,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get usage for video {video_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage/summary", response_model=UsageSummaryResponse)
async def get_usage_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
) -> UsageSummaryResponse:
    """Get overall token usage summary. Optional date filters: YYYY-MM-DD."""
    try:
        stmt = select(Analysis)
        if start_date:
            stmt = stmt.where(Analysis.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
            stmt = stmt.where(Analysis.created_at <= end_dt)

        result = await session.execute(stmt)
        analyses = list(result.scalars().all())

        total_prompt = total_output = total_all = 0
        by_option = {"A": {"count": 0, "total_tokens": 0}, "B": {"count": 0, "total_tokens": 0}}
        video_map = {}

        for a in analyses:
            usage = a.token_usage or {}
            p = usage.get("prompt_tokens", 0)
            o = usage.get("output_tokens", 0)
            t = usage.get("total_tokens", 0)
            total_prompt += p
            total_output += o
            total_all += t

            opt = a.option if a.option in by_option else "B"
            by_option[opt]["count"] += 1
            by_option[opt]["total_tokens"] += t

            vid = str(a.video_id)
            if vid not in video_map:
                video_map[vid] = {"video_id": vid, "analysis_count": 0, "total_tokens": 0}
            video_map[vid]["analysis_count"] += 1
            video_map[vid]["total_tokens"] += t

        video_count_result = await session.execute(select(func.count()).select_from(Video))
        total_videos = video_count_result.scalar()

        return UsageSummaryResponse(
            total_videos=total_videos, total_analyses=len(analyses),
            total_prompt_tokens=total_prompt, total_output_tokens=total_output,
            total_tokens=total_all, by_option=by_option,
            by_video=sorted(video_map.values(), key=lambda x: x["total_tokens"], reverse=True),
            period_start=datetime.fromisoformat(start_date) if start_date else None,
            period_end=datetime.fromisoformat(end_date) if end_date else None,
        )

    except Exception as e:
        logger.error(f"Failed to get usage summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/presets/list",
    response_model=PromptPresetListResponse,
    dependencies=[Depends(verify_api_key)],
    tags=["presets"],
)
async def list_prompt_presets(
    session: AsyncSession = Depends(get_db_session),
) -> PromptPresetListResponse:
    """
    Get unique prompt presets from analysis history.

    Extracts distinct (preset_name, prompt_tags) combinations from all analyses
    where preset_name is set. Returns use count and last used date for each preset.
    """
    try:
        stmt = (
            select(
                Analysis.preset_name,
                Analysis.prompt_tags,
                func.count(Analysis.id).label("use_count"),
                func.max(Analysis.created_at).label("last_used_at"),
            )
            .where(Analysis.preset_name.isnot(None))
            .group_by(Analysis.preset_name, Analysis.prompt_tags)
            .order_by(func.max(Analysis.created_at).desc())
        )
        result = await session.execute(stmt)
        rows = result.all()

        presets = [
            PromptPresetItem(
                preset_name=row.preset_name,
                tags=row.prompt_tags or [],
                use_count=row.use_count,
                last_used_at=row.last_used_at,
            )
            for row in rows
        ]

        return PromptPresetListResponse(presets=presets, total=len(presets))

    except Exception as e:
        logger.error(f"Failed to list presets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
