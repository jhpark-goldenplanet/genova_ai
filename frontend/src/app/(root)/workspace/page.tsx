'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { successToast, warningToast } from '@/shared/utils/toastUtils';
import { useModal } from '@/shared/hooks';
import Image from 'next/image';
import ico_edit from '@images/ico_edit.png';

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

const statusLabel = (status: AnalysisItem['status']) => {
	if (status === 'COMPLETE') return '완료';
	if (status === 'IN_PROGRESS') return '작업 중';
	return '실패';
};

const normalizeAnalysis = (analysis: Partial<AnalysisItem>, idx: number): AnalysisItem => ({
	id: analysis.id || `analysis-${idx + 1}`,
	name: analysis.name || `분석 ${idx + 1}`,
	status: analysis.status || 'COMPLETE',
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

	const selectedWork = useMemo(() => works.find((item) => item.id === selectedWorkId) ?? works[0], [selectedWorkId, works]);
	const selectedAnalysis = useMemo(
		() => selectedWork?.analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? selectedWork?.analyses[0],
		[selectedWork, selectedAnalysisId],
	);
	const displayedAnalysisCount = selectedWork ? Math.min(selectedWork.analyses.length, MAX_ANALYSIS_COUNT) : 0;
	const emptySlotsCount = Math.max(0, MAX_ANALYSIS_COUNT - displayedAnalysisCount);

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
			router.push('/workspace/new');
			return;
		}
		if ((selectedWork.analyses?.length ?? 0) >= MAX_ANALYSIS_COUNT) {
			warningToast('작업은 최대 5개까지 등록할 수 있습니다.');
			return;
		}
		router.push('/workspace/new');
	};

	return (
		<Page>
			<HeaderRow>
				<div>
					<Title>프로젝트 목록</Title>
					<Description>프로젝트를 선택하면 원본 영상과 작업 목록을 확인할 수 있습니다.</Description>
				</div>
				<ActionButton type="button" onClick={() => router.push('/workspace/new')}>
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
																<strong>{analysis.name}</strong>
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
																<StatusTag $status={analysis.status}>{statusLabel(analysis.status)}</StatusTag>
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
									<PaneTitle>작업 요약 브리핑</PaneTitle>
									<SummaryBox>{selectedAnalysis.briefing}</SummaryBox>
									<SubText>프롬프트: {selectedAnalysis.promptLabel}</SubText>
									<KeywordRow>
										{selectedAnalysis.keywords.map((keyword) => (
											<Keyword key={`analysis-${selectedAnalysis.id}-${keyword}`}>{keyword}</Keyword>
										))}
									</KeywordRow>
								</SummarySection>
							) : null}

							<BottomActions>
								<PrimaryButton
									type="button"
									onClick={() => {
										if (!selectedWork.videoId) {
											router.push('/workspace/new');
											return;
										}
										const query = selectedAnalysis ? `?analysisId=${selectedAnalysis.id}` : '';
										router.push(`/video/${selectedWork.videoId}/summary${query}`);
									}}
								>
									상세 보기
								</PrimaryButton>
							</BottomActions>
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
						<h3>{renameModal.target === 'project' ? '프로젝트명 변경' : '작업명 변경'}</h3>
						<p>{renameModal.target === 'project' ? '프로젝트에 표시할 이름을 설정합니다.' : '작업에 표시할 이름을 설정합니다.'}</p>
						<RenameInput
							value={renameDraft}
							onChange={(e) => setRenameDraft(e.target.value)}
							placeholder="변경할 이름을 입력하세요."
							autoFocus
						/>
						<RenameActions>
							<RenameButton
								type="button"
								$secondary
								onClick={closeRenameModal}
							>
								취소
							</RenameButton>
							<RenameButton type="button" onClick={applyRename}>
								적용
							</RenameButton>
						</RenameActions>
					</RenameModalCard>
				</RenameOverlay>
			) : null}
		</Page>
	);
}

const Page = styled.main`
	padding: ${unit(24)} ${unit(26)};
	display: flex;
	flex-direction: column;
	gap: ${unit(14)};
`;

const HeaderRow = styled.header`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: ${unit(12)};
`;

const Title = styled.h1`
	font-size: ${unit(24)};
	font-weight: 700;
	color: rgba(23, 36, 62, 1);
`;

const Description = styled.p`
	margin-top: ${unit(4)};
	font-size: ${unit(13)};
	color: rgba(83, 95, 120, 1);
`;

const ActionButton = styled.button`
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	padding: ${unit(9)} ${unit(14)};
	border-radius: ${unit(8)};
	font-weight: 600;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(49, 95, 183, 1);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.24);
	}
`;

const BodyGrid = styled.section`
	display: grid;
	grid-template-columns: ${unit(320)} 1fr;
	gap: ${unit(12)};
	min-height: calc(100dvh - ${unit(136)});
`;

const CardList = styled.div`
	background: rgba(244, 247, 252, 1);
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(12)};
	padding: ${unit(10)};
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: ${unit(8)};
`;

const ProjectCard = styled.article<{ $active: boolean }>`
	border: ${({ $active }) => ($active ? `${unit(2)} solid rgba(67, 109, 186, 1)` : '1px solid rgba(219, 226, 238, 1)')};
	border-radius: ${unit(10)};
	background: white;
	padding: ${unit(8)};
	transition: border-color 0.2s ease;
	box-sizing: border-box;

	&:hover {
		border-color: ${({ $active }) => ($active ? 'rgba(67, 109, 186, 1)' : 'rgba(97, 121, 177, 0.55)')};
	}

	&:active {
		border-color: ${({ $active }) => ($active ? 'rgba(67, 109, 186, 1)' : 'rgba(97, 121, 177, 0.55)')};
	}

	h3 {
		font-size: ${unit(15)};
		font-weight: 700;
		color: rgba(27, 45, 80, 1);
	}

	p {
		margin-top: ${unit(4)};
		font-size: ${unit(13)};
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
		font-size: ${unit(15)};
		font-weight: 700;
		color: rgba(27, 45, 80, 1);
	}

	p {
		margin-top: ${unit(4)};
		font-size: ${unit(13)};
		color: rgba(88, 102, 128, 1);
	}
`;

const ThumbWrap = styled.div`
	width: 100%;
	aspect-ratio: 16 / 9;
	border-radius: ${unit(8)};
	overflow: hidden;
	background: rgba(231, 237, 248, 1);
	margin-bottom: ${unit(8)};

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
	font-size: ${unit(11)};
	font-weight: 700;
	color: rgba(89, 104, 128, 1);
`;

const CardMeta = styled.div`
	margin-top: ${unit(6)};
	display: flex;
	gap: ${unit(7)};
	font-size: ${unit(11)};
	color: rgba(111, 126, 153, 1);
`;

const PreviewPanel = styled.section`
	background: white;
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(12)};
	padding: ${unit(14)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const TitleRow = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
	flex-wrap: wrap;

	h2 {
		font-size: ${unit(20)};
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
	font-size: ${unit(12)};
	color: rgba(88, 102, 128, 1);
`;

const TopContent = styled.section`
	display: grid;
	grid-template-columns: 1.45fr 1fr;
	gap: ${unit(10)};
	align-items: stretch;
`;

const VideoPane = styled.div`
	border-radius: ${unit(10)};
	overflow: hidden;
	background: rgba(13, 20, 34, 1);
	aspect-ratio: 16 / 9;
	min-height: ${unit(220)};

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
	border-radius: ${unit(10)};
	padding: ${unit(10)};
	display: flex;
	flex-direction: column;
	gap: ${unit(8)};
	height: 100%;
	overflow: hidden;
`;

const AnalysisPanelGroup = styled.section`
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 0;
	height: 100%;
`;

const AnalysisPaneTitle = styled.h3`
	position: absolute;
	top: ${unit(-24)};
	right: ${unit(2)};
	font-size: ${unit(15)};
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
	font-size: ${unit(15)};
	font-weight: 700;
	color: rgba(27, 45, 80, 1);
`;

const AnalysisList = styled.ul`
	display: grid;
	grid-template-rows: repeat(5, minmax(0, 1fr));
	gap: ${unit(7)};
	height: 100%;
	overflow: hidden;
`;

const AnalysisItemCard = styled.li<{ $selected: boolean }>`
	border: 1px solid ${({ $selected }) => ($selected ? 'rgba(67, 109, 186, 1)' : 'rgba(226, 233, 244, 1)')};
	background: ${({ $selected }) => ($selected ? 'rgba(240, 246, 255, 1)' : 'white')};
	border-radius: ${unit(10)};
	padding: ${unit(10)};
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		border-color: rgba(116, 145, 198, 1);
		background: ${({ $selected }) => ($selected ? 'rgba(235, 243, 255, 1)' : 'rgba(247, 250, 255, 1)')};
	}
`;

const AnalysisEmptyCard = styled.li`
	border: 1px dashed rgba(173, 189, 216, 1);
	background: rgba(248, 251, 255, 1);
	border-radius: ${unit(10)};
	min-height: ${unit(78)};
	padding: ${unit(7)} ${unit(8)} ${unit(2)};
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
	gap: ${unit(6)};
	border: none;
	background: transparent;
	cursor: pointer;

	span {
		font-size: ${unit(13)};
		font-weight: 700;
		color: rgba(70, 92, 132, 1);
	}

`;

const PlusCircle = styled.span`
	width: ${unit(26)};
	height: ${unit(26)};
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: ${unit(999)};
	border: 1px solid rgba(134, 157, 198, 1);
	background: white;
	color: rgba(57, 91, 156, 1);
	font-size: ${unit(18)};
	font-weight: 700;
	line-height: 1;
`;

const AnalysisTopRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(4)};
	margin-bottom: ${unit(3)};
`;

const AnalysisTitleMain = styled.div`
	flex: 1;
	min-width: 0;

	width: 100%;

	strong {
		display: block;
		font-size: ${unit(17)};
		color: rgba(30, 44, 72, 1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

const AnalysisBottomRow = styled.div`
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: ${unit(6)};
`;

const AnalysisActions = styled.div`
	display: flex;
	flex-direction: row;
	gap: ${unit(4)};
	justify-content: flex-end;
`;

const AnalysisSubTitle = styled.small`
	display: block;
	font-size: ${unit(14)};
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
	gap: ${unit(4)};
	white-space: nowrap;
	margin-left: auto;
	align-self: flex-end;

	small {
		font-size: ${unit(11)};
		color: rgba(98, 111, 132, 1);
		line-height: 1.5;
	}
`;

const IconButton = styled.button<{ $danger?: boolean }>`
	width: ${unit(24)};
	height: ${unit(24)};
	border: 1px solid ${({ $danger }) => ($danger ? 'rgba(245, 170, 170, 1)' : 'rgba(43, 68, 112, 0.28)')};
	background: white;
	border-radius: ${unit(8)};
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

const StatusTag = styled.span<{ $status: AnalysisItem['status'] }>`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: ${unit(3)} ${unit(10)};
	border-radius: ${unit(999)};
	font-size: ${unit(10)};
	font-weight: 700;
	white-space: nowrap;
	background: ${({ $status }) =>
		$status === 'COMPLETE' ? 'rgba(224, 242, 229, 1)' : $status === 'IN_PROGRESS' ? 'rgba(230, 238, 255, 1)' : 'rgba(255, 232, 232, 1)'};
	color: ${({ $status }) =>
		$status === 'COMPLETE' ? 'rgba(25, 117, 60, 1)' : $status === 'IN_PROGRESS' ? 'rgba(42, 76, 149, 1)' : 'rgba(176, 38, 38, 1)'};
	border: 1px solid
		${({ $status }) =>
			$status === 'COMPLETE' ? 'rgba(170, 222, 185, 1)' : $status === 'IN_PROGRESS' ? 'rgba(181, 202, 245, 1)' : 'rgba(247, 181, 181, 1)'};
`;

const SummarySection = styled.section`
	border: 1px solid rgba(226, 233, 244, 1);
	border-radius: ${unit(10)};
	padding: ${unit(10)};
	display: flex;
	flex-direction: column;
	gap: ${unit(8)};
`;

const SummaryBox = styled.div`
	background: rgba(246, 249, 255, 1);
	border-radius: ${unit(8)};
	padding: ${unit(10)};
	font-size: ${unit(13)};
	color: rgba(45, 60, 90, 1);
`;

const KeywordRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: ${unit(6)};
`;

const Keyword = styled.span`
	padding: ${unit(4)} ${unit(9)};
	border-radius: ${unit(14)};
	background: rgba(225, 236, 255, 1);
	font-size: ${unit(11)};
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

const BottomActions = styled.div`
	margin-top: auto;
	display: flex;
	justify-content: flex-end;
	gap: ${unit(8)};
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

const PrimaryButton = styled.button`
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	border-radius: ${unit(8)};
	padding: ${unit(9)} ${unit(14)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(49, 95, 183, 1);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.22);
	}
`;

const RenameOverlay = styled.div<{ $closing?: boolean }>`
	@keyframes renameOverlayFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes renameOverlayFadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	position: fixed;
	inset: 0;
	background: rgba(8, 16, 33, 0.52);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1200;
	animation: ${({ $closing }) =>
		$closing ? 'renameOverlayFadeOut 0.22s ease forwards' : 'renameOverlayFadeIn 0.22s ease forwards'};
`;

const RenameModalCard = styled.section<{ $closing?: boolean }>`
	@keyframes renameModalFadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(${unit(18)});
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes renameModalFadeSlideOut {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(${unit(18)});
		}
	}

	width: min(${unit(420)}, calc(100vw - ${unit(32)}));
	background: white;
	border-radius: ${unit(16)};
	border: 1px solid rgba(222, 229, 237, 1);
	box-shadow: 0 ${unit(18)} ${unit(40)} rgba(18, 34, 66, 0.18);
	padding: ${unit(24)};
	display: flex;
	flex-direction: column;
	gap: ${unit(18)};
	animation: ${({ $closing }) =>
		$closing ? 'renameModalFadeSlideOut 0.22s ease forwards' : 'renameModalFadeSlideIn 0.22s ease forwards'};

	h3 {
		font-size: ${unit(22)};
		font-weight: 700;
		color: rgba(26, 43, 89, 1);
	}

	p {
		margin-top: ${unit(-10)};
		font-size: ${unit(14)};
		color: rgba(86, 102, 128, 1);
	}
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

const RenameActions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(8)};
`;

const RenameButton = styled.button<{ $secondary?: boolean }>`
	min-width: ${unit(78)};
	border: 1px solid ${({ $secondary }) => ($secondary ? 'rgba(202, 215, 236, 1)' : 'rgba(41, 85, 168, 1)')};
	background: ${({ $secondary }) => ($secondary ? 'rgba(246, 248, 252, 1)' : 'rgba(41, 85, 168, 1)')};
	color: ${({ $secondary }) => ($secondary ? 'rgba(53, 74, 112, 1)' : 'white')};
	border-radius: ${unit(8)};
	padding: ${unit(10)} ${unit(16)};
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

	&:hover {
		background: ${({ $secondary }) => ($secondary ? 'rgba(239, 244, 251, 1)' : 'rgba(49, 95, 183, 1)')};
		border-color: ${({ $secondary }) => ($secondary ? 'rgba(186, 203, 232, 1)' : 'rgba(49, 95, 183, 1)')};
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.22);
	}
`;
