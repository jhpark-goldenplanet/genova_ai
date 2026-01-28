"""
Caption/Subtitle parser for SRT and VTT formats.
Extracts timestamped text segments from YouTube captions.
"""

import logging
import re
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CaptionSegment:
    """Represents a single caption segment with timing information."""

    index: int
    start_time: float  # in seconds
    end_time: float  # in seconds
    text: str

    def __repr__(self) -> str:
        return f"CaptionSegment({self.index}, {self.start_time:.2f}s-{self.end_time:.2f}s, '{self.text[:50]}')"


class CaptionParser:
    """Parser for subtitle/caption files (SRT, VTT formats)."""

    @staticmethod
    def parse_srt(content: str) -> List[CaptionSegment]:
        """
        Parse SRT (SubRip) format captions.

        SRT format:
        1
        00:00:04,259 --> 00:00:05,259
        First subtitle text

        2
        00:00:05,259 --> 00:00:07,500
        Second subtitle text

        Args:
            content: SRT file content as string

        Returns:
            List of CaptionSegment objects
        """
        segments = []

        # Split by double newline (segment separator)
        blocks = re.split(r'\n\s*\n', content.strip())

        for block in blocks:
            if not block.strip():
                continue

            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue

            try:
                # First line: index
                index = int(lines[0].strip())

                # Second line: timestamp
                timestamp_line = lines[1].strip()
                start_time, end_time = CaptionParser._parse_srt_timestamp(timestamp_line)

                # Remaining lines: text content
                text = ' '.join(line.strip() for line in lines[2:] if line.strip())

                # Remove HTML tags if present
                text = CaptionParser._remove_html_tags(text)

                if text:
                    segments.append(CaptionSegment(
                        index=index,
                        start_time=start_time,
                        end_time=end_time,
                        text=text
                    ))

            except (ValueError, IndexError) as e:
                logger.warning(f"Failed to parse SRT block: {e}")
                continue

        return segments

    @staticmethod
    def parse_vtt(content: str) -> List[CaptionSegment]:
        """
        Parse VTT (WebVTT) format captions.

        VTT format:
        WEBVTT

        00:00:04.259 --> 00:00:05.259
        First subtitle text

        00:00:05.259 --> 00:00:07.500
        Second subtitle text

        Args:
            content: VTT file content as string

        Returns:
            List of CaptionSegment objects
        """
        segments = []

        # Remove WEBVTT header
        content = re.sub(r'^WEBVTT.*?\n\n', '', content, flags=re.IGNORECASE)

        # Split by double newline or single newline before timestamp
        blocks = re.split(r'\n\s*\n|\n(?=\d{2}:)', content.strip())

        index = 0
        for block in blocks:
            if not block.strip():
                continue

            lines = block.strip().split('\n')
            if len(lines) < 2:
                continue

            # Check if first line is a timestamp or a cue identifier
            timestamp_line = None
            text_start_index = 1

            if '-->' in lines[0]:
                timestamp_line = lines[0]
                text_start_index = 1
            elif len(lines) > 1 and '-->' in lines[1]:
                # First line is cue identifier, second is timestamp
                timestamp_line = lines[1]
                text_start_index = 2
            else:
                continue

            try:
                start_time, end_time = CaptionParser._parse_vtt_timestamp(timestamp_line)

                # Remaining lines: text content
                text = ' '.join(line.strip() for line in lines[text_start_index:] if line.strip())

                # Remove VTT tags and HTML tags
                text = CaptionParser._remove_vtt_tags(text)
                text = CaptionParser._remove_html_tags(text)

                if text:
                    index += 1
                    segments.append(CaptionSegment(
                        index=index,
                        start_time=start_time,
                        end_time=end_time,
                        text=text
                    ))

            except (ValueError, IndexError) as e:
                logger.warning(f"Failed to parse VTT block: {e}")
                continue

        return segments

    @staticmethod
    def _parse_srt_timestamp(timestamp_line: str) -> tuple[float, float]:
        """
        Parse SRT timestamp line.
        Format: 00:00:04,259 --> 00:00:05,259

        Returns:
            Tuple of (start_time, end_time) in seconds
        """
        parts = timestamp_line.split('-->')
        if len(parts) != 2:
            raise ValueError(f"Invalid SRT timestamp format: {timestamp_line}")

        start_str = parts[0].strip()
        end_str = parts[1].strip()

        start_time = CaptionParser._srt_time_to_seconds(start_str)
        end_time = CaptionParser._srt_time_to_seconds(end_str)

        return start_time, end_time

    @staticmethod
    def _parse_vtt_timestamp(timestamp_line: str) -> tuple[float, float]:
        """
        Parse VTT timestamp line.
        Format: 00:00:04.259 --> 00:00:05.259

        Returns:
            Tuple of (start_time, end_time) in seconds
        """
        parts = timestamp_line.split('-->')
        if len(parts) != 2:
            raise ValueError(f"Invalid VTT timestamp format: {timestamp_line}")

        start_str = parts[0].strip()
        end_str = parts[1].strip()

        # Remove position/alignment info if present (e.g., "align:start position:0%")
        start_str = start_str.split()[0]
        end_str = end_str.split()[0]

        start_time = CaptionParser._vtt_time_to_seconds(start_str)
        end_time = CaptionParser._vtt_time_to_seconds(end_str)

        return start_time, end_time

    @staticmethod
    def _srt_time_to_seconds(time_str: str) -> float:
        """
        Convert SRT time format to seconds.
        Format: HH:MM:SS,mmm or MM:SS,mmm
        """
        # Replace comma with period for milliseconds
        time_str = time_str.replace(',', '.')

        parts = time_str.split(':')
        if len(parts) == 3:
            # HH:MM:SS.mmm
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            # MM:SS.mmm
            minutes = float(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        else:
            raise ValueError(f"Invalid SRT time format: {time_str}")

    @staticmethod
    def _vtt_time_to_seconds(time_str: str) -> float:
        """
        Convert VTT time format to seconds.
        Format: HH:MM:SS.mmm or MM:SS.mmm
        """
        parts = time_str.split(':')
        if len(parts) == 3:
            # HH:MM:SS.mmm
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            # MM:SS.mmm
            minutes = float(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        else:
            raise ValueError(f"Invalid VTT time format: {time_str}")

    @staticmethod
    def _remove_html_tags(text: str) -> str:
        """Remove HTML tags from text."""
        return re.sub(r'<[^>]+>', '', text)

    @staticmethod
    def _remove_vtt_tags(text: str) -> str:
        """
        Remove VTT-specific tags.
        VTT supports tags like <c>, <v>, <lang>, etc.
        Also removes timestamp tags like <00:00:06.003>
        """
        # Remove timestamp tags
        text = re.sub(r'<\d{2}:\d{2}:\d{2}\.\d{3}>', '', text)
        # Remove other tags
        text = re.sub(r'<[^>]+>', '', text)
        return text

    @staticmethod
    def merge_segments(segments: List[CaptionSegment], merge_duration: float = 5.0) -> List[CaptionSegment]:
        """
        Merge consecutive caption segments that are close together.
        Useful for creating longer, more meaningful segments.

        Args:
            segments: List of CaptionSegment objects
            merge_duration: Maximum gap (in seconds) to merge segments

        Returns:
            List of merged CaptionSegment objects
        """
        if not segments:
            return []

        merged = []
        current = segments[0]

        for next_seg in segments[1:]:
            # If gap between current and next is small, merge them
            gap = next_seg.start_time - current.end_time
            if gap <= merge_duration:
                current = CaptionSegment(
                    index=current.index,
                    start_time=current.start_time,
                    end_time=next_seg.end_time,
                    text=current.text + ' ' + next_seg.text
                )
            else:
                merged.append(current)
                current = next_seg

        # Add last segment
        merged.append(current)

        # Re-index
        for i, seg in enumerate(merged, 1):
            seg.index = i

        return merged

    @staticmethod
    def get_full_transcript(segments: List[CaptionSegment]) -> str:
        """
        Get full transcript text from caption segments.

        Args:
            segments: List of CaptionSegment objects

        Returns:
            Full transcript as a single string
        """
        return ' '.join(seg.text for seg in segments)

    @staticmethod
    def get_segment_by_time(
        segments: List[CaptionSegment],
        start_time: float,
        end_time: float
    ) -> str:
        """
        Extract transcript text for a specific time range.

        Args:
            segments: List of CaptionSegment objects
            start_time: Start time in seconds
            end_time: End time in seconds

        Returns:
            Transcript text for the specified time range
        """
        relevant_segments = [
            seg for seg in segments
            if (seg.start_time <= end_time and seg.end_time >= start_time)
        ]

        return ' '.join(seg.text for seg in relevant_segments)
