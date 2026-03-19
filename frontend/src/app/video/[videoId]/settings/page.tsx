'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import Button from '@/components/Button';
import { unit } from '@/shared/utils/base';
import { successToast } from '@/shared/utils/toastUtils';
import VideoDetailLayout from '../detail-layout';

type AnalysisMode = 'AUTO' | 'CUSTOM';

interface AnalysisItem {
	id: string;
	name: string;
	status: 'COMPLETE' | 'IN_PROGRESS' | 'FAILED';
	updatedAt: string;
	promptLabel: string;
	briefing: string;
	keywords: string[];
	promptText?: string;
	splitCount?: number;
	mode?: AnalysisMode;
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

const nowStamp = () => {
	const now = new Date();
	return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')} ${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
};

export default function SettingsPage() {
	const router = useRouter();
	const params = useParams<{ videoId: string }>();
	const videoId = params?.videoId ?? '';

	const [works, setWorks] = useState<WorkItem[]>([]);
	const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
	const [mode, setMode] = useState<AnalysisMode>('AUTO');
	const [presetName, setPresetName] = useState('');
	const [prompt, setPrompt] = useState('');
	const [splitCount, setSplitCount] = useState(5);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]');
			setWorks(Array.isArray(parsed) ? parsed : []);
		} catch (error) {
			setWorks([]);
		}
	}, []);

	const selectedWork = useMemo(() => works.find((item) => item.videoId === videoId), [works, videoId]);
	const selectedAnalysis = useMemo(
		() => selectedWork?.analyses.find((item) => item.id === selectedAnalysisId) ?? selectedWork?.analyses[0],
		[selectedWork, selectedAnalysisId],
	);

	useEffect(() => {
		if (!selectedWork) return;
		if (!selectedWork.analyses.length) {
			setSelectedAnalysisId('');
			setMode('AUTO');
			setPresetName('기본 요약');
			setPrompt('핵심 정책 이슈와 실행 포인트를 우선 요약해 주세요.');
			setSplitCount(5);
			return;
		}
		const first = selectedWork.analyses[0];
		setSelectedAnalysisId((prev) => prev || first.id);
	}, [selectedWork]);

	useEffect(() => {
		if (!selectedAnalysis) return;
		setMode(selectedAnalysis.mode ?? (selectedAnalysis.promptLabel === 'AI 자동' ? 'AUTO' : 'CUSTOM'));
		setPresetName(selectedAnalysis.promptLabel || '기본 요약');
		setPrompt(selectedAnalysis.promptText || '핵심 정책 이슈와 실행 포인트를 우선 요약해 주세요.');
		setSplitCount(selectedAnalysis.splitCount || 5);
	}, [selectedAnalysis]);

	const persistWorks = (nextWorks: WorkItem[]) => {
		setWorks(nextWorks);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(nextWorks));
		}
	};

	const updateCurrentAnalysis = () => {
		if (!selectedWork || !selectedAnalysis) return;
		const updatedAt = nowStamp();
		const nextWorks = works.map((work) => {
			if (work.id !== selectedWork.id) return work;
			return {
				...work,
				analyses: work.analyses.map((analysis) =>
					analysis.id !== selectedAnalysis.id
						? analysis
						: {
								...analysis,
								promptLabel: mode === 'AUTO' ? 'AI 자동' : presetName || '커스텀 프리셋',
								promptText: prompt,
								splitCount,
								mode,
								updatedAt,
						  },
				),
			};
		});
		persistWorks(nextWorks);
		successToast('설정이 저장되었습니다.');
	};

	const createNewAnalysis = () => {
		if (!selectedWork) return;
		const updatedAt = nowStamp();
		const newAnalysis: AnalysisItem = {
			id: `analysis-${Date.now()}`,
			name: `분석 ${selectedWork.analyses.length + 1}`,
			status: 'IN_PROGRESS',
			updatedAt,
			promptLabel: mode === 'AUTO' ? 'AI 자동' : presetName || '커스텀 프리셋',
			briefing: '분석이 아직 실행되지 않았습니다. 재생성 후 결과를 확인하세요.',
			keywords: [],
			promptText: prompt,
			splitCount,
			mode,
		};
		const nextWorks = works.map((work) =>
			work.id === selectedWork.id ? { ...work, analyses: [...work.analyses, newAnalysis] } : work,
		);
		persistWorks(nextWorks);
		setSelectedAnalysisId(newAnalysis.id);
		successToast('새 분석 작업이 추가되었습니다.');
	};

	return (
		<VideoDetailLayout title="작업 상세 - 설정·재생성">
			<Page>
				<Header>
					<div>
						<h2>분석 설정</h2>
						<p>프롬프트와 분할 개수를 조정한 뒤 저장하거나 새 분석으로 재생성할 수 있습니다.</p>
					</div>
					<Button type="button" status="primary" onClick={() => router.push(`/video/${videoId}/summary`)} width={92}>
						요약 보기
					</Button>
				</Header>

				{selectedWork ? (
					<>
						<Section>
							<label>대상 분석 작업</label>
							<select
								value={selectedAnalysis?.id ?? ''}
								onChange={(e) => setSelectedAnalysisId(e.target.value)}
							>
								{selectedWork.analyses.map((analysis) => (
									<option key={analysis.id} value={analysis.id}>
										{analysis.name} ({analysis.promptLabel})
									</option>
								))}
							</select>
						</Section>

						<Section>
							<label>분석 모드</label>
							<ModeRow>
								<ModeButton type="button" $active={mode === 'AUTO'} onClick={() => setMode('AUTO')}>
									AI 자동
								</ModeButton>
								<ModeButton type="button" $active={mode === 'CUSTOM'} onClick={() => setMode('CUSTOM')}>
									커스텀
								</ModeButton>
							</ModeRow>
						</Section>

						<Grid>
							<Section>
								<label>프리셋 이름</label>
								<input
									value={presetName}
									onChange={(e) => setPresetName(e.target.value)}
									placeholder="예: 핵심 요약형"
								/>
							</Section>
							<Section>
								<label>분할 개수</label>
								<select value={splitCount} onChange={(e) => setSplitCount(Number(e.target.value))}>
									{[3, 4, 5, 6, 7, 8].map((count) => (
										<option key={`settings-split-${count}`} value={count}>
											{count}개
										</option>
									))}
								</select>
							</Section>
						</Grid>

						<Section>
							<label>프롬프트</label>
							<textarea
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								disabled={mode === 'AUTO'}
								placeholder="커스텀 분석 프롬프트를 입력하세요."
							/>
						</Section>

						<ActionRow>
							<Button type="button" status="neutral_outlined" onClick={updateCurrentAnalysis} width={128}>
								현재 작업 설정 저장
							</Button>
							<Button type="button" status="primary" onClick={createNewAnalysis} width={128}>
								새 분석으로 재생성
							</Button>
						</ActionRow>
					</>
				) : (
					<Empty>
						<p>연결된 작업이 없습니다.</p>
						<Button type="button" status="neutral_outlined" onClick={() => router.push('/workspace')} width={124}>
							작업목록으로 이동
						</Button>
					</Empty>
				)}
			</Page>
		</VideoDetailLayout>
	);
}

const Page = styled.main`
	display: flex;
	flex-direction: column;
	gap: ${unit(14)};
`;

const Header = styled.header`
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: ${unit(10)};

	h2 {
		font-size: ${unit(24)};
		font-weight: 700;
		color: rgba(30, 46, 82, 1);
	}

	p {
		margin-top: ${unit(4)};
		color: rgba(95, 109, 137, 1);
		font-size: ${unit(13)};
	}
`;

const Grid = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: ${unit(12)};

	@media screen and (max-width: 980px) {
		grid-template-columns: 1fr;
	}
`;

const Section = styled.section`
	display: flex;
	flex-direction: column;
	gap: ${unit(6)};
	padding: ${unit(12)};
	border: 1px solid rgba(220, 228, 241, 1);
	border-radius: ${unit(10)};
	background: rgba(250, 252, 255, 1);

	label {
		font-size: ${unit(13)};
		font-weight: 700;
		color: rgba(53, 71, 104, 1);
	}

	input,
	select,
	textarea {
		border: 1px solid rgba(194, 208, 229, 1);
		border-radius: ${unit(8)};
		padding: ${unit(9)} ${unit(11)};
		font-size: ${unit(13)};
		color: rgba(48, 64, 95, 1);
		background: white;
	}

	textarea {
		min-height: ${unit(180)};
		resize: vertical;
	}
`;

const ModeRow = styled.div`
	display: flex;
	gap: ${unit(8)};
`;

const ModeButton = styled.button<{ $active: boolean }>`
	border: 1px solid ${({ $active }) => ($active ? 'rgba(55, 91, 168, 1)' : 'rgba(199, 211, 230, 1)')};
	background: ${({ $active }) => ($active ? 'rgba(237, 243, 255, 1)' : 'white')};
	color: ${({ $active }) => ($active ? 'rgba(35, 68, 140, 1)' : 'rgba(80, 97, 131, 1)')};
	border-radius: ${unit(999)};
	padding: ${unit(6)} ${unit(14)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
`;

const ActionRow = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(8)};
`;

const Empty = styled.section`
	border: 1px dashed rgba(197, 210, 232, 1);
	border-radius: ${unit(10)};
	background: rgba(248, 251, 255, 1);
	padding: ${unit(24)};
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: ${unit(10)};

	p {
		color: rgba(77, 95, 130, 1);
	}
`;
