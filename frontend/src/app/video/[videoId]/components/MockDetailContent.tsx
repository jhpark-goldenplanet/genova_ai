'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useModal } from '@/shared/hooks';
import useGetVideoInfo from '@/shared/hooks/useGetVideoInfo';
import { unit } from '@/shared/utils/base';
import { ISegmentsSchema } from '@/typings/schema';
import { errorToast, infoToast, successToast } from '@/shared/utils/toastUtils';

type DetailTabType = 'summary' | 'script' | 'split';

interface AnalysisItem {
	id: string;
	name: string;
	status: 'COMPLETE' | 'IN_PROGRESS' | 'FAILED';
	updatedAt: string;
	promptLabel: string;
	briefing: string;
	keywords: string[];
}

interface WorkItem {
	id: string;
	title: string;
	duration: string;
	uploadedAt: string;
	source: string;
	videoUrl?: string;
	thumbnailUrl?: string;
	videoId?: string;
	analyses: AnalysisItem[];
}

const WORKSPACE_STORAGE_KEY = 'genova_workspace_mock_works_v1';
const SPLIT_SEGMENT_COLORS = [
	{
		bar: 'linear-gradient(90deg, rgba(61, 113, 207, 1) 0%, rgba(84, 140, 232, 1) 100%)',
		glow: 'rgba(84, 140, 232, 0.9)',
		chipBg: 'rgba(236, 244, 255, 1)',
		chipBorder: 'rgba(181, 205, 244, 1)',
		chipText: 'rgba(49, 88, 165, 1)',
	},
	{
		bar: 'linear-gradient(90deg, rgba(78, 145, 132, 1) 0%, rgba(112, 188, 164, 1) 100%)',
		glow: 'rgba(112, 188, 164, 0.9)',
		chipBg: 'rgba(236, 250, 246, 1)',
		chipBorder: 'rgba(179, 225, 212, 1)',
		chipText: 'rgba(49, 114, 97, 1)',
	},
	{
		bar: 'linear-gradient(90deg, rgba(206, 133, 64, 1) 0%, rgba(230, 164, 105, 1) 100%)',
		glow: 'rgba(230, 164, 105, 0.9)',
		chipBg: 'rgba(255, 245, 235, 1)',
		chipBorder: 'rgba(245, 208, 174, 1)',
		chipText: 'rgba(159, 94, 35, 1)',
	},
	{
		bar: 'linear-gradient(90deg, rgba(150, 80, 190, 1) 0%, rgba(178, 115, 215, 1) 100%)',
		glow: 'rgba(178, 115, 215, 0.9)',
		chipBg: 'rgba(245, 236, 255, 1)',
		chipBorder: 'rgba(210, 180, 240, 1)',
		chipText: 'rgba(110, 55, 155, 1)',
	},
	{
		bar: 'linear-gradient(90deg, rgba(200, 75, 95, 1) 0%, rgba(225, 110, 125, 1) 100%)',
		glow: 'rgba(225, 110, 125, 0.9)',
		chipBg: 'rgba(255, 236, 240, 1)',
		chipBorder: 'rgba(240, 190, 200, 1)',
		chipText: 'rgba(160, 50, 70, 1)',
	},
	{
		bar: 'linear-gradient(90deg, rgba(55, 140, 180, 1) 0%, rgba(85, 175, 210, 1) 100%)',
		glow: 'rgba(85, 175, 210, 0.9)',
		chipBg: 'rgba(232, 248, 255, 1)',
		chipBorder: 'rgba(170, 218, 240, 1)',
		chipText: 'rgba(35, 105, 145, 1)',
	},
	{
		bar: 'linear-gradient(90deg, rgba(160, 150, 60, 1) 0%, rgba(195, 185, 90, 1) 100%)',
		glow: 'rgba(195, 185, 90, 0.9)',
		chipBg: 'rgba(252, 250, 232, 1)',
		chipBorder: 'rgba(225, 220, 165, 1)',
		chipText: 'rgba(120, 112, 30, 1)',
	},
	{
		bar: 'linear-gradient(90deg, rgba(90, 90, 130, 1) 0%, rgba(125, 125, 165, 1) 100%)',
		glow: 'rgba(125, 125, 165, 0.9)',
		chipBg: 'rgba(240, 240, 250, 1)',
		chipBorder: 'rgba(195, 195, 220, 1)',
		chipText: 'rgba(65, 65, 105, 1)',
	},
];

const parseDurationToSeconds = (duration?: string) => {
	if (!duration || duration === '-') return 15 * 60;
	const parts = duration.split(':').map((part) => Number(part));
	if (parts.some((part) => Number.isNaN(part))) return 15 * 60;
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	return 15 * 60;
};

const formatSeconds = (seconds: number) => {
	const safe = Math.max(0, Math.floor(seconds));
	const hh = Math.floor(safe / 3600);
	const mm = Math.floor((safe % 3600) / 60);
	const ss = safe % 60;
	if (hh > 0) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
	return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const interpolateTime = (totalSeconds: number, percent: number) => formatSeconds((totalSeconds * percent) / 100);

const timeStringToSeconds = (value?: string) => {
	if (!value) return 0;
	const parts = value.split(':').map((part) => Number(part));
	if (parts.some((part) => Number.isNaN(part))) return 0;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return parts[0] ?? 0;
};

const buildTimelineItems = (analysis?: AnalysisItem, duration = '-') => {
	if (!analysis) return [];
	const summaryChunks = analysis.briefing
		.split(/[.!?]\s+|\n+/)
		.map((item) => item.trim())
		.filter(Boolean);
	const keywords = analysis.keywords.length ? analysis.keywords : ['핵심 내용', '요약 포인트', '주요 메시지'];
	const timePresets = duration !== '-' ? ['00:00-05:30', '05:30-11:00', '11:00-종료'] : ['구간 1', '구간 2', '구간 3'];

	return Array.from({ length: Math.min(3, Math.max(summaryChunks.length, 1)) }).map((_, index) => ({
		id: `${analysis.id}-timeline-${index}`,
		timeRange: timePresets[index] ?? `구간 ${index + 1}`,
		topic: keywords[index] ?? `주제 ${index + 1}`,
		summary: summaryChunks[index] ?? analysis.briefing,
		keywords: keywords.slice(index, index + 3),
		script: `${summaryChunks[index] ?? analysis.briefing}\n\n${(analysis.keywords.slice(index, index + 2) || []).join(', ')}`,
	}));
};

const buildTimelineItemsFromSegments = (segments: ISegmentsSchema[] = []) =>
	segments.map((segment, index) => ({
		id: segment.segments_id || `segment-${index + 1}`,
		timeRange: `${segment.start_time} - ${segment.end_time}`,
		topic: segment.title || `구간 ${index + 1}`,
		summary: segment.summary || '요약 정보가 없습니다.',
		keywords: segment.keywords?.length ? segment.keywords : ['키워드 없음'],
		script: segment.scripts || '스크립트 정보가 없습니다.',
	}));

const buildActualSplitSegments = (segments: ISegmentsSchema[] = []) =>
	segments.map((segment, index) => {
		const startSeconds = timeStringToSeconds(segment.start_time);
		const endSeconds = timeStringToSeconds(segment.end_time);
		return {
			id: segment.segments_id || `actual-segment-${index + 1}`,
			order: index + 1,
			start: startSeconds,
			end: endSeconds,
			timeRange: `${segment.start_time} - ${segment.end_time}`,
			topic: segment.title || `구간 ${index + 1}`,
			summary: segment.summary || '요약 정보가 없습니다.',
			keywords: segment.keywords?.length ? segment.keywords : ['키워드 없음'],
			script: segment.scripts || '스크립트 정보가 없습니다.',
		};
	});

const toPercent = (value: number, totalSeconds: number) => {
	if (!totalSeconds) return 0;
	return Math.min(Math.max((value / totalSeconds) * 100, 0), 100);
};

const sanitizeDownloadFileName = (value: string) =>
	value
		.trim()
		.replace(/[\\/:*?"<>|]+/g, '_')
		.replace(/\s+/g, ' ')
		.slice(0, 120);

const readFileAsDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
		reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
		reader.readAsDataURL(file);
	});

const AddThumbnailModal = dynamic(() => import('@/app/video/[videoId]/split/components/AddThumbnailModal'), {
	ssr: false,
});

type Props = {
	videoId: string;
	tab: DetailTabType;
};

export default function MockDetailContent({ videoId, tab }: Props) {
	const searchParams = useSearchParams();
	const { confirm, closeConfirm, custom, closeFreeModal } = useModal();
	const initialAnalysisId = searchParams.get('analysisId') ?? '';

	const [works, setWorks] = useState<WorkItem[]>([]);
	const [selectedAnalysisId, setSelectedAnalysisId] = useState(initialAnalysisId);
	const [isAllScriptsOpen, setIsAllScriptsOpen] = useState(true);
	const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
	const [splitPoints, setSplitPoints] = useState([33, 66]);
	const [reanalyzeCount, setReanalyzeCount] = useState(0);
	const [draggingFlagIndex, setDraggingFlagIndex] = useState<number | null>(null);
	const [selectedSplitPointIndex, setSelectedSplitPointIndex] = useState<number | null>(null);
	const [isHighlightPulseOn, setIsHighlightPulseOn] = useState(true);
	const [isDownloadSelectionMode, setIsDownloadSelectionMode] = useState(false);
	const [selectedDownloadSegmentIds, setSelectedDownloadSegmentIds] = useState<string[]>([]);
	const [selectedThumbnailImage, setSelectedThumbnailImage] = useState<string | undefined>(undefined);
	const splitRailRef = useRef<HTMLDivElement | null>(null);
	const { videoInfo, isConverting, status, step, percentage } = useGetVideoInfo();
	// splitDownload API는 새 API 준비 후 교체 예정 (현재 console.log만 출력)

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]');
			setWorks(Array.isArray(parsed) ? parsed : []);
		} catch (error) {
			setWorks([]);
		}
	}, []);

	useEffect(() => {
		if (!videoInfo) return;
		console.log('[AnalysisResult] server videoInfo', videoInfo);
		console.log('[AnalysisResult] status snapshot', {
			videoId,
			status,
			step,
			percentage,
		});
	}, [videoInfo, videoId, status, step, percentage]);

	const selectedWork = useMemo(() => works.find((work) => work.videoId === videoId), [works, videoId]);
	const selectedAnalysis = useMemo(
		() => selectedWork?.analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? selectedWork?.analyses[0],
		[selectedAnalysisId, selectedWork],
	);
	const actualTimelineItems = useMemo(() => buildTimelineItemsFromSegments(videoInfo?.segments ?? []), [videoInfo?.segments]);
	const timelineItems = useMemo(
		() => (actualTimelineItems.length ? actualTimelineItems : buildTimelineItems(selectedAnalysis, selectedWork?.duration ?? '-')),
		[actualTimelineItems, selectedAnalysis, selectedWork?.duration],
	);

	useEffect(() => {
		if (!selectedWork?.analyses?.length) return;
		setSelectedAnalysisId((prev) => {
			if (prev && selectedWork.analyses.some((analysis) => analysis.id === prev)) return prev;
			return selectedWork.analyses[0].id;
		});
	}, [selectedWork]);

	useEffect(() => {
		setIsAllScriptsOpen(timelineItems.length > 0);
	}, [timelineItems]);

	const totalSeconds = useMemo(() => parseDurationToSeconds(selectedWork?.duration), [selectedWork?.duration]);
	const actualSplitSegments = useMemo(() => buildActualSplitSegments(videoInfo?.segments ?? []), [videoInfo?.segments]);
	const actualSplitPoints = useMemo(
		() =>
			actualSplitSegments
				.slice(0, -1)
				.map((segment) => Math.round(toPercent(segment.end, totalSeconds))),
		[actualSplitSegments, totalSeconds],
	);
	useEffect(() => {
		if (!actualSplitPoints.length) return;
		setSplitPoints((prev) => {
			if (prev.length === actualSplitPoints.length && prev.every((point, index) => point === actualSplitPoints[index])) {
				return prev;
			}
			return actualSplitPoints;
		});
	}, [actualSplitPoints]);
	const splitSegments = useMemo(() => {
		const sortedPoints = [...splitPoints].sort((a, b) => a - b);
		const boundaries = [0, ...sortedPoints, 100];
		const sourceItems = timelineItems.length ? timelineItems : buildTimelineItems(selectedAnalysis, selectedWork?.duration ?? '-');

		return boundaries.slice(0, -1).map((start, index) => {
			const end = boundaries[index + 1];
			const baseItem = sourceItems[index % Math.max(sourceItems.length, 1)] ?? {
				id: `fallback-${index}`,
				topic: `구간 ${index + 1}`,
				summary: '분석 결과가 없습니다.',
				keywords: ['주제 없음'],
				script: '스크립트 정보가 없습니다.',
			};

			return {
				id: `${baseItem.id}-split-${index}`,
				order: index + 1,
				start,
				end,
				timeRange: `${interpolateTime(totalSeconds, start)} - ${interpolateTime(totalSeconds, end)}`,
				topic: reanalyzeCount > 0 ? `${baseItem.topic} 재분석` : baseItem.topic,
				summary:
					reanalyzeCount > 0
						? `${baseItem.summary} 조정된 분할 구간 스크립트를 기준으로 핵심 내용을 다시 정리했습니다.`
						: baseItem.summary,
				keywords:
					reanalyzeCount > 0
						? [...baseItem.keywords.slice(0, 2), '재분석 반영']
						: baseItem.keywords,
				script: baseItem.script,
			};
		});
	}, [reanalyzeCount, selectedAnalysis, selectedWork?.duration, splitPoints, timelineItems, totalSeconds]);
	const highlightedSegmentIndexes = useMemo(() => {
		if (selectedSplitPointIndex === null) return new Set<number>();
		return new Set([selectedSplitPointIndex, selectedSplitPointIndex + 1]);
	}, [selectedSplitPointIndex]);
	const selectedDownloadSegmentIdSet = useMemo(() => new Set(selectedDownloadSegmentIds), [selectedDownloadSegmentIds]);
	const selectedSplitPointValue = selectedSplitPointIndex === null ? null : splitPoints[selectedSplitPointIndex];
	const isServerSplitMode = actualSplitSegments.length > 0;
	const isSplitPointsModified = splitPoints.length !== actualSplitPoints.length || splitPoints.some((p, i) => p !== actualSplitPoints[i]);
	const displayedSplitSegments = isServerSplitMode && !isSplitPointsModified
		? actualSplitSegments.map((segment, index) => {
				const boundaries = [0, ...splitPoints, 100];
				return {
					...segment,
					startPercent: boundaries[index] ?? 0,
					endPercent: boundaries[index + 1] ?? 100,
				};
			})
		: splitSegments.map((segment) => ({
		...segment,
		startPercent: segment.start,
		endPercent: segment.end,
	}));
	const displayedSplitPoints = splitPoints;
	const isAllDownloadSegmentsSelected =
		isDownloadSelectionMode &&
		displayedSplitSegments.length > 0 &&
		selectedDownloadSegmentIds.length === displayedSplitSegments.length;

	const tabTitle = tab === 'script' ? '스크립트 편집 영역' : '수동 분할 편집 영역';
	const resolvedVideoUrl = videoInfo?.gcs_view_link || selectedWork?.videoUrl;
	const resolvedThumbnailUrl = videoInfo?.thumbnail_url || selectedWork?.thumbnailUrl;
	const summaryText = videoInfo?.summary || selectedAnalysis?.briefing || '요약 정보가 없습니다.';
	const summaryKeywords = videoInfo?.keywords?.length ? videoInfo.keywords : selectedAnalysis?.keywords ?? [];
	const summaryPromptLabel = selectedAnalysis?.promptLabel || (videoInfo ? '서버 저장 결과' : '-');

	useEffect(() => {
		if (selectedSplitPointIndex === null) {
			setIsHighlightPulseOn(true);
			return;
		}

		const timer = window.setInterval(() => {
			setIsHighlightPulseOn((prev) => !prev);
		}, 700);

		return () => {
			window.clearInterval(timer);
		};
	}, [selectedSplitPointIndex]);

	const renderVideoBox = (compact = false, split = false) => (
		<VideoBox $compact={compact} $split={split}>
			{resolvedVideoUrl ? (
				<video controls preload="metadata" poster={resolvedThumbnailUrl}>
					<source src={resolvedVideoUrl} />
				</video>
			) : isConverting ? (
				<EmptyText>원본 영상을 준비 중입니다. 분석 완료 후 재생할 수 있습니다.</EmptyText>
			) : (
				<EmptyText>원본 영상 미리보기 영역</EmptyText>
			)}
		</VideoBox>
	);
	const handleDownloadScripts = () => {
		confirm({
			message: '스크립트를 다운로드 하시겠습니까?',
			okHandler: () => {
				closeConfirm();
			},
		});
	};
	const handleSplitPointChange = (index: number, nextValue: number) => {
		setSplitPoints((prev) => {
			const next = [...prev];
			const min = index === 0 ? 8 : prev[index - 1] + 8;
			const max = index === prev.length - 1 ? 92 : prev[index + 1] - 8;
			next[index] = Math.min(Math.max(nextValue, min), max);
			return next;
		});
	};
	const handleResetSplit = () => {
		const original = actualSplitPoints.length ? actualSplitPoints : [33, 66];
		setSplitPoints(original);
		setReanalyzeCount(0);
		setSelectedSplitPointIndex(null);
	};
	const handleAddSplitPoint = () => {
		setSplitPoints((prev) => {
			if (prev.length >= 7) return prev;
			const boundaries = [0, ...prev, 100].sort((a, b) => a - b);
			let widestIndex = 0;
			let widestGap = 0;

			for (let index = 0; index < boundaries.length - 1; index += 1) {
				const gap = boundaries[index + 1] - boundaries[index];
				if (gap > widestGap) {
					widestGap = gap;
					widestIndex = index;
				}
			}

			const nextPoint = Math.round((boundaries[widestIndex] + boundaries[widestIndex + 1]) / 2);
			const next = [...prev, nextPoint].sort((a, b) => a - b);
			setSelectedSplitPointIndex(next.findIndex((point) => point === nextPoint));
			return next;
		});
	};
	const handleDeleteSplitPoint = () => {
		if (selectedSplitPointIndex === null) return;
		setSplitPoints((prev) => prev.filter((_, index) => index !== selectedSplitPointIndex));
		setSelectedSplitPointIndex(null);
	};
	const handleReanalyze = () => {
		confirm({
			message: '토큰을 사용해 새로운 분석을 진행하시겠습니까?',
			okHandler: () => {
				const sortedPoints = [...splitPoints].sort((a, b) => a - b);
				const boundaries = [0, ...sortedPoints, 100];
				const segments = boundaries.slice(0, -1).map((startPct, index) => {
					const endPct = boundaries[index + 1];
					return {
						segment_no: index + 1,
						start_time: formatSeconds(Math.round((totalSeconds * startPct) / 100)),
						end_time: formatSeconds(Math.round((totalSeconds * endPct) / 100)),
					};
				});
				console.log('[재분석 요청]', { video_id: videoId, segments });
				setReanalyzeCount((prev) => prev + 1);
				closeConfirm();
				successToast('재분석 요청이 전송되었습니다. (console 확인)');
			},
		});
	};
	const handleDownloadSplit = () => {
		if (!(videoInfo?.segments?.length && displayedSplitSegments.length)) {
			errorToast('다운로드할 분할 결과가 없습니다.');
			return;
		}
		setIsDownloadSelectionMode(true);
		setSelectedDownloadSegmentIds([]);
		infoToast('프리뷰에서 다운로드할 구간을 선택해 주세요.');
	};
	const handleCancelSplitDownloadSelection = () => {
		setIsDownloadSelectionMode(false);
		setSelectedDownloadSegmentIds([]);
	};
	const handleToggleDownloadSegment = (segmentId: string) => {
		if (!isDownloadSelectionMode) return;
		setSelectedDownloadSegmentIds((prev) =>
			prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : [...prev, segmentId],
		);
	};
	const handleToggleAllDownloadSegments = () => {
		if (!isDownloadSelectionMode) return;
		if (isAllDownloadSegmentsSelected) {
			setSelectedDownloadSegmentIds([]);
			return;
		}
		setSelectedDownloadSegmentIds(displayedSplitSegments.map((segment) => segment.id));
	};
	const handleOpenThumbnailModal = () => {
		custom({
			children: <AddThumbnailModal onSelectThumbnail={handleSelectThumbnail} onClose={closeFreeModal} />,
		});
	};
	const handleSelectThumbnail = async (imgFile?: File) => {
		try {
			if (!imgFile) {
				setSelectedThumbnailImage(undefined);
				infoToast('기본 썸네일 없이 진행합니다.');
				return;
			}

			const imageDataUrl = await readFileAsDataUrl(imgFile);
			if (!imageDataUrl) {
				throw new Error('Empty image data');
			}

			setSelectedThumbnailImage(imageDataUrl);
			successToast('썸네일 이미지가 적용되었습니다.');
		} catch (error) {
			console.error('[Thumbnail] failed to read image', error);
			errorToast('썸네일 이미지를 불러오지 못했습니다.');
		}
	};
	const handleConfirmSplitDownload = async () => {
		if (!videoId) return;
		if (!selectedDownloadSegmentIds.length) {
			errorToast('다운로드할 구간을 선택해 주세요.');
			return;
		}

		const selectedSegments = displayedSplitSegments.filter((segment) => selectedDownloadSegmentIdSet.has(segment.id));

		if (!selectedSegments.length) {
			errorToast('선택한 구간 정보를 찾을 수 없습니다.');
			return;
		}

		console.log('[분할 영상 다운로드 요청]', {
			video_id: videoId,
			segments: selectedSegments.map((segment, index) => ({
				segment_no: index + 1,
				start_time: segment.timeRange.split(' - ')[0],
				end_time: segment.timeRange.split(' - ')[1],
				title: segment.topic,
			})),
			thumbnail_image: selectedThumbnailImage ? '(이미지 데이터 포함)' : undefined,
		});

		successToast(`${selectedSegments.length}개 구간 다운로드 요청이 전송되었습니다. (console 확인)`);
		handleCancelSplitDownloadSelection();
	};

	useEffect(() => {
		if (draggingFlagIndex === null) return;

		const handlePointerMove = (event: MouseEvent) => {
			if (!splitRailRef.current) return;
			const rect = splitRailRef.current.getBoundingClientRect();
			const rawPercent = ((event.clientX - rect.left) / rect.width) * 100;
			handleSplitPointChange(draggingFlagIndex, Math.round(rawPercent));
		};

		const handlePointerUp = () => {
			setDraggingFlagIndex(null);
		};

		window.addEventListener('mousemove', handlePointerMove);
		window.addEventListener('mouseup', handlePointerUp);

		return () => {
			window.removeEventListener('mousemove', handlePointerMove);
			window.removeEventListener('mouseup', handlePointerUp);
		};
	}, [draggingFlagIndex]);

	useEffect(() => {
		if (!isDownloadSelectionMode) return;
		const availableSegmentIds = new Set(displayedSplitSegments.map((segment) => segment.id));
		setSelectedDownloadSegmentIds((prev) => prev.filter((id) => availableSegmentIds.has(id)));
	}, [displayedSplitSegments, isDownloadSelectionMode]);

	useEffect(() => {
		const handleDocumentMouseDown = (event: MouseEvent) => {
			const target = event.target as HTMLElement | null;
			if (!target) return;
			if (target.closest('[data-split-flag="true"]')) return;
			if (target.closest('[data-split-delete="true"]')) return;
			setSelectedSplitPointIndex(null);
		};

		window.addEventListener('mousedown', handleDocumentMouseDown);

		return () => {
			window.removeEventListener('mousedown', handleDocumentMouseDown);
		};
	}, []);

	return (
		<Wrap $summaryTab={tab === 'summary'} $summaryExpanded={tab === 'summary' && isTimelineExpanded}>
			{tab === 'summary' ? (
				selectedAnalysis ? (
					<>
						<SummaryTopSection>
							<SummaryHero>
								{renderVideoBox(true)}

								<TotalSummaryCard>
									<SectionTitle>전체 영상 요약</SectionTitle>
									<SummaryCardTextFrame>
										<SummaryCardTextScrollArea
											defer
											options={{
												scrollbars: {
													autoHide: 'leave',
													autoHideDelay: 180,
													theme: 'os-theme-genova-subtle',
												},
											}}
										>
											<SummaryText>{summaryText}</SummaryText>
										</SummaryCardTextScrollArea>
									</SummaryCardTextFrame>
									<SummaryCardMetaArea>
										<MetaRow>프롬프트: {summaryPromptLabel}</MetaRow>
										<TagRow>
											{summaryKeywords.length
												? summaryKeywords.map((keyword, index) => <Tag key={`tag-${index}-${keyword}`}>{keyword}</Tag>)
												: <EmptyText>키워드 없음</EmptyText>}
										</TagRow>
									</SummaryCardMetaArea>
								</TotalSummaryCard>
							</SummaryHero>
						</SummaryTopSection>

						<TimelineCard $expanded={isTimelineExpanded}>
							<TimelineHeader>
								<SectionTitle>타임라인</SectionTitle>
								<TimelineHeaderActions>
									<TimelineToggleButton
										type="button"
										onClick={() => setIsTimelineExpanded((prev) => !prev)}
										aria-label={isTimelineExpanded ? '타임라인 축소' : '타임라인 확장'}
									>
										{isTimelineExpanded ? '축소' : '확장'}
									</TimelineToggleButton>
									<TimelineHeaderButton type="button" onClick={() => setIsAllScriptsOpen((prev) => !prev)}>
										스크립트
									</TimelineHeaderButton>
									<TimelineHeaderButton type="button" onClick={handleDownloadScripts}>
										다운로드
									</TimelineHeaderButton>
								</TimelineHeaderActions>
							</TimelineHeader>
							<TimelineList
								$expanded={isTimelineExpanded}
								defer
								options={{
									scrollbars: {
										autoHide: isTimelineExpanded ? 'never' : 'leave',
										autoHideDelay: 180,
										theme: 'os-theme-genova',
									},
								}}
							>
								<TimelineListInner>
									{timelineItems.map((item) => (
										<TimelineItemCard key={item.id}>
											<TimelineTop>
												<TimelineMeta>
													<small>{item.timeRange}</small>
													<strong>{item.topic}</strong>
												</TimelineMeta>
											</TimelineTop>
											<TimelineKeywordRow>
												{item.keywords.map((keyword) => (
													<TimelineKeyword key={`${item.id}-${keyword}`}>{keyword}</TimelineKeyword>
												))}
											</TimelineKeywordRow>
											<TimelineSummary>{item.summary}</TimelineSummary>
											<TimelineScriptPanel $open={isAllScriptsOpen}>
												<TimelineScriptInner>
													<TimelineScriptTitle>스크립트</TimelineScriptTitle>
													<TimelineScriptText>{item.script}</TimelineScriptText>
												</TimelineScriptInner>
											</TimelineScriptPanel>
										</TimelineItemCard>
									))}
								</TimelineListInner>
							</TimelineList>
						</TimelineCard>
					</>
				) : (
					<ContentBox>
						<EmptyText>선택된 분석이 없습니다.</EmptyText>
					</ContentBox>
				)
			) : tab === 'split' ? (
				<>
						<SplitLayout>
							<SplitPrimaryCard>
									<SplitCardHeader>
										<div>
											<SectionTitle>영상 분할</SectionTitle>
											<SplitDescription>재생 바의 분할 포인트를 조정한 뒤 재분석하거나, 현재 구간 그대로 분할 다운로드할 수 있습니다.</SplitDescription>
										</div>
									</SplitCardHeader>

								<SplitPrimaryMediaBlock>
									{renderVideoBox(false, true)}

									<SplitRailCard>
								<SplitRailHeader>
									<SplitRailHeaderText>
										<strong>분할 타임라인</strong>
										<span>마커를 이동해 구간 경계를 조정합니다.</span>
									</SplitRailHeaderText>
											<SplitHeaderActions>
												<SplitBadge>{splitSegments.length}개 구간</SplitBadge>
												<SplitIconButton type="button" onClick={handleAddSplitPoint} disabled={splitPoints.length >= 7}>
													추가
												</SplitIconButton>
												<SplitDeleteButton
													type="button"
													data-split-delete="true"
													onClick={handleDeleteSplitPoint}
													disabled={selectedSplitPointIndex === null}
												>
													삭제
												</SplitDeleteButton>
												<SplitIconButton type="button" onClick={handleResetSplit} aria-label="초기화">
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
														<path d="M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C14.76 3 17.22 4.27 18.85 6.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
														<path d="M19 2.5V6.5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
													</svg>
												</SplitIconButton>
											</SplitHeaderActions>
								</SplitRailHeader>
								<SplitRailArea ref={splitRailRef}>
									<SplitRailTrack>
										<SplitRailBase />
										{displayedSplitSegments.map((segment, index) => (
											<SplitRailSegment
												key={segment.id}
												$left={segment.startPercent}
												$width={Math.max(segment.endPercent - segment.startPercent, 4)}
												$index={index}
												$isFirst={index === 0}
												$isLast={index === displayedSplitSegments.length - 1}
												$highlighted={highlightedSegmentIndexes.has(index)}
											/>
										))}
									</SplitRailTrack>
									{displayedSplitPoints.map((point, index) => (
										<SplitFlag
											key={`flag-${index}`}
											style={{ left: `calc(${point}% - ${unit(7)})` }}
													data-split-flag="true"
													onMouseDown={() => {
														setDraggingFlagIndex(index);
														setSelectedSplitPointIndex(index);
													}}
													$active={selectedSplitPointIndex === index}
												>
													<SplitFlagPill $index={index} $active={selectedSplitPointIndex === index} />
												</SplitFlag>
											))}
										</SplitRailArea>
										<SplitFlagTimeRow>
											{displayedSplitPoints.map((point, index) => (
												<SplitFlagTimeLabel
													key={`time-${index}`}
													style={{ left: `calc(${point}% - ${unit(18)})` }}
													$active={selectedSplitPointIndex === index}
												>
													{interpolateTime(totalSeconds, point)}
												</SplitFlagTimeLabel>
											))}
										</SplitFlagTimeRow>
									</SplitRailCard>
								</SplitPrimaryMediaBlock>
							</SplitPrimaryCard>

						<SplitSidebar>
							<SplitSecondaryCard>
								<SplitCardHeader>
									<div>
										<SectionTitle>프리뷰</SectionTitle>
										<SplitDescription>구간별 시간과 핵심 내용을 빠르게 검토하고 필요한 결과를 바로 확인할 수 있습니다.</SplitDescription>
									</div>
									{isDownloadSelectionMode ? (
										<SplitHeaderActions>
											<SplitIconButton type="button" onClick={handleToggleAllDownloadSegments}>
												{isAllDownloadSegmentsSelected ? '전체 해제' : '전체 선택'}
											</SplitIconButton>
										</SplitHeaderActions>
									) : null}
								</SplitCardHeader>
								<SplitSegmentList
									options={{
										scrollbars: {
											autoHide: 'leave',
											autoHideDelay: 180,
										},
									}}
								>
									<SplitSegmentListInner>
										{displayedSplitSegments.map((segment, index) => (
											<SplitSegmentCard
												key={segment.id}
												$highlighted={highlightedSegmentIndexes.has(index)}
												$pulseOn={isHighlightPulseOn}
												$selected={selectedDownloadSegmentIdSet.has(segment.id)}
												$selectable={isDownloadSelectionMode}
												onClick={() => handleToggleDownloadSegment(segment.id)}
											>
												<SplitSegmentTop>
													<SplitSegmentOrder $index={segment.order - 1}>구간 {segment.order}</SplitSegmentOrder>
													<SplitSegmentTime>
														<SplitSegmentStamp $highlighted={segment.startPercent === selectedSplitPointValue}>
															{interpolateTime(totalSeconds, segment.startPercent)}
														</SplitSegmentStamp>
														<span> - </span>
														<SplitSegmentStamp $highlighted={segment.endPercent === selectedSplitPointValue}>
															{interpolateTime(totalSeconds, segment.endPercent)}
														</SplitSegmentStamp>
													</SplitSegmentTime>
												</SplitSegmentTop>
												<SplitSegmentTitle>{segment.topic}</SplitSegmentTitle>
												<TimelineKeywordRow>
													{segment.keywords.map((keyword) => (
														<TimelineKeyword key={`${segment.id}-${keyword}`}>{keyword}</TimelineKeyword>
													))}
												</TimelineKeywordRow>
												<TimelineSummary>{segment.summary}</TimelineSummary>
											</SplitSegmentCard>
										))}
									</SplitSegmentListInner>
								</SplitSegmentList>
							</SplitSecondaryCard>

							<SplitActionBar>
								<SplitSecondaryButton type="button" onClick={handleReanalyze}>
									재분석
								</SplitSecondaryButton>
								<SplitSecondaryButton type="button" onClick={handleOpenThumbnailModal}>
									썸네일 추가
								</SplitSecondaryButton>
								{isDownloadSelectionMode ? (
									<>
										<SplitGhostButton type="button" onClick={handleCancelSplitDownloadSelection}>
											취소
										</SplitGhostButton>
										<SplitPrimaryButton
											type="button"
											onClick={handleConfirmSplitDownload}
											disabled={!selectedDownloadSegmentIds.length}
										>
											{selectedDownloadSegmentIds.length}개 다운로드
										</SplitPrimaryButton>
									</>
								) : (
									<SplitPrimaryButton type="button" onClick={handleDownloadSplit}>
										분할 다운로드
									</SplitPrimaryButton>
								)}
							</SplitActionBar>
						</SplitSidebar>
					</SplitLayout>
				</>
			) : (
				<>
					{renderVideoBox()}
					<ContentBox>
						<h3>{tabTitle}</h3>
						{timelineItems.length ? (
							<TimelineList>
								{timelineItems.map((item) => (
									<TimelineItemCard key={item.id}>
										<TimelineTop>
											<TimelineMeta>
												<small>{item.timeRange}</small>
												<strong>{item.topic}</strong>
											</TimelineMeta>
										</TimelineTop>
										<TimelineKeywordRow>
											{item.keywords.map((keyword) => (
												<TimelineKeyword key={`${item.id}-${keyword}`}>{keyword}</TimelineKeyword>
											))}
										</TimelineKeywordRow>
										<TimelineScriptPanel $open>
											<TimelineScriptInner>
												<TimelineScriptTitle>실제 스크립트</TimelineScriptTitle>
												<TimelineScriptText>{item.script}</TimelineScriptText>
											</TimelineScriptInner>
										</TimelineScriptPanel>
									</TimelineItemCard>
								))}
							</TimelineList>
						) : (
							<Placeholder>
								<p>스크립트 결과가 아직 없습니다.</p>
								<span>분석 완료 후 서버에 저장된 스크립트가 여기에 표시됩니다.</span>
							</Placeholder>
						)}
					</ContentBox>
				</>
			)}
		</Wrap>
	);
}

const Wrap = styled.main<{ $summaryTab?: boolean; $summaryExpanded?: boolean }>`
	display: ${({ $summaryTab }) => ($summaryTab ? 'grid' : 'flex')};
	flex-direction: column;
	gap: ${unit(16)};
	height: ${({ $summaryTab, $summaryExpanded }) => ($summaryTab ? ($summaryExpanded ? 'auto' : '100%') : '100%')};
	min-height: ${({ $summaryTab }) => ($summaryTab ? '100%' : '0')};
	overflow: visible;
	align-content: start;
	grid-template-rows: ${({ $summaryTab, $summaryExpanded }) =>
		$summaryTab ? `${unit(430)} ${$summaryExpanded ? 'auto' : `minmax(${unit(250)}, 1fr)`}` : 'none'};
`;

const VideoBox = styled.article<{ $compact?: boolean; $split?: boolean }>`
	border-radius: ${unit(14)};
	background: rgba(244, 247, 252, 1);
	min-height: ${({ $compact, $split }) => ($compact ? '0' : $split ? unit(220) : 'auto')};
	aspect-ratio: ${({ $split }) => ($split ? '16 / 9' : 'auto')};
	width: ${({ $split }) => ($split ? `min(100%, ${unit(740)})` : '100%')};
	max-height: ${({ $compact }) => ($compact ? '100%' : 'none')};
	padding: ${unit(12)};
	height: ${({ $compact }) => ($compact ? '100%' : 'auto')};
	border: 1px solid rgba(223, 230, 240, 1);
	overflow: hidden;
	align-self: ${({ $split }) => ($split ? 'center' : 'stretch')};

	video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: ${unit(10)};
		background: black;
	}
`;

const SummaryTopSection = styled.section`
	flex: 0 0 ${unit(430)};
	height: ${unit(430)};
	min-height: ${unit(430)};
	max-height: ${unit(430)};
	flex-shrink: 0;
	overflow: hidden;
	width: 100%;

	@media screen and (max-width: 1180px) {
		flex: none;
		height: auto;
		min-height: 0;
		max-height: none;
		overflow: visible;
	}
`;

const ContentBox = styled.section`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	background: white;
	padding: ${unit(16)};
	min-height: ${unit(280)};
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};

	h3 {
		font-size: ${unit(18)};
		font-weight: 700;
		color: rgba(35, 52, 86, 1);
	}
`;

const SplitLayout = styled.section`
	display: grid;
	grid-template-columns: minmax(0, 0.95fr) minmax(${unit(420)}, 1.05fr);
	gap: ${unit(16)};
	height: 100%;
	min-height: 0;

	@media screen and (max-width: 1180px) {
		grid-template-columns: 1fr;
	}
`;

const SplitPrimaryCard = styled.section`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	background: white;
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: ${unit(16)};
	min-height: 0;
`;

const SplitSecondaryCard = styled(SplitPrimaryCard)`
	background: rgba(249, 251, 255, 1);
	min-height: 0;
`;

const SplitPrimaryMediaBlock = styled.div`
	width: min(100%, ${unit(740)});
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	gap: ${unit(16)};
	margin: 0 auto;
`;

const SplitSidebar = styled.section`
	display: flex;
	flex-direction: column;
	gap: ${unit(16)};
	min-height: 0;
	width: 100%;
`;

const SplitCardHeader = styled.div`
	width: 100%;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: ${unit(12)};
`;

const SplitHeaderActions = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
	flex-wrap: wrap;
	justify-content: flex-end;
`;

const SplitRailHeaderText = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(4)};
`;

const SplitDescription = styled.p`
	margin-top: ${unit(6)};
	font-size: ${unit(14)};
	line-height: ${unit(23)};
	color: rgba(95, 109, 137, 1);
`;

const SplitBadge = styled.span`
	font-size: ${unit(13)};
	font-weight: 700;
	color: rgba(94, 109, 137, 1);
	white-space: nowrap;
`;

const SplitIconButton = styled.button`
	border: 1px solid rgba(186, 203, 233, 1);
	background: rgba(246, 249, 255, 1);
	color: rgba(51, 78, 132, 1);
	border-radius: ${unit(999)};
	min-width: ${unit(52)};
	height: ${unit(36)};
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0 ${unit(14)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;

	&:hover:not(:disabled) {
		border-color: rgba(149, 176, 223, 1);
		background: rgba(236, 243, 255, 1);
		color: rgba(41, 85, 168, 1);
	}

	&:disabled {
		opacity: 0.45;
		cursor: default;
	}
`;

const SplitDeleteButton = styled.button`
	border: 1px solid rgba(217, 226, 239, 1);
	background: white;
	color: rgba(94, 109, 137, 1);
	border-radius: ${unit(999)};
	padding: ${unit(8)} ${unit(13)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;

	&:hover:not(:disabled) {
		border-color: rgba(196, 94, 94, 1);
		background: rgba(255, 245, 245, 1);
		color: rgba(173, 56, 56, 1);
	}

	&:disabled {
		opacity: 0.45;
		cursor: default;
	}

	&:not(:disabled) {
		border-color: rgba(196, 94, 94, 1);
		color: rgba(173, 56, 56, 1);
	}
`;

const SplitRailCard = styled.section`
	width: min(100%, ${unit(740)});
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	background: rgba(247, 250, 255, 1);
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	gap: ${unit(16)};
`;

const SplitRailHeader = styled.div`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: ${unit(12)};
	margin-bottom: ${unit(10)};

	strong {
		font-size: ${unit(15)};
		font-weight: 700;
		color: rgba(29, 46, 82, 1);
	}

	span {
		font-size: ${unit(13)};
		color: rgba(99, 113, 141, 1);
	}
`;

const SplitRailArea = styled.div`
	position: relative;
	height: ${unit(56)};
	padding-top: ${unit(18)};
`;

const SplitRailTrack = styled.div`
	position: absolute;
	left: 0;
	right: 0;
	top: ${unit(36)};
	height: ${unit(12)};
	border-radius: ${unit(999)};
	overflow: hidden;
`;

const SplitRailBase = styled.div`
	position: absolute;
	inset: 0;
	background: linear-gradient(90deg, rgba(231, 238, 249, 1) 0%, rgba(212, 224, 243, 1) 100%);
	box-shadow: inset 0 0 0 1px rgba(202, 214, 233, 1);
`;

const SplitRailSegment = styled.div<{ $left: number; $width: number; $index: number; $isFirst: boolean; $isLast: boolean; $highlighted: boolean }>`
	position: absolute;
	top: 0;
	left: ${({ $left }) => `${$left}%`};
	width: ${({ $width }) => `${$width}%`};
	height: ${unit(12)};
	border-radius: ${({ $isFirst, $isLast }) => {
		if ($isFirst) return `${unit(999)} 0 0 ${unit(999)}`;
		if ($isLast) return `0 ${unit(999)} ${unit(999)} 0`;
		return '0';
	}};
	background: ${({ $index }) => SPLIT_SEGMENT_COLORS[$index % SPLIT_SEGMENT_COLORS.length].bar};
	box-shadow: ${({ $highlighted, $index }) =>
		$highlighted
			? `0 0 ${unit(2)} ${unit(2)} ${SPLIT_SEGMENT_COLORS[$index % SPLIT_SEGMENT_COLORS.length].glow}`
			: 'none'};
	transition: box-shadow 0.2s ease, opacity 0.2s ease;
	opacity: ${({ $highlighted }) => ($highlighted ? 1 : 0.92)};
`;

const splitFlagBounce = keyframes`
	0%, 100% { transform: translate3d(0, 0, 0); }
	50% { transform: translate3d(0, ${unit(-5)}, 0); }
`;

const SplitFlag = styled.div<{ $active: boolean }>`
	position: absolute;
	top: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	cursor: pointer;
	user-select: none;
	transition: opacity 0.18s ease;
	opacity: ${({ $active }) => ($active ? 1 : 0.88)};
	animation: ${splitFlagBounce} 0.9s ease-in-out infinite;
	animation-play-state: ${({ $active }) => ($active ? 'running' : 'paused')};
	will-change: transform;
	&:hover {
		opacity: 1;
	}
	&:active {
		cursor: grabbing;
	}
`;

const SplitFlagPill = styled.span<{ $index: number; $active: boolean }>`
	width: ${unit(14)};
	height: ${unit(22)};
	display: block;
	background: ${({ $index }) => SPLIT_SEGMENT_COLORS[$index % SPLIT_SEGMENT_COLORS.length].chipText};
	clip-path: polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%);
	box-shadow: ${({ $active, $index }) =>
		$active ? `0 0 ${unit(2)} ${unit(2)} ${SPLIT_SEGMENT_COLORS[$index % SPLIT_SEGMENT_COLORS.length].glow}` : 'none'};
	transition: box-shadow 0.2s ease, opacity 0.2s ease;
`;

const SplitFlagTimeRow = styled.div`
	position: relative;
	height: ${unit(20)};
	margin-top: ${unit(-2)};
`;

const SplitFlagTimeLabel = styled.span<{ $active: boolean }>`
	position: absolute;
	font-size: ${({ $active }) => ($active ? unit(16) : unit(14))};
	font-weight: 700;
	color: ${({ $active }) => ($active ? 'rgba(52, 92, 175, 1)' : 'rgba(82, 97, 125, 1)')};
	transition: color 0.2s ease, font-size 0.2s ease;
`;

const SplitSegmentList = styled(OverlayScrollbarsComponent)`
	flex: 1;
	min-height: 0;

	.os-content {
		padding: ${unit(8)} ${unit(12)} ${unit(10)} ${unit(8)};
	}

	.os-scrollbar {
		--os-size: ${unit(8)};
		--os-padding-axis: ${unit(2)};
		--os-handle-bg: linear-gradient(180deg, rgba(128, 160, 219, 1) 0%, rgba(84, 121, 195, 1) 100%);
		--os-handle-bg-hover: linear-gradient(180deg, rgba(146, 176, 228, 1) 0%, rgba(97, 134, 207, 1) 100%);
		--os-handle-bg-active: linear-gradient(180deg, rgba(110, 145, 211, 1) 0%, rgba(76, 111, 184, 1) 100%);
		--os-track-bg: rgba(232, 238, 248, 0.92);
	}

	.os-scrollbar-handle {
		border-radius: ${unit(999)};
	}
`;

const SplitSegmentListInner = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(16)};
`;

const SplitSegmentCard = styled.article<{ $highlighted: boolean; $pulseOn: boolean; $selected: boolean; $selectable: boolean }>`
	border: 1px solid
		${({ $selected, $highlighted, $pulseOn }) =>
			$selected
				? 'rgba(32, 81, 181, 1)'
				: $highlighted
					? $pulseOn
						? 'rgba(84, 140, 232, 0.9)'
						: 'rgba(84, 140, 232, 0.5)'
					: 'rgba(217, 226, 239, 1)'};
	border-radius: ${unit(12)};
	background: ${({ $selected }) => ($selected ? 'rgba(240, 246, 255, 1)' : 'white')};
	padding: ${unit(16)};
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
	cursor: ${({ $selectable }) => ($selectable ? 'pointer' : 'default')};
	box-shadow: ${({ $selected }) => ($selected ? `0 ${unit(4)} ${unit(10)} rgba(32, 81, 181, 0.4)` : 'none')};
	transition: border-color 0.3s ease-in-out, background-color 0.2s ease, transform 0.2s ease;

	&:hover {
		border-color: ${({ $selectable, $selected }) =>
			$selectable ? ($selected ? 'rgba(32, 81, 181, 1)' : 'rgba(121, 156, 226, 1)') : undefined};
		transform: ${({ $selectable }) => ($selectable ? 'translateY(-1px)' : 'none')};
	}
`;

const SplitSegmentTop = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(10)};
`;

const SplitSegmentOrder = styled.span<{ $index: number }>`
	font-size: ${unit(13)};
	font-weight: 700;
	color: ${({ $index }) => SPLIT_SEGMENT_COLORS[$index % SPLIT_SEGMENT_COLORS.length].chipText};
	background: ${({ $index }) => SPLIT_SEGMENT_COLORS[$index % SPLIT_SEGMENT_COLORS.length].chipBg};
	border: 1px solid ${({ $index }) => SPLIT_SEGMENT_COLORS[$index % SPLIT_SEGMENT_COLORS.length].chipBorder};
	padding: ${unit(5)} ${unit(9)};
	border-radius: ${unit(999)};
`;

const SplitSegmentTime = styled.span`
	display: inline-flex;
	align-items: center;
	gap: ${unit(3)};
	font-size: ${unit(13)};
	color: rgba(99, 113, 141, 1);
	font-weight: 600;
`;

const SplitSegmentStamp = styled.span<{ $highlighted: boolean }>`
	font-size: ${({ $highlighted }) => ($highlighted ? unit(15) : unit(13))};
	color: ${({ $highlighted }) => ($highlighted ? 'rgba(52, 92, 175, 1)' : 'rgba(99, 113, 141, 1)')};
	font-weight: ${({ $highlighted }) => ($highlighted ? 800 : 600)};
	transition: font-size 0.2s ease, color 0.2s ease, font-weight 0.2s ease;
`;

const SplitSegmentTitle = styled.strong`
	font-size: ${unit(18)};
	font-weight: 700;
	color: rgba(29, 46, 82, 1);
`;

const SplitScriptPreview = styled.div`
	border-top: 1px solid rgba(229, 235, 244, 1);
	padding-top: ${unit(12)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const SplitScriptLabel = styled.span`
	font-size: ${unit(13)};
	font-weight: 700;
	color: rgba(86, 101, 129, 1);
`;

const SplitActionBar = styled.div`
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: ${unit(10)};
	width: 100%;
	align-self: flex-end;
`;

const SplitButtonBase = styled.button`
	border-radius: ${unit(999)};
	padding: ${unit(11)} ${unit(18)};
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

	&:disabled {
		opacity: 0.5;
		cursor: default;
		box-shadow: none;
	}
`;

const SplitGhostButton = styled(SplitButtonBase)`
	border: 1px solid rgba(205, 216, 234, 1);
	background: white;
	color: rgba(75, 92, 124, 1);

	&:hover {
		border-color: rgba(178, 194, 221, 1);
		background: rgba(247, 250, 255, 1);
	}
`;

const SplitSecondaryButton = styled(SplitButtonBase)`
	border: 1px solid rgba(186, 203, 233, 1);
	background: rgba(246, 249, 255, 1);
	color: rgba(51, 78, 132, 1);

	&:hover {
		border-color: rgba(149, 176, 223, 1);
		background: rgba(236, 243, 255, 1);
		box-shadow: 0 ${unit(4)} ${unit(10)} rgba(40, 70, 130, 0.08);
	}
`;

const SplitPrimaryButton = styled(SplitButtonBase)`
	border: 1px solid rgba(26, 43, 89, 1);
	background: rgba(26, 43, 89, 1);
	color: white;

	&:hover:not(:disabled) {
		background: rgba(35, 57, 110, 1);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(26, 43, 89, 0.22);
	}
`;

const SummaryHero = styled.section`
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(${unit(430)}, 0.98fr);
	column-gap: ${unit(15)};
	height: 100%;
	min-height: 0;
	flex-shrink: 0;
	align-items: stretch;

	@media screen and (max-width: 1180px) {
		grid-template-columns: 1fr;
		flex: none;
		height: auto;
	}
`;

const SummaryCardBase = styled.section`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	background: white;
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	min-height: 0;
`;

const TotalSummaryCard = styled(SummaryCardBase)`
	height: 100%;
`;

const SummaryCardTextFrame = styled.div`
	position: relative;
	display: flex;
	flex: 1;
	min-height: 0;
	margin-top: ${unit(10)};
	border: 1px solid rgba(239, 239, 239, 1);
	border-radius: ${unit(10)};
	background: white;
	overflow: hidden;

	&::before,
	&::after {
		content: '';
		position: absolute;
		left: 0;
		right: ${unit(8)};
		height: ${unit(10)};
		pointer-events: none;
		z-index: 2;
	}

	&::before {
		top: 0;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0) 100%);
	}

	&::after {
		bottom: 0;
		background: linear-gradient(0deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0) 100%);
	}
`;

const SummaryCardTextScrollArea = styled(OverlayScrollbarsComponent)`
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	padding: ${unit(10)};

	.os-content {
		padding: ${unit(14)} ${unit(16)} ${unit(14)} ${unit(14)};
	}

	.os-scrollbar {
		--os-size: ${unit(6)};
		--os-padding-axis: ${unit(2)};
		--os-handle-bg: rgba(157, 176, 211, 1);
		--os-handle-bg-hover: rgba(141, 163, 202, 1);
		--os-handle-bg-active: rgba(121, 145, 189, 1);
		--os-track-bg: rgba(236, 241, 249, 0.92);
	}
`;

const SummaryCardMetaArea = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(14)};
	flex-shrink: 0;
	padding-top: ${unit(10)};
`;

const TimelineCard = styled(SummaryCardBase)<{ $expanded: boolean }>`
	background: rgba(249, 251, 255, 1);
	flex: ${({ $expanded }) => ($expanded ? 'none' : '1 1 auto')};
	height: ${({ $expanded }) => ($expanded ? 'auto' : '100%')};
	min-height: ${({ $expanded }) => ($expanded ? unit(620) : unit(250))};
	max-height: ${({ $expanded }) => ($expanded ? 'none' : '100%')};
	overflow: hidden;
	flex-shrink: 0;
	align-self: stretch;
	box-shadow: ${({ $expanded }) => ($expanded ? `0 ${unit(14)} ${unit(28)} rgba(35, 67, 128, 0.08)` : 'none')};
	transition: height 0.28s ease, box-shadow 0.28s ease;
`;

const TimelineHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(12)};
	margin-bottom: ${unit(14)};
`;

const SectionTitle = styled.h3`
	font-size: ${unit(20)};
	font-weight: 700;
	color: rgba(35, 52, 86, 1);
`;

const TimelineHeaderActions = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
`;

const TimelineToggleButton = styled.button`
	border: 1px solid rgba(205, 216, 234, 1);
	background: white;
	color: rgba(75, 92, 124, 1);
	border-radius: ${unit(999)};
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: ${unit(7)} ${unit(14)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

	&:hover {
		border-color: rgba(160, 181, 220, 1);
		background: rgba(247, 250, 255, 1);
		color: rgba(56, 79, 123, 1);
		box-shadow: 0 ${unit(4)} ${unit(10)} rgba(40, 70, 130, 0.08);
		transform: translateY(${unit(-1)});
	}
`;

const TimelineHeaderButton = styled.button`
	border: 1px solid rgba(205, 216, 234, 1);
	background: white;
	color: rgba(75, 92, 124, 1);
	border-radius: ${unit(999)};
	padding: ${unit(7)} ${unit(14)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		border-color: rgba(160, 181, 220, 1);
		background: rgba(247, 250, 255, 1);
		color: rgba(56, 79, 123, 1);
		box-shadow: 0 ${unit(4)} ${unit(10)} rgba(40, 70, 130, 0.08);
	}
`;

const SummaryText = styled.p`
	font-size: ${unit(15)};
	line-height: ${unit(24)};
	color: rgba(58, 73, 105, 1);
	white-space: pre-wrap;
`;

const MetaRow = styled.p`
	font-size: ${unit(13)};
	color: rgba(92, 108, 136, 1);
`;

const TagRow = styled.div`
	display: flex;
	gap: ${unit(8)};
	flex-wrap: wrap;
`;

const Tag = styled.span`
	padding: ${unit(5)} ${unit(11)};
	border-radius: ${unit(999)};
	border: 1px solid rgba(190, 209, 238, 1);
	background: rgba(242, 248, 255, 1);
	font-size: ${unit(13)};
	color: rgba(61, 89, 139, 1);
`;

const TimelineList = styled(OverlayScrollbarsComponent)<{ $expanded?: boolean }>`
	flex: 1;
	min-height: 0;

	.os-content {
		padding-right: ${({ $expanded }) => ($expanded ? '0' : unit(10))};
	}

	.os-scrollbar {
		--os-size: ${({ $expanded }) => ($expanded ? '0px' : unit(7))};
		--os-padding-axis: ${unit(2)};
		--os-handle-bg: linear-gradient(180deg, rgba(128, 160, 219, 1) 0%, rgba(84, 121, 195, 1) 100%);
		--os-handle-bg-hover: linear-gradient(180deg, rgba(146, 176, 228, 1) 0%, rgba(97, 134, 207, 1) 100%);
		--os-handle-bg-active: linear-gradient(180deg, rgba(110, 145, 211, 1) 0%, rgba(76, 111, 184, 1) 100%);
		--os-track-bg: rgba(232, 238, 248, 0.92);
	}

	.os-scrollbar-handle {
		border-radius: ${unit(999)};
	}
`;

const TimelineListInner = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
`;

const TimelineItemCard = styled.article`
	border: 1px solid rgba(221, 229, 241, 1);
	border-radius: ${unit(12)};
	background: white;
	padding: ${unit(14)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const TimelineTop = styled.div`
	display: flex;
	align-items: flex-start;
	gap: ${unit(12)};
`;

const TimelineMeta = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(4)};

	small {
		font-size: ${unit(13)};
		font-weight: 600;
		color: rgba(103, 118, 145, 1);
	}

	strong {
		font-size: ${unit(18)};
		font-weight: 700;
		color: rgba(29, 46, 82, 1);
	}
`;

const TimelineSummary = styled.p`
	font-size: ${unit(14)};
	line-height: ${unit(24)};
	color: rgba(63, 78, 108, 1);
`;

const TimelineKeywordRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: ${unit(6)};
`;

const TimelineKeyword = styled.span`
	padding: ${unit(5)} ${unit(10)};
	border-radius: ${unit(999)};
	background: rgba(233, 241, 255, 1);
	border: 1px solid rgba(196, 212, 240, 1);
	font-size: ${unit(12)};
	font-weight: 700;
	color: rgba(61, 89, 139, 1);
`;

const TimelineScriptPanel = styled.div<{ $open: boolean }>`
	display: grid;
	grid-template-rows: ${({ $open }) => ($open ? '1fr' : '0fr')};
	transition: grid-template-rows 0.28s ease, opacity 0.28s ease;
	opacity: ${({ $open }) => ($open ? 1 : 0.35)};
`;

const TimelineScriptInner = styled.div`
	overflow: hidden;
	border-top: 1px solid rgba(229, 235, 244, 1);
	padding-top: ${unit(12)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const TimelineScriptTitle = styled.h4`
	font-size: ${unit(13)};
	font-weight: 700;
	color: rgba(86, 101, 129, 1);
`;

const TimelineScriptText = styled.p`
	font-size: ${unit(14)};
	line-height: ${unit(24)};
	color: rgba(55, 71, 103, 1);
	white-space: pre-wrap;
`;

const Placeholder = styled.div`
	flex: 1;
	border: 1px dashed rgba(188, 201, 223, 1);
	background: rgba(248, 251, 255, 1);
	border-radius: ${unit(12)};
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	text-align: center;
	gap: ${unit(8)};

	p {
		font-size: ${unit(18)};
		font-weight: 700;
		color: rgba(60, 79, 116, 1);
	}

	span {
		font-size: ${unit(14)};
		color: rgba(95, 109, 137, 1);
	}
`;

const EmptyText = styled.p`
	color: rgba(90, 107, 138, 1);
	font-size: ${unit(14)};
`;
