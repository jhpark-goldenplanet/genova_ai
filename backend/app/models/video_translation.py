"""
Video translation database models for multi-language support.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class VideoTranslation(Base):
    """VideoTranslation model for storing video translations in different languages."""

    __tablename__ = "video_translations"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key to video
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )

    # Target language (ISO 639-1 code)
    target_language: Mapped[str] = mapped_column(String(10), nullable=False)

    # Translated content
    translated_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    translated_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    translated_keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Translation metadata
    translation_status: Mapped[str] = mapped_column(String(20), default="PENDING")
    translation_provider: Mapped[Optional[str]] = mapped_column(
        String(50), default="google_translate", nullable=True
    )
    translation_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    video: Mapped["Video"] = relationship("Video", back_populates="translations")

    # Table constraints
    __table_args__ = (
        UniqueConstraint("video_id", "target_language", name="unique_video_language"),
    )

    def __repr__(self) -> str:
        return f"<VideoTranslation(id={self.id}, video_id={self.video_id}, target_language='{self.target_language}', status='{self.translation_status}')>"


class SegmentTranslation(Base):
    """SegmentTranslation model for storing segment translations in different languages."""

    __tablename__ = "segment_translations"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Foreign key to segment
    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("segments.id", ondelete="CASCADE"), nullable=False
    )

    # Target language (ISO 639-1 code)
    target_language: Mapped[str] = mapped_column(String(10), nullable=False)

    # Translated content
    translated_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    translated_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    translated_keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    translated_scripts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Translation metadata
    translation_status: Mapped[str] = mapped_column(String(20), default="PENDING")
    translation_provider: Mapped[Optional[str]] = mapped_column(
        String(50), default="google_translate", nullable=True
    )
    translation_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    segment: Mapped["Segment"] = relationship("Segment", back_populates="translations")

    # Table constraints
    __table_args__ = (
        UniqueConstraint("segment_id", "target_language", name="unique_segment_language"),
    )

    def __repr__(self) -> str:
        return f"<SegmentTranslation(id={self.id}, segment_id={self.segment_id}, target_language='{self.target_language}', status='{self.translation_status}')>"
