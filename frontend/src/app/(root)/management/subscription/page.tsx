'use client';

import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { useMemo } from 'react';
import ManagementTabs from '../../components/ManagementTabs';
import { readTokenState, getRemaining } from '@/shared/utils/tokenState';

export default function SubscriptionPage() {
	const tokenState = useMemo(() => readTokenState(), []);
	const remaining = getRemaining(tokenState);

	return (
		<Page>
			<Header>
				<h1>관리</h1>
				<p>기관 공용 토큰 및 플랜 상태를 확인합니다.</p>
			</Header>
			<ManagementTabs />

			<Card>
				<Row>
					<Label>현재 플랜</Label>
					<Value>{tokenState.org.plan}</Value>
				</Row>
				<Row>
					<Label>최초 시작일</Label>
					<Value>2026-01-01</Value>
				</Row>
				<Row>
					<Label>토큰 갱신일</Label>
					<Value>{tokenState.org.resetDate}</Value>
				</Row>
				<Row>
					<Label>현재 남은 토큰</Label>
					<Value>{remaining.toLocaleString()}</Value>
				</Row>
				<Row>
					<Label>월 제공 토큰</Label>
					<Value>{tokenState.org.monthlyLimit.toLocaleString()}</Value>
				</Row>
				<Row>
					<Label>플랜 내 사용자 수</Label>
					<Value>35명</Value>
				</Row>
			</Card>

			<Notice>
				플랜 변경은 자동 결제 없이 운영자 수동 반영으로 처리됩니다.
				<ActionButton type="button">플랜 변경 신청</ActionButton>
			</Notice>
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

const Card = styled.section`
	margin-top: ${unit(14)};
	background: white;
	border: 1px solid rgba(220, 229, 243, 1);
	border-radius: ${unit(12)};
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
	max-width: ${unit(760)};
`;

const Row = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: ${unit(8)} 0;
	border-bottom: 1px dashed rgba(226, 234, 246, 1);

	&:last-of-type {
		border-bottom: none;
	}
`;

const Label = styled.span`
	font-size: ${unit(14)};
	color: rgba(87, 102, 128, 1);
`;

const Value = styled.strong`
	font-size: ${unit(15)};
	color: rgba(31, 53, 92, 1);
`;

const Notice = styled.div`
	margin-top: ${unit(14)};
	max-width: ${unit(760)};
	background: rgba(243, 248, 255, 1);
	border: 1px solid rgba(207, 222, 246, 1);
	border-radius: ${unit(10)};
	padding: ${unit(14)};
	color: rgba(64, 83, 119, 1);
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: ${unit(12)};
	font-size: ${unit(13)};
`;

const ActionButton = styled.button`
	border: none;
	background: rgba(42, 87, 170, 1);
	color: white;
	padding: ${unit(8)} ${unit(12)};
	border-radius: ${unit(8)};
	font-weight: 700;
	cursor: pointer;
	white-space: nowrap;
`;
