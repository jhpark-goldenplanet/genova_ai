'use client';

import { FormEvent, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/shared/hooks';
import { unit } from '@/shared/utils/base';
import { successToast } from '@/shared/utils/toastUtils';

export default function NicknameModal() {
	const { nickname, updateNickname } = useAuth();
	const { closeFreeModal } = useModal();
	const [nextNickname, setNextNickname] = useState(nickname);

	useEffect(() => {
		setNextNickname(nickname);
	}, [nickname]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		updateNickname(nextNickname);
		successToast('닉네임이 저장되었습니다.');
		closeFreeModal();
	};

	return (
		<Container onSubmit={handleSubmit}>
			<Header>
				<h2>닉네임 변경</h2>
				<p>사이드바에 표시할 이름을 설정합니다.</p>
			</Header>

			<Field>
				<label htmlFor="nickname-modal">닉네임</label>
				<input
					id="nickname-modal"
					value={nextNickname}
					onChange={(e) => setNextNickname(e.target.value)}
					placeholder="닉네임 입력"
					autoFocus
				/>
			</Field>

			<ButtonRow>
				<SecondaryButton type="button" onClick={closeFreeModal}>
					취소
				</SecondaryButton>
				<PrimaryButton type="submit">저장</PrimaryButton>
			</ButtonRow>
		</Container>
	);
}

const Container = styled.form`
	width: min(${unit(420)}, calc(100vw - ${unit(32)}));
	background: white;
	border-radius: ${unit(16)};
	padding: ${unit(24)};
	display: flex;
	flex-direction: column;
	gap: ${unit(18)};
	box-shadow: 0 ${unit(18)} ${unit(40)} rgba(18, 34, 66, 0.18);
`;

const Header = styled.header`
	h2 {
		font-size: ${unit(22)};
		font-weight: 700;
		color: rgba(26, 43, 89, 1);
	}

	p {
		margin-top: ${unit(6)};
		font-size: ${unit(14)};
		color: rgba(86, 102, 128, 1);
	}
`;

const Field = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(8)};

	label {
		font-size: ${unit(14)};
		font-weight: 700;
		color: rgba(53, 74, 112, 1);
	}

	input {
		height: ${unit(46)};
		border: 1px solid rgba(202, 215, 236, 1);
		border-radius: ${unit(10)};
		padding: 0 ${unit(12)};
		font-size: ${unit(14)};
		color: rgba(30, 47, 80, 1);
	}
`;

const ButtonRow = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(10)};
`;

const ModalButton = styled.button`
	min-width: ${unit(78)};
	border-radius: ${unit(8)};
	padding: ${unit(10)} ${unit(16)};
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
`;

const SecondaryButton = styled(ModalButton)`
	border: 1px solid rgba(202, 215, 236, 1);
	background: rgba(246, 248, 252, 1);
	color: rgba(53, 74, 112, 1);
`;

const PrimaryButton = styled(ModalButton)`
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
`;
