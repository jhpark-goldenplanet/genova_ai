'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useModal } from '@/shared/hooks';
import { unit } from '@/shared/utils/base';

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

type Props = {
	videoId: string;
	tab: DetailTabType;
};

export default function MockDetailContent({ videoId, tab }: Props) {
	const searchParams = useSearchParams();
	const { confirm, closeConfirm } = useModal();
	const initialAnalysisId = searchParams.get('analysisId') ?? '';

	const [works, setWorks] = useState<WorkItem[]>([]);
	const [selectedAnalysisId, setSelectedAnalysisId] = useState(initialAnalysisId);
	const [isAllScriptsOpen, setIsAllScriptsOpen] = useState(true);
	const [splitPoints, setSplitPoints] = useState([33, 66]);
	const [reanalyzeCount, setReanalyzeCount] = useState(0);
	const [draggingFlagIndex, setDraggingFlagIndex] = useState<number | null>(null);
	const [selectedSplitPointIndex, setSelectedSplitPointIndex] = useState<number | null>(null);
	const splitRailRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]');
			setWorks(Array.isArray(parsed) ? parsed : []);
		} catch (error) {
			setWorks([]);
		}
	}, []);

	const selectedWork = useMemo(() => works.find((work) => work.videoId === videoId), [works, videoId]);
	const selectedAnalysis = useMemo(
		() => selectedWork?.analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? selectedWork?.analyses[0],
		[selectedAnalysisId, selectedWork],
	);
	const timelineItems = useMemo(
		() => buildTimelineItems(selectedAnalysis, selectedWork?.duration ?? '-'),
		[selectedAnalysis, selectedWork?.duration],
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
	const selectedSplitPointValue = selectedSplitPointIndex === null ? null : splitPoints[selectedSplitPointIndex];

	const tabTitle = tab === 'script' ? '스크립트 편집 영역' : '수동 분할 편집 영역';
	const renderVideoBox = (compact = false, split = false) => (
		<VideoBox $compact={compact} $split={split}>
			{selectedWork?.videoUrl ? (
				<video controls preload="metadata" poster={selectedWork.thumbnailUrl}>
					<source src={selectedWork.videoUrl} />
				</video>
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
		setSplitPoints([33, 66]);
		setReanalyzeCount(0);
		setSelectedSplitPointIndex(null);
	};
	const handleAddSplitPoint = () => {
		setSplitPoints((prev) => {
			if (prev.length >= 4) return prev;
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
				setReanalyzeCount((prev) => prev + 1);
				closeConfirm();
			},
		});
	};
	const handleDownloadSplit = () => {
		confirm({
			message: '현재 분할 구간대로 영상을 다운로드 하시겠습니까?',
			okHandler: () => {
				closeConfirm();
			},
		});
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
		<Wrap>
			{tab === 'summary' ? (
				selectedAnalysis ? (
					<>
						<SummaryHero>
							{renderVideoBox(true)}

							<TotalSummaryCard>
								<SectionTitle>전체 영상 요약</SectionTitle>
								<SummaryText>{selectedAnalysis.briefing || '요약 정보가 없습니다.'}</SummaryText>
								<MetaRow>프롬프트: {selectedAnalysis.promptLabel}</MetaRow>
								<TagRow>
									{selectedAnalysis.keywords?.length
										? selectedAnalysis.keywords.map((keyword) => <Tag key={`tag-${selectedAnalysis.id}-${keyword}`}>{keyword}</Tag>)
										: <EmptyText>키워드 없음</EmptyText>}
								</TagRow>
							</TotalSummaryCard>
						</SummaryHero>

						<TimelineCard>
							<TimelineHeader>
								<SectionTitle>타임라인</SectionTitle>
								<TimelineHeaderActions>
									<TimelineHeaderButton type="button" onClick={() => setIsAllScriptsOpen((prev) => !prev)}>
										스크립트
									</TimelineHeaderButton>
									<TimelineHeaderButton type="button" onClick={handleDownloadScripts}>
										다운로드
									</TimelineHeaderButton>
								</TimelineHeaderActions>
							</TimelineHeader>
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
										<TimelineSummary>{item.summary}</TimelineSummary>
										<TimelineScriptPanel $open={isAllScriptsOpen}>
											<TimelineScriptInner>
												<TimelineScriptTitle>스크립트</TimelineScriptTitle>
												<TimelineScriptText>{item.script}</TimelineScriptText>
											</TimelineScriptInner>
										</TimelineScriptPanel>
									</TimelineItemCard>
								))}
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

							{renderVideoBox(false, true)}

							<SplitRailCard>
								<SplitRailHeader>
									<SplitRailHeaderText>
										<strong>분할 타임라인</strong>
										<span>마커를 이동해 구간 경계를 조정합니다.</span>
									</SplitRailHeaderText>
									<SplitHeaderActions>
										<SplitBadge>{splitSegments.length}개 구간</SplitBadge>
										<SplitIconButton type="button" onClick={handleAddSplitPoint} disabled={splitPoints.length >= 4}>
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
									</SplitHeaderActions>
								</SplitRailHeader>
								<SplitRailArea ref={splitRailRef}>
									<SplitRailBase />
									{splitSegments.map((segment, index) => (
										<SplitRailSegment
											key={segment.id}
											$left={segment.start}
											$width={Math.max(segment.end - segment.start, 4)}
											$index={index}
											$isFirst={index === 0}
											$isLast={index === splitSegments.length - 1}
											$highlighted={highlightedSegmentIndexes.has(index)}
										/>
									))}
									{splitPoints.map((point, index) => (
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
									{splitPoints.map((point, index) => (
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
						</SplitPrimaryCard>

						<SplitSidebar>
							<SplitSecondaryCard>
								<SplitCardHeader>
									<div>
										<SectionTitle>프리뷰</SectionTitle>
										<SplitDescription>현재 구간 내 스크립트를 기준으로 주제와 핵심키워드를 다시 생성하는 화면입니다.</SplitDescription>
									</div>
								</SplitCardHeader>
								<SplitSegmentList>
									{splitSegments.map((segment, index) => (
										<SplitSegmentCard key={segment.id} $highlighted={highlightedSegmentIndexes.has(index)}>
											<SplitSegmentTop>
												<SplitSegmentOrder $index={segment.order - 1}>구간 {segment.order}</SplitSegmentOrder>
												<SplitSegmentTime>
													<SplitSegmentStamp $highlighted={segment.start === selectedSplitPointValue}>
														{interpolateTime(totalSeconds, segment.start)}
													</SplitSegmentStamp>
													<span> - </span>
													<SplitSegmentStamp $highlighted={segment.end === selectedSplitPointValue}>
														{interpolateTime(totalSeconds, segment.end)}
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
											<SplitScriptPreview>
												<SplitScriptLabel>참고 스크립트</SplitScriptLabel>
												<TimelineScriptText>{segment.script}</TimelineScriptText>
											</SplitScriptPreview>
										</SplitSegmentCard>
									))}
								</SplitSegmentList>
							</SplitSecondaryCard>

							<SplitActionBar>
								<SplitGhostButton type="button" onClick={handleResetSplit}>
									초기화
								</SplitGhostButton>
								<SplitSecondaryButton type="button" onClick={handleReanalyze}>
									재분석
								</SplitSecondaryButton>
								<SplitPrimaryButton type="button" onClick={handleDownloadSplit}>
									분할 다운로드
								</SplitPrimaryButton>
							</SplitActionBar>
						</SplitSidebar>
					</SplitLayout>
				</>
			) : (
				<>
					{renderVideoBox()}
					<ContentBox>
						<h3>{tabTitle}</h3>
						<Placeholder>
							<p>UI 설계 중입니다.</p>
							<span>여기에 스크립트 조회/수정 영역이 들어갑니다.</span>
						</Placeholder>
					</ContentBox>
				</>
			)}
		</Wrap>
	);
}

const Wrap = styled.main`
	display: flex;
	flex-direction: column;
	gap: ${unit(16)};
	height: 100%;
	min-height: 0;
`;

const VideoBox = styled.article<{ $compact?: boolean; $split?: boolean }>`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	background: rgba(244, 247, 252, 1);
	padding: ${unit(12)};
	aspect-ratio: 16 / 9;
	min-height: ${({ $compact, $split }) => ($compact ? unit(280) : $split ? unit(220) : 'auto')};

	video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: ${unit(10)};
		background: black;
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
	grid-template-columns: minmax(0, 1.22fr) minmax(${unit(332)}, 0.78fr);
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
	gap: ${unit(16)};
	min-height: 0;
`;

const SplitSecondaryCard = styled(SplitPrimaryCard)`
	background: rgba(249, 251, 255, 1);
	min-height: 0;
`;

const SplitSidebar = styled.section`
	display: flex;
	flex-direction: column;
	gap: ${unit(16)};
	min-height: 0;
	width: 100%;
`;

const SplitCardHeader = styled.div`
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
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	background: rgba(247, 250, 255, 1);
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	gap: ${unit(16)};
`;

const SplitRailHeader = styled.div`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: ${unit(12)};

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
	height: ${unit(48)};
	padding-top: ${unit(10)};
`;

const SplitRailBase = styled.div`
	position: absolute;
	left: 0;
	right: 0;
	top: ${unit(28)};
	height: ${unit(12)};
	border-radius: ${unit(999)};
	background: linear-gradient(90deg, rgba(231, 238, 249, 1) 0%, rgba(212, 224, 243, 1) 100%);
	box-shadow: inset 0 0 0 1px rgba(202, 214, 233, 1);
`;

const SplitRailSegment = styled.div<{ $left: number; $width: number; $index: number; $isFirst: boolean; $isLast: boolean; $highlighted: boolean }>`
	position: absolute;
	top: ${unit(28)};
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
	margin-top: ${unit(-8)};
`;

const SplitFlagTimeLabel = styled.span<{ $active: boolean }>`
	position: absolute;
	font-size: ${({ $active }) => ($active ? unit(13) : unit(11))};
	font-weight: 700;
	color: ${({ $active }) => ($active ? 'rgba(52, 92, 175, 1)' : 'rgba(82, 97, 125, 1)')};
	transition: color 0.2s ease, font-size 0.2s ease;
`;

const SplitSegmentList = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
	max-height: ${unit(620)};
	overflow-y: auto;
	padding-right: ${unit(4)};
`;

const SplitSegmentCard = styled.article<{ $highlighted: boolean }>`
	border: 1px solid rgba(217, 226, 239, 1);
	border-radius: ${unit(12)};
	background: white;
	padding: ${unit(16)};
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
	border-color: ${({ $highlighted }) => ($highlighted ? 'rgba(84, 140, 232, 1)' : 'rgba(217, 226, 239, 1)')};
	transition: border-color 0.2s ease;
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

	&:hover {
		background: rgba(35, 57, 110, 1);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(26, 43, 89, 0.22);
	}
`;

const SummaryHero = styled.section`
	display: grid;
	grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
	gap: ${unit(16)};

	@media screen and (max-width: 1180px) {
		grid-template-columns: 1fr;
	}
`;

const SummaryCardBase = styled.section`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	background: white;
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	gap: ${unit(14)};
`;

const TotalSummaryCard = styled(SummaryCardBase)``;

const TimelineCard = styled(SummaryCardBase)`
	background: rgba(249, 251, 255, 1);
	flex: 1;
	min-height: 0;
`;

const TimelineHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(12)};
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

const TimelineList = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding-right: ${unit(4)};
`;

const TimelineItemCard = styled.article`
	border: 1px solid rgba(221, 229, 241, 1);
	border-radius: ${unit(12)};
	background: white;
	padding: ${unit(16)};
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
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
