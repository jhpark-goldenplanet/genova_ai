'use client';

import styled from '@emotion/styled';
import { usePathname, useRouter } from 'next/navigation';
import { unit } from '@/shared/utils/base';

const TABS = [
	{ key: 'members', label: '멤버 관리', path: '/management/members' },
	{ key: 'roles', label: '역할 관리', path: '/management/roles' },
	{ key: 'subscription', label: '구독 관리', path: '/management/subscription' },
];

export default function ManagementTabs() {
	const pathname = usePathname() ?? '';
	const router = useRouter();

	return (
		<TabRow>
			{TABS.map((tab) => {
				const isActive = pathname.startsWith(tab.path);
				return (
					<TabButton key={tab.key} type="button" $active={isActive} onClick={() => router.push(tab.path)}>
						{tab.label}
					</TabButton>
				);
			})}
		</TabRow>
	);
}

const TabRow = styled.div`
	display: flex;
	gap: ${unit(8)};
	margin-bottom: ${unit(14)};
`;

const TabButton = styled.button<{ $active: boolean }>`
	border: 1px solid ${({ $active }) => ($active ? 'rgba(62, 101, 177, 1)' : 'rgba(205, 216, 234, 1)')};
	background: ${({ $active }) => ($active ? 'rgba(235, 243, 255, 1)' : 'white')};
	color: ${({ $active }) => ($active ? 'rgba(31, 72, 145, 1)' : 'rgba(75, 92, 124, 1)')};
	border-radius: ${unit(999)};
	padding: ${unit(8)} ${unit(14)};
	font-weight: 700;
	font-size: ${unit(13)};
	cursor: pointer;
	transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		border-color: ${({ $active }) => ($active ? 'rgba(62, 101, 177, 1)' : 'rgba(146, 167, 208, 1)')};
		background: ${({ $active }) => ($active ? 'rgba(235, 243, 255, 1)' : 'rgba(246, 249, 255, 1)')};
		color: ${({ $active }) => ($active ? 'rgba(31, 72, 145, 1)' : 'rgba(52, 73, 117, 1)')};
		box-shadow: 0 ${unit(4)} ${unit(10)} rgba(35, 63, 122, 0.08);
	}
`;
