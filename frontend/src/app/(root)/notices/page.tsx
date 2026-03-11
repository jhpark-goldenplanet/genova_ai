'use client';

import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';

const NOTICE_ITEMS = [
	{ id: 1, date: '2026-03-11', title: '워크스페이스 기반 UI 개편 준비 안내', type: '업데이트' },
	{ id: 2, date: '2026-03-08', title: '분석 토큰 운영 정책(기관 공용) 적용 예정', type: '운영' },
	{ id: 3, date: '2026-03-01', title: '영상 분석 품질 개선 점검 공지', type: '점검' },
];

export default function NoticesPage() {
	return (
		<Page>
			<Header>
				<h1>공지사항</h1>
				<p>서비스 변경 및 운영 관련 공지를 확인할 수 있습니다.</p>
			</Header>

			<List>
				{NOTICE_ITEMS.map((item) => (
					<li key={item.id}>
						<div>
							<TypeBadge>{item.type}</TypeBadge>
							<strong>{item.title}</strong>
						</div>
						<time>{item.date}</time>
					</li>
				))}
			</List>
		</Page>
	);
}

const Page = styled.main`
	padding: ${unit(26)} ${unit(28)};
`;

const Header = styled.header`
	margin-bottom: ${unit(16)};

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

const List = styled.ul`
	max-width: ${unit(860)};
	border: 1px solid rgba(220, 230, 244, 1);
	border-radius: ${unit(12)};
	overflow: hidden;
	background: white;

	li {
		padding: ${unit(14)} ${unit(16)};
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(232, 238, 248, 1);
	}

	li:last-of-type {
		border-bottom: none;
	}

	div {
		display: flex;
		align-items: center;
		gap: ${unit(8)};
	}

	strong {
		font-size: ${unit(14)};
		color: rgba(32, 51, 89, 1);
	}

	time {
		font-size: ${unit(12)};
		color: rgba(102, 118, 143, 1);
	}
`;

const TypeBadge = styled.span`
	font-size: ${unit(11)};
	font-weight: 700;
	color: rgba(39, 76, 145, 1);
	background: rgba(231, 240, 255, 1);
	border-radius: ${unit(999)};
	padding: ${unit(4)} ${unit(8)};
`;
