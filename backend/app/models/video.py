"""
Video and Segment database models for the Genova AI Backend.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.organization import Organization, Workspace


class Video(Base):
    """Video model for storing video metadata and processing results."""

    __tablename__ = "videos"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Organization and workspace (nullable for backward compatibility)
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    workspace_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )

    # Basic video information
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), default="FILE_UPLOAD")

    # Processing status
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    processing_progress: Mapped[int] = mapped_column(Integer, default=0)

    # Video metadata
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Storage information
    gcs_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    thumbnail_gcs_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # AI analysis results
    analysis_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    raw_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Source language
    source_language: Mapped[str] = mapped_column(String(10), default="ko", nullable=False)

    # Token usage from AI processing
    token_usage: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="videos")
    workspace: Mapped[Optional["Workspace"]] = relationship("Workspace", back_populates="videos")
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis", back_populates="video", cascade="all, delete-orphan"
    )
    segments: Mapped[list["Segment"]] = relationship(
        "Segment", back_populates="video", cascade="all, delete-orphan"
    )
    translations: Mapped[list["VideoTranslation"]] = relationship(
        "VideoTranslation", back_populates="video", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Video(id={self.id}, title='{self.title}', status='{self.status}')>"


class Segment(Base):
    """Segment model for storing video segment information."""

    __tablename__ = "segments"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key to video
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )

    # Foreign key to analysis (nullable for backward compatibility)
    analysis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=True
    )

    # Segment information
    segment_no: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[str] = mapped_column(String(8), nullable=False)  # "00:01:30"
    end_time: Mapped[str] = mapped_column(String(8), nullable=False)  # "00:02:45"

    # Content information
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    scripts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Segment classification
    class_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )  # introduction, content, conclusion

    # Source language
    source_language: Mapped[str] = mapped_column(String(10), default="ko", nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # GCS storage path for the segment file
    gcs_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    video: Mapped["Video"] = relationship("Video", back_populates="segments")
    analysis: Mapped[Optional["Analysis"]] = relationship(
        "Analysis", back_populates="segments", foreign_keys=[analysis_id]
    )
    translations: Mapped[list["SegmentTranslation"]] = relationship(
        "SegmentTranslation", back_populates="segment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Segment(id={self.id}, video_id={self.video_id}, segment_no={self.segment_no})>"
