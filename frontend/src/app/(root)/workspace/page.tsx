'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import Button from '@/components/Button';
import * as ModalS from '@/components/Modal/styled';
import { unit } from '@/shared/utils/base';
import { successToast, warningToast } from '@/shared/utils/toastUtils';
import { useModal } from '@/shared/hooks';
import Image from 'next/image';
import ico_edit from '@images/ico_edit.png';
import { analyzeVideo } from '@/shared/apis/video';

type ProcessStage = 'UPLOAD' | 'CONFIGURE' | 'ANALYZE' | 'DONE';

interface AnalysisItem {
	id: string;
	name: string;
	status: 'COMPLETE' | 'IN_PROGRESS' | 'FAILED';
	processStage?: ProcessStage;
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

interface ServerSummarySnapshot {
	summary: string;
	keywords: string[];
}

type RenameModalState =
	| {
			target: 'project' | 'analysis';
			workId: string;
			analysisId?: string;
			initialValue: string;
	  }
	| null;

const WORKSPACE_STORAGE_KEY = 'genova_workspace_mock_works_v1';
const MAX_ANALYSIS_COUNT = 5;

const DEFAULT_WORKS: WorkItem[] = [
	{
		id: 'work-001',
		title: '농업 정책 브리핑 3월',
		duration: '18:24',
		uploadedAt: '2026-03-11',
		source: 'briefing_march.mp4',
		videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
		thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
		videoId: '8f076afc7ffd4b3b9748235c6e58bbe1-0ba6e3f3',
		analyses: [
			{
				id: 'ana-a',
				name: '분석 A (AI 자동)',
				status: 'COMPLETE',
				updatedAt: '2026-03-11 09:20',
				promptLabel: 'AI 자동',
				briefing: '정책 발표 순서에 맞춘 표준 요약으로, 예산/일정/추진주체를 균형 있게 정리한 버전입니다.',
				keywords: ['표준 요약', '정책 흐름', '균형'],
			},
			{
				id: 'ana-b',
				name: '분석 B (핵심 위주)',
				status: 'COMPLETE',
				updatedAt: '2026-03-11 09:48',
				promptLabel: '핵심 위주 프롬프트',
				briefing: '실무 의사결정에 필요한 핵심 항목만 추려 요약 밀도를 높인 버전입니다.',
				keywords: ['핵심 요약', '의사결정', '압축'],
			},
		],
	},
	{
		id: 'work-002',
		title: '스마트팜 장비 교육 영상',
		duration: '24:10',
		uploadedAt: '2026-03-10',
		source: 'smartfarm_class.mov',
		videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
		thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
		analyses: [],
	},
];

const resolveProcessStage = (analysis: Partial<AnalysisItem>): ProcessStage => {
	if (analysis.processStage) return analysis.processStage;
	if (analysis.status === 'COMPLETE') return 'DONE';
	if (analysis.status === 'IN_PROGRESS') return 'ANALYZE';
	return 'CONFIGURE';
};

const processStageLabel = (stage: ProcessStage) => {
	if (stage === 'UPLOAD') return '업로드 중';
	if (stage === 'CONFIGURE') return '설정중';
	if (stage === 'ANALYZE') return '분석중';
	return '완료';
};

const normalizeAnalysis = (analysis: Partial<AnalysisItem>, idx: number): AnalysisItem => ({
	id: analysis.id || `analysis-${idx + 1}`,
	name: analysis.name || `분석 ${idx + 1}`,
	status: analysis.status || 'COMPLETE',
	processStage: resolveProcessStage(analysis),
	updatedAt: analysis.updatedAt || '',
	promptLabel: analysis.promptLabel || 'AI 자동',
	briefing: analysis.briefing || '요약 정보가 없습니다.',
	keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
});

const normalizeWork = (work: Partial<WorkItem>, idx: number): WorkItem => ({
	id: work.id || `work-${idx + 1}`,
	title: work.title || `작업 ${idx + 1}`,
	duration: work.duration || '-',
	uploadedAt: work.uploadedAt || '-',
	source: work.source || 'unknown',
	videoUrl: work.videoUrl,
	thumbnailUrl: work.thumbnailUrl,
	videoId: work.videoId,
	analyses: Array.isArray(work.analyses) ? work.analyses.map((analysis, analysisIdx) => normalizeAnalysis(analysis, analysisIdx)) : [],
});

const CloseIcon = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M7 7L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		<path d="M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
	</svg>
);

export default function WorkspacePage() {
	const router = useRouter();
	const { confirm, closeConfirm } = useModal();
	const [works, setWorks] = useState<WorkItem[]>([]);
	const [selectedWorkId, setSelectedWorkId] = useState<string>('');
	const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
	const [renameModal, setRenameModal] = useState<RenameModalState>(null);
	const [renameDraft, setRenameDraft] = useState('');
	const [isRenameModalClosing, setIsRenameModalClosing] = useState(false);
	const [serverSummaries, setServerSummaries] = useState<Record<string, ServerSummarySnapshot>>({});

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
			const parsedRaw = stored ? (JSON.parse(stored) as Partial<WorkItem>[]) : DEFAULT_WORKS;
			const parsed = parsedRaw.map((work, idx) => normalizeWork(work, idx));
			setWorks(parsed);
			setSelectedWorkId(parsed[0]?.id ?? '');
		} catch (error) {
			setWorks(DEFAULT_WORKS);
			setSelectedWorkId(DEFAULT_WORKS[0]?.id ?? '');
		}
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (!works.length) return;
		window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(works));
	}, [works]);

	useEffect(() => {
		const targets = works.filter(
			(work) => work.videoId && (!work.videoUrl || work.videoUrl.startsWith('blob:') || !work.thumbnailUrl),
		);
		if (!targets.length) return;

		let isCancelled = false;

		const hydrateVideoUrls = async () => {
			const updates = await Promise.all(
				targets.map(async (work) => {
					try {
						const result = await analyzeVideo(work.videoId as string);
						if (!result.gcs_view_link && !result.thumbnail_url) return null;
						return {
							id: work.id,
							videoUrl: result.gcs_view_link,
							thumbnailUrl: result.thumbnail_url,
						};
					} catch (error) {
						console.warn('[Workspace] failed to hydrate playback url', work.videoId, error);
						return null;
					}
				}),
			);

			if (isCancelled) return;

			const validUpdates = updates.filter((update) => update !== null) as Array<{
				id: string;
				videoUrl?: string;
				thumbnailUrl?: string;
			}>;
			if (!validUpdates.length) return;

			setWorks((prev) =>
				prev.map((work) => {
					const matched = validUpdates.find((update) => update.id === work.id);
					if (!matched) return work;
					return {
						...work,
						videoUrl: matched.videoUrl || work.videoUrl,
						thumbnailUrl: matched.thumbnailUrl || work.thumbnailUrl,
					};
				}),
			);
		};

		hydrateVideoUrls();

		return () => {
			isCancelled = true;
		};
	}, [works]);

	const selectedWork = useMemo(() => works.find((item) => item.id === selectedWorkId) ?? works[0], [selectedWorkId, works]);
	const selectedAnalysis = useMemo(
		() => selectedWork?.analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? selectedWork?.analyses[0],
		[selectedWork, selectedAnalysisId],
	);
	const selectedWorkServerSummary = selectedWork ? serverSummaries[selectedWork.id] : undefined;
	const displayedBriefing = selectedWorkServerSummary?.summary || selectedAnalysis?.briefing || '요약 정보가 없습니다.';
	const displayedKeywords = (selectedWorkServerSummary?.keywords?.length
		? selectedWorkServerSummary.keywords.slice(0, 5)
		: selectedAnalysis?.keywords) ?? [];
	const displayedAnalysisCount = selectedWork ? Math.min(selectedWork.analyses.length, MAX_ANALYSIS_COUNT) : 0;
	const emptySlotsCount = Math.max(0, MAX_ANALYSIS_COUNT - displayedAnalysisCount);

	useEffect(() => {
		if (!selectedWork?.videoId) return;
		if (serverSummaries[selectedWork.id]) return;

		let isCancelled = false;

		const hydrateServerSummary = async () => {
			try {
				const result = await analyzeVideo(selectedWork.videoId as string);
				if (isCancelled) return;
				setServerSummaries((prev) => ({
					...prev,
					[selectedWork.id]: {
						summary: result.summary || '',
						keywords: Array.isArray(result.keywords) ? result.keywords : [],
					},
				}));
			} catch (error) {
				console.warn('[Workspace] failed to hydrate analysis summary', selectedWork.videoId, error);
			}
		};

		hydrateServerSummary();

		return () => {
			isCancelled = true;
		};
	}, [selectedWork, serverSummaries]);

	useEffect(() => {
		if (!selectedWork) return;
		if (!selectedWork.analyses.length) {
			setSelectedAnalysisId('');
			return;
		}
		setSelectedAnalysisId((prev) => {
			if (prev && selectedWork.analyses.some((analysis) => analysis.id === prev)) return prev;
			return selectedWork.analyses[0].id;
		});
	}, [selectedWork]);

	const openProjectRenameModal = (work: WorkItem) => {
		setIsRenameModalClosing(false);
		setRenameModal({ target: 'project', workId: work.id, initialValue: work.title });
		setRenameDraft(work.title);
	};

	const openAnalysisRenameModal = (workId: string, analysis: AnalysisItem) => {
		setIsRenameModalClosing(false);
		setRenameModal({ target: 'analysis', workId, analysisId: analysis.id, initialValue: analysis.name });
		setRenameDraft(analysis.name);
	};

	const closeRenameModal = () => {
		setIsRenameModalClosing(true);
		setTimeout(() => {
			setRenameModal(null);
			setRenameDraft('');
			setIsRenameModalClosing(false);
		}, 220);
	};

	const applyRename = () => {
		if (!renameModal) return;
		const nextName = renameDraft.trim();
		if (!nextName) return;

		setWorks((prev) =>
			prev.map((work) => {
				if (work.id !== renameModal.workId) return work;
				if (renameModal.target === 'project') {
					return { ...work, title: nextName };
				}
				return {
					...work,
					analyses: work.analyses.map((analysis) =>
						analysis.id === renameModal.analysisId ? { ...analysis, name: nextName } : analysis,
					),
				};
			}),
		);

		successToast(renameModal.target === 'project' ? '프로젝트명이 저장되었습니다.' : '작업명이 저장되었습니다.');
		closeRenameModal();
	};

	const confirmDeleteProject = (projectId: string) => {
		confirm({
			message: '정말 이 프로젝트를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.',
			okHandler: () => {
				setWorks((prev) => {
					const filtered = prev.filter((work) => work.id !== projectId);
					setSelectedWorkId((current) => {
						if (current !== projectId) return current;
						return filtered[0]?.id ?? '';
					});
					return filtered;
				});
				closeConfirm();
				successToast('프로젝트가 삭제되었습니다.');
			},
		});
	};

	const confirmDeleteAnalysis = (analysisId: string) => {
		if (!selectedWork) return;
		confirm({
			message: '정말 이 작업을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.',
			okHandler: () => {
				setWorks((prev) =>
					prev.map((work) =>
						work.id !== selectedWork.id
							? work
							: { ...work, analyses: work.analyses.filter((analysis) => analysis.id !== analysisId) },
					),
				);
				setSelectedAnalysisId((current) => (current === analysisId ? '' : current));
				closeConfirm();
				successToast('작업이 삭제되었습니다.');
			},
		});
	};

	const handleCreateAnalysis = () => {
		if (!selectedWork) {
			router.push('/workspace/new?mode=project');
			return;
		}
		if ((selectedWork.analyses?.length ?? 0) >= MAX_ANALYSIS_COUNT) {
			warningToast('작업은 최대 5개까지 등록할 수 있습니다.');
			return;
		}
		router.push(`/workspace/new?mode=analysis&workId=${selectedWork.id}`);
	};

	const handleEditAnalysis = () => {
		if (!selectedWork) {
			router.push('/workspace/new?mode=project');
			return;
		}
		const query = selectedAnalysis ? `&analysisId=${selectedAnalysis.id}` : '';
		router.push(`/workspace/new?mode=analysis&workId=${selectedWork.id}${query}`);
	};

	const handleOpenResult = () => {
		if (!selectedWork?.videoId) {
			router.push('/workspace/new?mode=project');
			return;
		}
		const query = selectedAnalysis ? `?analysisId=${selectedAnalysis.id}` : '';
		router.push(`/video/${selectedWork.videoId}/summary${query}`);
	};

	return (
		<Page>
			<HeaderRow>
				<div>
					<Title>프로젝트 목록</Title>
					<Description>프로젝트를 선택하면 원본 영상과 작업 목록을 확인할 수 있습니다.</Description>
				</div>
				<ActionButton type="button" onClick={() => router.push('/workspace/new?mode=project')}>
					새 프로젝트
				</ActionButton>
			</HeaderRow>

			<BodyGrid>
				<CardList>
					{works.map((work) => {
						const isActive = work.id === selectedWork?.id;
						return (
							<ProjectCard key={work.id} $active={isActive}>
								<CardMainButton type="button" onClick={() => setSelectedWorkId(work.id)}>
									<ThumbWrap>
										{work.thumbnailUrl ? <img src={work.thumbnailUrl} alt={`${work.title} thumbnail`} /> : <ThumbPlaceholder>NO THUMBNAIL</ThumbPlaceholder>}
									</ThumbWrap>
									<h3>{work.title}</h3>
									<p>{work.source}</p>
									<CardMeta>
										<span>{work.duration}</span>
										<span>{work.uploadedAt}</span>
										<span>{work.analyses.length}개 작업</span>
									</CardMeta>
								</CardMainButton>
							</ProjectCard>
						);
					})}
				</CardList>

				<PreviewPanel>
					{selectedWork ? (
						<>
							<TitleRow>
								<h2>{selectedWork.title}</h2>
								<TitleActionGroup>
									<IconButton type="button" aria-label="프로젝트명 수정" onClick={() => openProjectRenameModal(selectedWork)}>
										<Image src={ico_edit} alt="edit" width={14} height={14} />
									</IconButton>
									<IconButton type="button" $danger aria-label="프로젝트 삭제" onClick={() => confirmDeleteProject(selectedWork.id)}>
										<CloseIcon />
									</IconButton>
								</TitleActionGroup>
							</TitleRow>
							<SubText>
								원본 영상: {selectedWork.source} · 업로드일: {selectedWork.uploadedAt} · 길이: {selectedWork.duration}
							</SubText>

							<TopContent>
								<VideoPane>
									{selectedWork.videoUrl ? (
										<video controls preload="metadata" poster={selectedWork.thumbnailUrl}>
											<source src={selectedWork.videoUrl} />
										</video>
									) : (
										<EmptyVideo>원본 영상이 없습니다.</EmptyVideo>
									)}
								</VideoPane>

								<AnalysisPanelGroup>
									<AnalysisPaneTitle>{`작업 목록(${displayedAnalysisCount}/${MAX_ANALYSIS_COUNT})`}</AnalysisPaneTitle>
									<AnalysisPane>
										<AnalysisList>
											{selectedWork.analyses.slice(0, MAX_ANALYSIS_COUNT).map((analysis) => {
												const isSelected = analysis.id === selectedAnalysis?.id;
												return (
													<AnalysisItemCard key={analysis.id} $selected={isSelected} onClick={() => setSelectedAnalysisId(analysis.id)}>
														<AnalysisTopRow>
															<AnalysisTitleMain>
																<AnalysisTitleRow>
																	<strong>{analysis.name}</strong>
																	<StatusTag $stage={analysis.processStage ?? 'DONE'}>
																		{processStageLabel(analysis.processStage ?? 'DONE')}
																	</StatusTag>
																</AnalysisTitleRow>
															</AnalysisTitleMain>
															<AnalysisActions>
																<IconButton
																	type="button"
																	aria-label="작업명 수정"
																	onClick={(e) => {
																		e.stopPropagation();
																		openAnalysisRenameModal(selectedWork.id, analysis);
																	}}
																>
																	<Image src={ico_edit} alt="edit" width={13} height={13} />
																</IconButton>
																<IconButton
																	type="button"
																	$danger
																	aria-label="작업 삭제"
																	onClick={(e) => {
																		e.stopPropagation();
																		confirmDeleteAnalysis(analysis.id);
																	}}
																>
																	<CloseIcon />
																</IconButton>
															</AnalysisActions>
														</AnalysisTopRow>
														<AnalysisBottomRow>
															<AnalysisSubTitle>{analysis.promptLabel}</AnalysisSubTitle>
															<StatusMetaRow>
																<small>{analysis.updatedAt}</small>
															</StatusMetaRow>
														</AnalysisBottomRow>
													</AnalysisItemCard>
												);
											})}

											{Array.from({ length: emptySlotsCount }).map((_, index) => (
												<AnalysisEmptyCard key={`empty-analysis-slot-${index}`}>
													<AnalysisEmptyButton type="button" onClick={handleCreateAnalysis}>
														<PlusCircle>+</PlusCircle>
														<span>새 작업 등록</span>
													</AnalysisEmptyButton>
												</AnalysisEmptyCard>
											))}
										</AnalysisList>
									</AnalysisPane>
								</AnalysisPanelGroup>
							</TopContent>

							{selectedAnalysis ? (
								<SummarySection>
									<PaneTitle>분석 결과 미리보기</PaneTitle>
									<SummaryBox>
										<SummaryTextContent>{displayedBriefing}</SummaryTextContent>
										<SummaryFooter>
											<KeywordRow>
												{displayedKeywords.map((keyword) => (
													<Keyword key={`analysis-${selectedAnalysis.id}-${keyword}`}>{keyword}</Keyword>
												))}
											</KeywordRow>
											<SummaryActions>
												<Button type="button" status="neutral_outlined" onClick={handleEditAnalysis} width={96}>
													작업 수정
												</Button>
												<Button type="button" status="primary" onClick={handleOpenResult} width={96}>
													분석 결과
												</Button>
											</SummaryActions>
										</SummaryFooter>
									</SummaryBox>
									<SubText>프롬프트: {selectedAnalysis.promptLabel}</SubText>
								</SummarySection>
							) : null}
						</>
					) : null}
				</PreviewPanel>
			</BodyGrid>

			{renameModal ? (
				<RenameOverlay
					$closing={isRenameModalClosing}
					onClick={closeRenameModal}
				>
					<RenameModalCard $closing={isRenameModalClosing} onClick={(e) => e.stopPropagation()}>
						<ModalS.SharedModalHeader>
							<ModalS.SharedModalTitle>{renameModal.target === 'project' ? '프로젝트명 변경' : '작업명 변경'}</ModalS.SharedModalTitle>
							<ModalS.SharedModalDescription>
								{renameModal.target === 'project' ? '프로젝트에 표시할 이름을 설정합니다.' : '작업에 표시할 이름을 설정합니다.'}
							</ModalS.SharedModalDescription>
						</ModalS.SharedModalHeader>
						<RenameInput
							value={renameDraft}
							onChange={(e) => setRenameDraft(e.target.value)}
							placeholder="변경할 이름을 입력하세요."
							autoFocus
						/>
						<ModalS.SharedModalFooter>
							<Button type="button" status="neutral_outlined" onClick={closeRenameModal} width={84}>
								취소
							</Button>
							<Button type="button" status="primary" onClick={applyRename} width={84}>
								적용
							</Button>
						</ModalS.SharedModalFooter>
					</RenameModalCard>
				</RenameOverlay>
			) : null}
		</Page>
	);
}

const Page = styled.main`
	padding: ${unit(28)} ${unit(30)};
	display: flex;
	flex-direction: column;
	gap: ${unit(18)};
	height: 100dvh;
	min-height: 100dvh;
	box-sizing: border-box;
	overflow: hidden;
`;

const HeaderRow = styled.header`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: ${unit(12)};
`;

const Title = styled.h1`
	font-size: ${unit(27)};
	font-weight: 700;
	color: rgba(23, 36, 62, 1);
`;

const Description = styled.p`
	margin-top: ${unit(6)};
	font-size: ${unit(15)};
	color: rgba(83, 95, 120, 1);
`;

const ActionButton = styled.button`
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	padding: ${unit(11)} ${unit(18)};
	border-radius: ${unit(10)};
	font-size: ${unit(15)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(49, 95, 183, 1);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.24);
	}
`;

const BodyGrid = styled.section`
	display: grid;
	grid-template-columns: ${unit(292)} 1fr;
	gap: ${unit(16)};
	flex: 1;
	min-height: 0;
	overflow: hidden;
`;

const CardList = styled.div`
	background: rgba(244, 247, 252, 1);
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	padding: ${unit(12)};
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const ProjectCard = styled.article<{ $active: boolean }>`
	border: ${({ $active }) => ($active ? `${unit(2)} solid rgba(67, 109, 186, 1)` : '1px solid rgba(219, 226, 238, 1)')};
	border-radius: ${unit(12)};
	background: white;
	padding: ${unit(10)};
	transition: border-color 0.2s ease;
	box-sizing: border-box;

	&:hover {
		border-color: ${({ $active }) => ($active ? 'rgba(67, 109, 186, 1)' : 'rgba(97, 121, 177, 0.55)')};
	}

	&:active {
		border-color: ${({ $active }) => ($active ? 'rgba(67, 109, 186, 1)' : 'rgba(97, 121, 177, 0.55)')};
	}

	h3 {
		font-size: ${unit(17)};
		font-weight: 700;
		color: rgba(27, 45, 80, 1);
	}

	p {
		margin-top: ${unit(5)};
		font-size: ${unit(14)};
		color: rgba(88, 102, 128, 1);
	}
`;

const CardMainButton = styled.button`
	width: 100%;
	text-align: left;
	cursor: pointer;
	background: transparent;
	border: none;
	padding: 0;
	font: inherit;
	color: inherit;
	appearance: none;
	-webkit-appearance: none;
	-webkit-tap-highlight-color: transparent;

	&:active {
		transform: none;
		background: transparent;
		color: inherit;
	}

	&:focus {
		outline: none;
	}

	&:focus-visible {
		outline: none;
	}

	h3 {
		font-size: ${unit(17)};
		font-weight: 700;
		color: rgba(27, 45, 80, 1);
	}

	p {
		margin-top: ${unit(5)};
		font-size: ${unit(14)};
		color: rgba(88, 102, 128, 1);
	}
`;

const ThumbWrap = styled.div`
	width: 100%;
	aspect-ratio: 16 / 9;
	border-radius: ${unit(10)};
	overflow: hidden;
	background: rgba(231, 237, 248, 1);
	margin-bottom: ${unit(10)};
	flex-shrink: 0;

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

const ThumbPlaceholder = styled.div`
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: ${unit(12)};
	font-weight: 700;
	color: rgba(89, 104, 128, 1);
`;

const CardMeta = styled.div`
	margin-top: ${unit(8)};
	display: flex;
	gap: ${unit(8)};
	font-size: ${unit(12)};
	color: rgba(111, 126, 153, 1);
`;

const PreviewPanel = styled.section`
	background: white;
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(14)};
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	gap: ${unit(14)};
	min-height: 0;
	overflow: hidden;
`;

const TitleRow = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
	flex-wrap: wrap;

	h2 {
		font-size: ${unit(24)};
		font-weight: 700;
		color: rgba(27, 45, 80, 1);
	}
`;

const TitleActionGroup = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(2)};
`;

const SubText = styled.p`
	font-size: ${unit(14)};
	color: rgba(88, 102, 128, 1);
`;

const TopContent = styled.section`
	display: grid;
	grid-template-columns: minmax(0, 1.62fr) minmax(${unit(390)}, ${unit(485)});
	gap: ${unit(14)};
	align-items: stretch;
	min-width: 0;
`;

const VideoPane = styled.div`
	border-radius: ${unit(12)};
	overflow: hidden;
	background: rgba(13, 20, 34, 1);
	width: 100%;
	aspect-ratio: 767 / 507;
	height: auto;
	min-height: 0;
	min-width: 0;
	align-self: start;

	video {
		width: 100%;
		height: 100%;
		display: block;
		background: rgba(0, 0, 0, 1);
		object-fit: contain;
	}
`;

const AnalysisPane = styled.div`
	border: 1px solid rgba(226, 233, 244, 1);
	border-radius: ${unit(12)};
	padding: ${unit(12)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
	width: 100%;
	box-sizing: border-box;
	height: 100%;
	overflow: hidden;
	min-width: 0;
	min-height: 0;
`;

const AnalysisPanelGroup = styled.section`
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 0;
	width: 100%;
	max-width: ${unit(485)};
	justify-self: end;
	height: 100%;
	min-width: 0;
	min-height: 0;
	overflow: visible;
`;

const AnalysisPaneTitle = styled.h3`
	position: absolute;
	top: ${unit(-28)};
	right: ${unit(2)};
	font-size: ${unit(17)};
	font-weight: 700;
	color: rgba(26, 43, 89, 1);
	line-height: 1;
	text-align: right;
`;

const EmptyVideo = styled.div`
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: rgba(187, 197, 212, 1);
	font-size: ${unit(13)};
`;

const PaneTitle = styled.h3`
	font-size: ${unit(17)};
	font-weight: 700;
	color: rgba(27, 45, 80, 1);
`;

const AnalysisList = styled.ul`
	display: grid;
	grid-template-rows: repeat(5, minmax(0, 1fr));
	gap: ${unit(9)};
	height: 100%;
	overflow: auto;
	min-height: 0;
`;

const AnalysisItemCard = styled.li<{ $selected: boolean }>`
	border: 1px solid ${({ $selected }) => ($selected ? 'rgba(67, 109, 186, 1)' : 'rgba(226, 233, 244, 1)')};
	background: ${({ $selected }) => ($selected ? 'rgba(240, 246, 255, 1)' : 'white')};
	border-radius: ${unit(12)};
	padding: ${unit(14)} ${unit(14)} ${unit(12)};
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
	min-height: ${unit(82)};
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	min-width: 0;

	&:hover {
		border-color: rgba(116, 145, 198, 1);
		background: ${({ $selected }) => ($selected ? 'rgba(235, 243, 255, 1)' : 'rgba(247, 250, 255, 1)')};
	}
`;

const AnalysisEmptyCard = styled.li`
	border: 1px dashed rgba(173, 189, 216, 1);
	background: rgba(248, 251, 255, 1);
	border-radius: ${unit(12)};
	min-height: ${unit(82)};
	padding: ${unit(10)} ${unit(12)} ${unit(8)};
	transition: background-color 0.2s ease, border-color 0.2s ease;

	&:hover {
		background: rgba(240, 246, 255, 1);
		border-color: rgba(120, 146, 193, 1);
	}
`;

const AnalysisEmptyButton = styled.button`
	width: 100%;
	height: 100%;
	min-height: ${unit(62)};
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: ${unit(8)};
	border: none;
	background: transparent;
	cursor: pointer;

	span {
		font-size: ${unit(14)};
		font-weight: 700;
		color: rgba(70, 92, 132, 1);
	}

`;

const PlusCircle = styled.span`
	width: ${unit(30)};
	height: ${unit(30)};
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: ${unit(999)};
	border: 1px solid rgba(134, 157, 198, 1);
	background: white;
	color: rgba(57, 91, 156, 1);
	font-size: ${unit(20)};
	font-weight: 700;
	line-height: 1;
`;

const AnalysisTopRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(4)};
	margin-bottom: ${unit(2)};
`;

const AnalysisTitleMain = styled.div`
	flex: 1;
	min-width: 0;
	width: 100%;

	strong {
		display: block;
		font-size: ${unit(18)};
		color: rgba(30, 44, 72, 1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

const AnalysisTitleRow = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(6)};
	min-width: 0;

	strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex: 1;
	}
`;

const AnalysisBottomRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(6)};
	margin-top: auto;
	padding-top: ${unit(10)};
`;

const AnalysisActions = styled.div`
	display: flex;
	flex-direction: row;
	gap: ${unit(4)};
	justify-content: flex-end;
`;

const AnalysisSubTitle = styled.small`
	display: block;
	font-size: ${unit(15)};
	color: rgba(102, 117, 141, 1);
	text-align: left;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	flex: 1;
	min-width: 0;
`;

const StatusMetaRow = styled.div`
	display: flex;
	align-items: center;
	white-space: nowrap;
	margin-left: auto;
	align-self: flex-end;

	small {
		font-size: ${unit(12)};
		color: rgba(98, 111, 132, 1);
		line-height: 1.5;
	}
`;

const IconButton = styled.button<{ $danger?: boolean }>`
	width: ${unit(28)};
	height: ${unit(28)};
	border: 1px solid ${({ $danger }) => ($danger ? 'rgba(245, 170, 170, 1)' : 'rgba(43, 68, 112, 0.28)')};
	background: white;
	border-radius: ${unit(9)};
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	color: ${({ $danger }) => ($danger ? 'rgba(211, 53, 53, 1)' : 'rgba(29, 49, 83, 1)')};
	transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;

	&:hover {
		background: ${({ $danger }) => ($danger ? 'rgba(255, 240, 240, 1)' : 'rgba(236, 243, 255, 1)')};
		border-color: ${({ $danger }) => ($danger ? 'rgba(230, 102, 102, 1)' : 'rgba(38, 66, 112, 0.55)')};
		box-shadow: 0 ${unit(4)} ${unit(10)} rgba(40, 70, 130, 0.12);
	}
`;

const StatusTag = styled.span<{ $stage: ProcessStage }>`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: ${unit(4)} ${unit(11)};
	border-radius: ${unit(999)};
	font-size: ${unit(11)};
	font-weight: 700;
	white-space: nowrap;
	background: ${({ $stage }) =>
		$stage === 'DONE'
			? 'rgba(224, 242, 229, 1)'
			: $stage === 'ANALYZE'
				? 'rgba(230, 238, 255, 1)'
				: $stage === 'CONFIGURE'
					? 'rgba(255, 242, 223, 1)'
					: 'rgba(236, 240, 247, 1)'};
	color: ${({ $stage }) =>
		$stage === 'DONE'
			? 'rgba(25, 117, 60, 1)'
			: $stage === 'ANALYZE'
				? 'rgba(42, 76, 149, 1)'
				: $stage === 'CONFIGURE'
					? 'rgba(156, 91, 18, 1)'
					: 'rgba(76, 91, 116, 1)'};
	border: 1px solid
		${({ $stage }) =>
			$stage === 'DONE'
				? 'rgba(170, 222, 185, 1)'
				: $stage === 'ANALYZE'
					? 'rgba(181, 202, 245, 1)'
					: $stage === 'CONFIGURE'
						? 'rgba(241, 205, 156, 1)'
						: 'rgba(205, 214, 227, 1)'};
`;

const SummarySection = styled.section`
	border: 1px solid rgba(226, 233, 244, 1);
	border-radius: ${unit(12)};
	padding: ${unit(12)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const SummaryFooter = styled.div`
	position: absolute;
	left: ${unit(12)};
	right: ${unit(12)};
	bottom: ${unit(12)};
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: ${unit(12)};
`;

const SummaryActions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(10)};
	flex-shrink: 0;
`;

const SummaryBox = styled.div`
	position: relative;
	background: rgba(246, 249, 255, 1);
	border-radius: ${unit(10)};
	padding: ${unit(12)} ${unit(12)} ${unit(68)};
	font-size: ${unit(15)};
	color: rgba(45, 60, 90, 1);
	min-height: ${unit(136)};
`;

const SummaryTextContent = styled.div`
	line-height: 1.55;
	overflow: hidden;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	text-overflow: ellipsis;
	word-break: break-word;
`;

const KeywordRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: ${unit(6)};
	flex: 1;
	min-width: 0;
	overflow: hidden;
`;

const Keyword = styled.span`
	padding: ${unit(5)} ${unit(10)};
	border-radius: ${unit(16)};
	background: rgba(225, 236, 255, 1);
	font-size: ${unit(12)};
	color: rgba(32, 66, 130, 1);
`;

const EmptyState = styled.div`
	flex: 1;
	border: 1px dashed rgba(195, 208, 227, 1);
	border-radius: ${unit(10)};
	padding: ${unit(14)};
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: center;
	gap: ${unit(8)};

	p {
		font-size: ${unit(13)};
		color: rgba(95, 109, 134, 1);
	}
`;

const InlineButton = styled.button`
	border: 1px solid rgba(31, 58, 107, 1);
	background: rgba(31, 58, 107, 1);
	color: white;
	border-radius: ${unit(8)};
	padding: ${unit(8)} ${unit(12)};
	font-weight: 600;
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(25, 48, 88, 1);
		border-color: rgba(25, 48, 88, 1);
		box-shadow: 0 ${unit(5)} ${unit(12)} rgba(25, 48, 88, 0.24);
	}
`;

const RenameOverlay = styled(ModalS.SharedModalOverlay)`
	z-index: 1200;
`;

const RenameModalCard = styled(ModalS.SharedModalPanel)`
	width: min(${unit(420)}, calc(100vw - ${unit(32)}));
`;

const RenameInput = styled.input`
	height: ${unit(46)};
	border: 1px solid rgba(202, 215, 236, 1);
	border-radius: ${unit(10)} !important;
	padding: 0 ${unit(12)};
	font-size: ${unit(14)};
	color: rgba(30, 47, 80, 1);
	transition: border-color 0.2s ease, box-shadow 0.2s ease;

	&:focus {
		border-color: rgba(84, 121, 190, 1);
		box-shadow: 0 0 0 ${unit(3)} rgba(84, 121, 190, 0.18);
	}
`;
