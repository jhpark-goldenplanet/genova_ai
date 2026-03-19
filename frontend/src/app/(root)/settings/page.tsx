'use client';

import { FormEvent, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import Button from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { unit } from '@/shared/utils/base';
import { successToast } from '@/shared/utils/toastUtils';

export default function SettingsPage() {
	const { nickname, updateNickname } = useAuth();
	const [nextNickname, setNextNickname] = useState(nickname);

	useEffect(() => {
		setNextNickname(nickname);
	}, [nickname]);

	const onChangeNickname = (value: string) => {
		setNextNickname(value);
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		updateNickname(nextNickname);
		successToast('닉네임이 저장되었습니다.');
	};

	return (
		<Page>
			<Header>
				<h1>설정</h1>
				<p>내 정보를 관리합니다.</p>
			</Header>

			<FormCard onSubmit={onSubmit}>
				<label htmlFor="nickname">닉네임</label>
				<input id="nickname" value={nextNickname} onChange={(e) => onChangeNickname(e.target.value)} placeholder="닉네임 입력" />
				<Button type="submit" status="primary" width={92}>
					저장
				</Button>
			</FormCard>
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

const FormCard = styled.form`
	max-width: ${unit(620)};
	background: white;
	border: 1px solid rgba(221, 231, 245, 1);
	border-radius: ${unit(12)};
	padding: ${unit(18)};
	display: flex;
	flex-direction: column;
	gap: ${unit(8)};

	label {
		font-size: ${unit(14)};
		font-weight: 700;
		color: rgba(53, 74, 112, 1);
	}

	input {
		height: ${unit(44)};
		border: 1px solid rgba(202, 215, 236, 1);
		border-radius: ${unit(8)};
		padding: 0 ${unit(12)};
		font-size: ${unit(14)};
		color: rgba(30, 47, 80, 1);
	}
`;
