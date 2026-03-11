'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';

type Props = {
	children: ReactNode;
	title?: string;
};

const TABS = [
	{ key: 'summary', label: '요약', path: 'summary' },
	{ key: 'script', label: '스크립트', path: 'script' },
	{ key: 'split', label: '분할', path: 'split' },
	{ key: 'settings', label: '설정·재생성', path: 'settings' },
];

export default function VideoDetailLayout({ children, title = '작업 상세' }: Props) {
	const router = useRouter();
	const pathname = usePathname() ?? '';

	return (
		<Wrap>
			<TopBar>
				<BackButton type="button" onClick={() => router.push('/workspace')}>
					프로젝트 목록으로
				</BackButton>
				<Title>{title}</Title>
				<ActionGroup>
					<SubtleButton type="button" onClick={() => router.push('/workspace/new')}>
						새 작업
					</SubtleButton>
					<PrimaryButton type="button" onClick={() => router.push('/workspace/new')}>
						재생성
					</PrimaryButton>
				</ActionGroup>
			</TopBar>

			<TabBar>
				{TABS.map((tab) => {
					const isActive = pathname.includes(`/${tab.path}`);
					return (
						<TabButton
							key={tab.key}
							type="button"
							$active={isActive}
							onClick={() => {
								const parts = pathname.split('/');
								const videoId = parts[2];
								if (!videoId) return;
								router.push(`/video/${videoId}/${tab.path}`);
							}}
						>
							{tab.label}
						</TabButton>
					);
				})}
			</TabBar>

			<Content>{children}</Content>
		</Wrap>
	);
}

const Wrap = styled.main`
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const TopBar = styled.header`
	display: flex;
	align-items: center;
	gap: ${unit(10)};
`;

const BackButton = styled.button`
	border: 1px solid rgba(194, 208, 229, 1);
	background: white;
	color: rgba(43, 62, 98, 1);
	border-radius: ${unit(8)};
	padding: ${unit(8)} ${unit(12)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
`;

const Title = styled.h1`
	font-size: ${unit(22)};
	font-weight: 700;
	color: rgba(26, 43, 89, 1);
`;

const ActionGroup = styled.div`
	margin-left: auto;
	display: flex;
	gap: ${unit(8)};
`;

const SubtleButton = styled.button`
	border: 1px solid rgba(194, 208, 229, 1);
	background: white;
	color: rgba(43, 62, 98, 1);
	border-radius: ${unit(8)};
	padding: ${unit(8)} ${unit(12)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
`;

const PrimaryButton = styled.button`
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	border-radius: ${unit(8)};
	padding: ${unit(8)} ${unit(12)};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
`;

const TabBar = styled.div`
	display: flex;
	gap: ${unit(8)};
	border-bottom: 1px solid rgba(223, 230, 240, 1);
	padding-bottom: ${unit(8)};
`;

const TabButton = styled.button<{ $active: boolean }>`
	border: 1px solid ${({ $active }) => ($active ? 'rgba(62, 101, 177, 1)' : 'rgba(205, 216, 234, 1)')};
	background: ${({ $active }) => ($active ? 'rgba(235, 243, 255, 1)' : 'white')};
	color: ${({ $active }) => ($active ? 'rgba(31, 72, 145, 1)' : 'rgba(75, 92, 124, 1)')};
	border-radius: ${unit(999)};
	padding: ${unit(7)} ${unit(14)};
	font-weight: 700;
	font-size: ${unit(13)};
	cursor: pointer;
`;

const Content = styled.section`
	padding-top: ${unit(4)};
`;
