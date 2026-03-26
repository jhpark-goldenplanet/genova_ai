"""
Repository for analysis database operations.
"""

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.analysis import Analysis

logger = logging.getLogger(__name__)


class AnalysisRepository:
    """Repository for analysis database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        video_id: UUID,
        analysis_no: int,
        title: str,
        option: str = "B",
        mode: str = "AUTO",
        split_count: int = 0,
        prompt_tags: Optional[list] = None,
        preset_name: Optional[str] = None,
        preset: Optional[dict] = None,
        source_language: str = "ko",
    ) -> Analysis:
        analysis = Analysis(
            video_id=video_id,
            analysis_no=analysis_no,
            title=title,
            option=option,
            mode=mode,
            split_count=split_count,
            prompt_tags=prompt_tags,
            preset_name=preset_name,
            preset=preset,
            source_language=source_language,
            status="PENDING",
            processing_progress=0,
        )
        self.session.add(analysis)
        await self.session.flush()
        logger.info(f"Created analysis {analysis.id} (no={analysis_no}) for video {video_id}")
        return analysis

    async def get_by_id(self, analysis_id: UUID) -> Optional[Analysis]:
        stmt = select(Analysis).where(Analysis.id == analysis_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id_with_segments(self, analysis_id: UUID) -> Optional[Analysis]:
        stmt = (
            select(Analysis)
            .options(selectinload(Analysis.segments))
            .where(Analysis.id == analysis_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_video_id(self, video_id: UUID) -> list[Analysis]:
        stmt = (
            select(Analysis)
            .where(Analysis.video_id == video_id)
            .order_by(Analysis.analysis_no)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_by_video_id(self, video_id: UUID) -> Optional[Analysis]:
        stmt = (
            select(Analysis)
            .where(Analysis.video_id == video_id)
            .order_by(Analysis.analysis_no.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_next_analysis_no(self, video_id: UUID) -> int:
        stmt = (
            select(func.coalesce(func.max(Analysis.analysis_no), 0))
            .where(Analysis.video_id == video_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar() + 1

    async def count_by_video_id(self, video_id: UUID) -> int:
        stmt = select(func.count()).select_from(Analysis).where(Analysis.video_id == video_id)
        result = await self.session.execute(stmt)
        return result.scalar()

    async def update(self, analysis_id: UUID, update_data: dict) -> Optional[Analysis]:
        analysis = await self.get_by_id(analysis_id)
        if not analysis:
            return None
        for field, value in update_data.items():
            if hasattr(analysis, field):
                setattr(analysis, field, value)
        await self.session.flush()
        logger.info(f"Updated analysis {analysis_id}: {list(update_data.keys())}")
        return analysis

    async def update_status(self, analysis_id: UUID, status: str, progress: int = 0) -> Optional[Analysis]:
        return await self.update(analysis_id, {"status": status, "processing_progress": progress})

    async def update_results(
        self,
        analysis_id: UUID,
        summary: Optional[str] = None,
        keywords: Optional[list] = None,
        analysis_result: Optional[dict] = None,
        raw_results: Optional[dict] = None,
        token_usage: Optional[dict] = None,
        thumbnail_gcs_path: Optional[str] = None,
    ) -> Optional[Analysis]:
        update_data = {}
        if summary is not None:
            update_data["summary"] = summary
        if keywords is not None:
            update_data["keywords"] = keywords
        if analysis_result is not None:
            update_data["analysis_result"] = analysis_result
        if raw_results is not None:
            update_data["raw_results"] = raw_results
        if token_usage is not None:
            update_data["token_usage"] = token_usage
        if thumbnail_gcs_path is not None:
            update_data["thumbnail_gcs_path"] = thumbnail_gcs_path
        if not update_data:
            return await self.get_by_id(analysis_id)
        return await self.update(analysis_id, update_data)

    async def delete(self, analysis_id: UUID) -> bool:
        analysis = await self.get_by_id(analysis_id)
        if not analysis:
            return False
        await self.session.delete(analysis)
        await self.session.flush()
        logger.info(f"Deleted analysis {analysis_id}")
        return True
