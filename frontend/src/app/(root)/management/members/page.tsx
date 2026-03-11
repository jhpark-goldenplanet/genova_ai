'use client';

import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import ManagementTabs from '../../components/ManagementTabs';
import MemberManagementPage from '../../components/MemberManagementPage';

export default function ManagementMembersPage() {
	return (
		<Page>
			<Header>
				<h1>관리</h1>
				<p>멤버 권한과 사용 현황을 관리합니다.</p>
			</Header>
			<ManagementTabs />
			<MemberManagementPage />
		</Page>
	);
}

const Page = styled.main`
	padding: ${unit(26)} ${unit(28)};
`;

const Header = styled.header`
	margin-bottom: ${unit(12)};

	h1 {
		font-size: ${unit(26)};
		font-weight: 700;
		color: rgba(26, 43, 89, 1);
	}

	p {
		margin-top: ${unit(6)};
		font-size: ${unit(14)};
		color: rgba(86, 102, 128, 1);
	}
`;
