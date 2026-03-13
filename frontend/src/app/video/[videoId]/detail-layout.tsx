'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { useModal } from '@/shared/hooks';
import { unit } from '@/shared/utils/base';

type Props = {
	children: ReactNode;
	title?: string;
};

interface AnalysisItem {
	id: string;
	name: string;
	promptLabel?: string;
	promptText?: string;
	splitCount?: number;
	mode?: 'AUTO' | 'CUSTOM';
}

interface WorkItem {
	title: string;
	source: string;
	uploadedAt: string;
	duration: string;
	videoId?: string;
	analyses: AnalysisItem[];
}

const TABS = [
	{ key: 'summary', label: '요약', path: 'summary' },
	{ key: 'split', label: '분할', path: 'split' },
];
const WORKSPACE_STORAGE_KEY = 'genova_workspace_mock_works_v1';

export default function VideoDetailLayout({ children, title = '작업 상세' }: Props) {
	const router = useRouter();
	const { custom, closeFreeModal } = useModal();
	const pathname = usePathname() ?? '';
	const params = useParams<{ videoId: string }>();
	const searchParams = useSearchParams();
	const videoId = params?.videoId ?? '';
	const analysisId = searchParams.get('analysisId') ?? '';
	const [works, setWorks] = useState<WorkItem[]>([]);

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
		() => selectedWork?.analyses.find((analysis) => analysis.id === analysisId) ?? selectedWork?.analyses[0],
		[selectedWork, analysisId],
	);
	const projectLabel = selectedWork?.title || '프로젝트';
	const analysisLabel = selectedAnalysis?.name || title;
	const handleOpenPromptModal = () => {
		custom({
			children: (
				<PromptModalCard>
					<h3>분석 설정</h3>
					<PromptModalRow>
						<span>모드</span>
						<strong>{selectedAnalysis?.mode === 'CUSTOM' ? '커스텀' : 'AI 자동'}</strong>
					</PromptModalRow>
					<PromptModalRow>
						<span>프리셋</span>
						<strong>{selectedAnalysis?.promptLabel || '-'}</strong>
					</PromptModalRow>
					<PromptModalRow>
						<span>분할 개수</span>
						<strong>{selectedAnalysis?.splitCount ? `${selectedAnalysis.splitCount}개` : '자동'}</strong>
					</PromptModalRow>
					<PromptTextBox>{selectedAnalysis?.promptText || '저장된 프롬프트가 없습니다.'}</PromptTextBox>
					<PromptCloseButton type="button" onClick={closeFreeModal}>
						닫기
					</PromptCloseButton>
				</PromptModalCard>
			),
		});
	};

	return (
		<Wrap>
			<Header>
				<TopBar>
					<Breadcrumb>
						<ProjectLink type="button" onClick={() => router.push('/workspace')}>
							{projectLabel}
						</ProjectLink>
						<BreadcrumbChevron aria-hidden="true">
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</BreadcrumbChevron>
						<CurrentLabel>{analysisLabel}</CurrentLabel>
					</Breadcrumb>
					<PromptButton type="button" onClick={handleOpenPromptModal}>
						프롬프트
					</PromptButton>
				</TopBar>

				<MetaRow>
					<MetaItem>원본 파일: {selectedWork?.source ?? '-'}</MetaItem>
					<MetaItem>업로드일: {selectedWork?.uploadedAt ?? '-'}</MetaItem>
					<MetaItem>길이: {selectedWork?.duration ?? '-'}</MetaItem>
				</MetaRow>

				<TabBar>
					{TABS.map((tab) => {
						const isActive = pathname.includes(`/${tab.path}`);
						return (
							<TabButton
								key={tab.key}
								type="button"
								$active={isActive}
								onClick={() => {
									if (!videoId) return;
									const query = analysisId ? `?analysisId=${analysisId}` : '';
									router.push(`/video/${videoId}/${tab.path}${query}`);
								}}
							>
								{tab.label}
							</TabButton>
						);
					})}
				</TabBar>
			</Header>

			<Content>{children}</Content>
		</Wrap>
	);
}

const Wrap = styled.main`
	display: flex;
	flex-direction: column;
	height: 100dvh;
	box-sizing: border-box;
	overflow: hidden;
	padding: ${unit(20)} ${unit(32)} ${unit(32)};
`;

const Header = styled.header`
	position: sticky;
	top: 0;
	padding: ${unit(12)} 0 ${unit(12)};
	background: rgba(255, 255, 255, 0.96);
	backdrop-filter: blur(${unit(10)});
	border-bottom: 1px solid rgba(223, 230, 240, 0.9);
	z-index: 60;
`;

const TopBar = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: ${unit(34)};
`;

const MetaRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: ${unit(10)};
	padding-top: ${unit(12)};
`;

const MetaItem = styled.span`
	font-size: ${unit(13)};
	color: rgba(86, 101, 129, 1);
	background: rgba(240, 245, 252, 1);
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(999)};
	padding: ${unit(6)} ${unit(12)};
`;

const Breadcrumb = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
`;

const BreadcrumbChevron = styled.i`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	margin-left: ${unit(5)};
	color: rgba(117, 132, 160, 1);
`;

const ProjectLink = styled.button`
	padding: ${unit(4)} ${unit(8)};
	margin-right: ${unit(-8)};
	border-radius: ${unit(8)};
	font-size: ${unit(15)};
	font-weight: 700;
	color: rgba(77, 103, 156, 1);
	cursor: pointer;
	transition: color 0.2s ease, background-color 0.2s ease;

	&:hover {
		color: rgba(41, 85, 168, 1);
		background: rgba(239, 245, 255, 1);
	}
`;

const CurrentLabel = styled.span`
	font-size: ${unit(27)} !important;
	font-weight: 800;
	color: rgba(26, 43, 89, 1) !important;
`;

const PromptButton = styled.button`
	border: 1px solid rgba(186, 203, 233, 1);
	background: rgba(246, 249, 255, 1);
	color: rgba(51, 78, 132, 1);
	border-radius: ${unit(999)};
	padding: ${unit(8)} ${unit(16)};
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;

	&:hover {
		background: rgba(236, 243, 255, 1);
		border-color: rgba(149, 176, 223, 1);
		color: rgba(41, 85, 168, 1);
	}
`;

const TabBar = styled.div`
	display: flex;
	gap: ${unit(10)};
	padding-top: ${unit(14)};
`;

const TabButton = styled.button<{ $active: boolean }>`
	border: 1px solid ${({ $active }) => ($active ? 'rgba(62, 101, 177, 1)' : 'rgba(205, 216, 234, 1)')};
	background: ${({ $active }) => ($active ? 'rgba(235, 243, 255, 1)' : 'white')};
	color: ${({ $active }) => ($active ? 'rgba(31, 72, 145, 1)' : 'rgba(75, 92, 124, 1)')};
	border-radius: ${unit(999)};
	padding: ${unit(8)} ${unit(16)};
	font-weight: 700;
	font-size: ${unit(14)};
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		border-color: ${({ $active }) => ($active ? 'rgba(62, 101, 177, 1)' : 'rgba(160, 181, 220, 1)')};
		background: ${({ $active }) => ($active ? 'rgba(235, 243, 255, 1)' : 'rgba(247, 250, 255, 1)')};
		color: ${({ $active }) => ($active ? 'rgba(31, 72, 145, 1)' : 'rgba(56, 79, 123, 1)')};
		box-shadow: 0 ${unit(4)} ${unit(10)} rgba(40, 70, 130, 0.08);
	}
`;

const Content = styled.section`
	flex: 1;
	min-height: 0;
	overflow: hidden;
	padding-top: ${unit(8)};
`;

const PromptModalCard = styled.section`
	width: min(${unit(480)}, calc(100vw - ${unit(32)}));
	background: white;
	border-radius: ${unit(16)};
	padding: ${unit(26)};
	display: flex;
	flex-direction: column;
	gap: ${unit(16)};

	h3 {
		font-size: ${unit(24)};
		font-weight: 800;
		color: rgba(26, 43, 89, 1);
	}
`;

const PromptModalRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(12)};
	font-size: ${unit(15)};

	span {
		color: rgba(92, 108, 136, 1);
		font-weight: 600;
	}

	strong {
		color: rgba(35, 52, 86, 1);
		font-weight: 700;
	}
`;

const PromptTextBox = styled.div`
	border: 1px solid rgba(223, 230, 240, 1);
	border-radius: ${unit(12)};
	background: rgba(247, 250, 255, 1);
	padding: ${unit(16)};
	font-size: ${unit(14)};
	line-height: ${unit(24)};
	color: rgba(55, 71, 103, 1);
	white-space: pre-wrap;
`;

const PromptCloseButton = styled.button`
	align-self: flex-end;
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	border-radius: ${unit(8)};
	padding: ${unit(10)} ${unit(16)};
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
`;
