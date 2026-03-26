"""
Analysis model for storing per-video analysis results.
Each video can have up to 5 independent analyses with different settings.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.video import Segment, Video


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    analysis_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    option: Mapped[str] = mapped_column(String(10), default="B", nullable=False)
    mode: Mapped[str] = mapped_column(String(10), default="AUTO", nullable=False)
    split_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prompt_tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    preset_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preset: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    source_language: Mapped[str] = mapped_column(String(10), default="ko", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    processing_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    analysis_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    raw_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    token_usage: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    thumbnail_gcs_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("analysis_no >= 1 AND analysis_no <= 5", name="chk_analysis_no"),
        CheckConstraint("option IN ('A', 'B')", name="chk_option"),
        CheckConstraint("mode IN ('AUTO', 'CUSTOM')", name="chk_mode"),
    )

    video: Mapped["Video"] = relationship("Video", back_populates="analyses")
    segments: Mapped[list["Segment"]] = relationship(
        "Segment", back_populates="analysis", cascade="all, delete-orphan",
        foreign_keys="Segment.analysis_id",
    )

    def __repr__(self) -> str:
        return f"<Analysis(id={self.id}, video_id={self.video_id}, no={self.analysis_no}, option={self.option})>"
