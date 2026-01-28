-- ============================================================================
-- Genova AI Backend - PostgreSQL Database Schema
-- ============================================================================
-- Description: Database schema for video processing and AI analysis
-- Version: 1.0.0
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: videos
-- Description: Main table for storing video metadata and processing results
-- ============================================================================
CREATE TABLE IF NOT EXISTS videos (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic video information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(20) DEFAULT 'FILE_UPLOAD' NOT NULL,

    -- Processing status
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    processing_progress INTEGER DEFAULT 0 NOT NULL,

    -- Video metadata
    duration_seconds INTEGER,
    file_size_bytes INTEGER,
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),

    -- Storage information
    gcs_path VARCHAR(500),
    thumbnail_gcs_path VARCHAR(500),

    -- AI analysis results (stored as JSON)
    analysis_result JSONB,
    raw_results JSONB,
    summary TEXT,
    keywords JSONB,

    -- Source language
    source_language VARCHAR(10) DEFAULT 'ko' NOT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- Table: segments
-- Description: Video segments with AI-generated metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS segments (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to videos table
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,

    -- Segment information
    segment_no INTEGER NOT NULL,
    start_time VARCHAR(8) NOT NULL,  -- Format: "00:01:30"
    end_time VARCHAR(8) NOT NULL,    -- Format: "00:02:45"

    -- Content information
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    keywords JSONB,
    scripts TEXT,

    -- Segment classification
    class_type VARCHAR(20),  -- introduction, content, conclusion

    -- Source language
    source_language VARCHAR(10) DEFAULT 'ko' NOT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- Table: video_translations
-- Description: Translations of video content in different languages
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_translations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to videos table
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,

    -- Target language (ISO 639-1 code)
    target_language VARCHAR(10) NOT NULL,

    -- Translated content
    translated_title VARCHAR(255),
    translated_summary TEXT,
    translated_keywords JSONB,

    -- Translation metadata
    translation_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    translation_provider VARCHAR(50) DEFAULT 'google_translate',
    translation_model VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Unique constraint: one translation per video per language
    CONSTRAINT unique_video_language UNIQUE (video_id, target_language)
);

-- ============================================================================
-- Table: segment_translations
-- Description: Translations of segment content in different languages
-- ============================================================================
CREATE TABLE IF NOT EXISTS segment_translations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to segments table
    segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,

    -- Target language (ISO 639-1 code)
    target_language VARCHAR(10) NOT NULL,

    -- Translated content
    translated_title VARCHAR(255),
    translated_summary TEXT,
    translated_keywords JSONB,
    translated_scripts TEXT,

    -- Translation metadata
    translation_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    translation_provider VARCHAR(50) DEFAULT 'google_translate',
    translation_model VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Unique constraint: one translation per segment per language
    CONSTRAINT unique_segment_language UNIQUE (segment_id, target_language)
);

-- ============================================================================
-- Indexes for better query performance
-- ============================================================================

-- Videos table indexes
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_source_type ON videos(source_type);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_gcs_path ON videos(gcs_path);
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_gcs_path ON videos(thumbnail_gcs_path);

-- Segments table indexes
CREATE INDEX IF NOT EXISTS idx_segments_video_id ON segments(video_id);
CREATE INDEX IF NOT EXISTS idx_segments_video_segment ON segments(video_id, segment_no);
CREATE INDEX IF NOT EXISTS idx_segments_class_type ON segments(class_type);

-- Video translations table indexes
CREATE INDEX IF NOT EXISTS idx_video_translations_video_id ON video_translations(video_id);
CREATE INDEX IF NOT EXISTS idx_video_translations_language ON video_translations(target_language);
CREATE INDEX IF NOT EXISTS idx_video_translations_status ON video_translations(translation_status);

-- Segment translations table indexes
CREATE INDEX IF NOT EXISTS idx_segment_translations_segment_id ON segment_translations(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_translations_language ON segment_translations(target_language);
CREATE INDEX IF NOT EXISTS idx_segment_translations_status ON segment_translations(translation_status);

-- ============================================================================
-- Triggers for automatic updated_at timestamp
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to videos table
DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to segments table
DROP TRIGGER IF EXISTS update_segments_updated_at ON segments;
CREATE TRIGGER update_segments_updated_at
    BEFORE UPDATE ON segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to video_translations table
DROP TRIGGER IF EXISTS update_video_translations_updated_at ON video_translations;
CREATE TRIGGER update_video_translations_updated_at
    BEFORE UPDATE ON video_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to segment_translations table
DROP TRIGGER IF EXISTS update_segment_translations_updated_at ON segment_translations;
CREATE TRIGGER update_segment_translations_updated_at
    BEFORE UPDATE ON segment_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE videos IS 'Main table storing video metadata and AI analysis results';
COMMENT ON TABLE segments IS 'Video segments with AI-generated metadata and classifications';
COMMENT ON TABLE video_translations IS 'Translations of video content in multiple languages';
COMMENT ON TABLE segment_translations IS 'Translations of segment content in multiple languages';

COMMENT ON COLUMN videos.status IS 'Processing status: PENDING, PROCESSING, COMPLETED, FAILED';
COMMENT ON COLUMN videos.source_type IS 'Video source: FILE_UPLOAD, YOUTUBE, URL';
COMMENT ON COLUMN videos.gcs_path IS 'Google Cloud Storage path for the video file';
COMMENT ON COLUMN videos.thumbnail_gcs_path IS 'GCS storage path for video thumbnail image';
COMMENT ON COLUMN segments.class_type IS 'Segment classification: introduction, content, conclusion';
COMMENT ON COLUMN video_translations.translation_status IS 'Translation status: PENDING, PROCESSING, COMPLETED, FAILED';

-- ============================================================================
-- Schema initialization complete
-- ============================================================================
