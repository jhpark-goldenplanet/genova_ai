'use client';

import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import ManagementTabs from '../../components/ManagementTabs';
import RoleManagementPage from '../../components/RoleManagementPage';

export default function ManagementRolesPage() {
	return (
		<Page>
			<Header>
				<h1>관리</h1>
				<p>역할별 권한을 설정하고 관리합니다.</p>
			</Header>
			<ManagementTabs />
			<RoleManagementPage />
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
