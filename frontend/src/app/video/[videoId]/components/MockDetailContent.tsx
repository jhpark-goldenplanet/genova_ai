'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
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

const statusLabel = (status: AnalysisItem['status']) => {
	if (status === 'COMPLETE') return '완료';
	if (status === 'IN_PROGRESS') return '작업 중';
	return '실패';
};

type Props = {
	videoId: string;
	tab: DetailTabType;
};

export default function MockDetailContent({ videoId, tab }: Props) {
	const searchParams = useSearchParams();
	const initialAnalysisId = searchParams.get('analysisId') ?? '';

	const [works, setWorks] = useState<WorkItem[]>([]);
	const [selectedAnalysisId, setSelectedAnalysisId] = useState(initialAnalysisId);

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

	useEffect(() => {
		if (!selectedWork?.analyses?.length) return;
		setSelectedAnalysisId((prev) => {
			if (prev && selectedWork.analyses.some((analysis) => analysis.id === prev)) return prev;
			return selectedWork.analyses[0].id;
		});
	}, [selectedWork]);

	const tabTitle =
		tab === 'summary' ? '요약 브리핑' : tab === 'script' ? '스크립트 편집 영역' : '수동 분할 편집 영역';

	return (
		<Wrap>
			<WorkTitle>{selectedAnalysis?.name ?? '분석 A'}</WorkTitle>
			<ProjectName>프로젝트: {selectedWork?.title ?? '-'}</ProjectName>

			<InfoBar>
				<span>원본 파일: {selectedWork?.source ?? '-'}</span>
				<span>업로드일: {selectedWork?.uploadedAt ?? '-'}</span>
				<span>길이: {selectedWork?.duration ?? '-'}</span>
			</InfoBar>

			<VideoBox>
				{selectedWork?.videoUrl ? (
					<video controls preload="metadata" poster={selectedWork.thumbnailUrl}>
						<source src={selectedWork.videoUrl} />
					</video>
				) : (
					<EmptyText>원본 영상 미리보기 영역</EmptyText>
				)}
			</VideoBox>

			<ContentBox>
				<h3>{tabTitle}</h3>
				{tab === 'summary' ? (
					selectedAnalysis ? (
						<>
							<SummaryText>{selectedAnalysis.briefing || '요약 정보가 없습니다.'}</SummaryText>
							<MetaRow>프롬프트: {selectedAnalysis.promptLabel}</MetaRow>
							<TagRow>
								{selectedAnalysis.keywords?.length
									? selectedAnalysis.keywords.map((keyword) => <Tag key={`tag-${selectedAnalysis.id}-${keyword}`}>{keyword}</Tag>)
									: <EmptyText>키워드 없음</EmptyText>}
							</TagRow>
						</>
					) : (
						<EmptyText>선택된 분석이 없습니다.</EmptyText>
					)
				) : (
					<Placeholder>
						<p>UI 설계 중입니다.</p>
						<span>여기에 {tab === 'script' ? '스크립트 조회/수정' : '분할점 조정/재생성'} 영역이 들어갑니다.</span>
					</Placeholder>
				)}
			</ContentBox>
		</Wrap>
	);
}

const Wrap = styled.main`
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
`;

const WorkTitle = styled.h2`
	font-size: ${unit(22)};
	font-weight: 700;
	color: rgba(31, 48, 81, 1);
`;

const ProjectName = styled.p`
	font-size: ${unit(13)};
	color: rgba(90, 105, 134, 1);
`;

const InfoBar = styled.section`
	display: flex;
	flex-wrap: wrap;
	gap: ${unit(8)};

	span {
		font-size: ${unit(12)};
		color: rgba(86, 101, 129, 1);
		background: rgba(240, 245, 252, 1);
		border: 1px solid rgba(223, 230, 240, 1);
		border-radius: ${unit(999)};
		padding: ${unit(5)} ${unit(10)};
	}
`;

const VideoBox = styled.article`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(12)};
	background: rgba(244, 247, 252, 1);
	padding: ${unit(10)};
	aspect-ratio: 16 / 9;

	video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: ${unit(8)};
		background: black;
	}
`;

const ContentBox = styled.section`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(12)};
	background: white;
	padding: ${unit(12)};
	min-height: ${unit(240)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};

	h3 {
		font-size: ${unit(16)};
		font-weight: 700;
		color: rgba(35, 52, 86, 1);
	}
`;

const SummaryText = styled.p`
	font-size: ${unit(14)};
	line-height: ${unit(22)};
	color: rgba(58, 73, 105, 1);
`;

const MetaRow = styled.p`
	font-size: ${unit(12)};
	color: rgba(92, 108, 136, 1);
`;

const TagRow = styled.div`
	display: flex;
	gap: ${unit(6)};
	flex-wrap: wrap;
`;

const Tag = styled.span`
	padding: ${unit(4)} ${unit(10)};
	border-radius: ${unit(999)};
	border: 1px solid rgba(190, 209, 238, 1);
	background: rgba(242, 248, 255, 1);
	font-size: ${unit(12)};
	color: rgba(61, 89, 139, 1);
`;

const Placeholder = styled.div`
	flex: 1;
	border: 1px dashed rgba(188, 201, 223, 1);
	background: rgba(248, 251, 255, 1);
	border-radius: ${unit(10)};
	padding: ${unit(16)};
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	text-align: center;
	gap: ${unit(6)};

	p {
		font-size: ${unit(16)};
		font-weight: 700;
		color: rgba(60, 79, 116, 1);
	}

	span {
		font-size: ${unit(13)};
		color: rgba(95, 109, 137, 1);
	}
`;

const EmptyText = styled.p`
	color: rgba(90, 107, 138, 1);
	font-size: ${unit(13)};
`;
