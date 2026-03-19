'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import Button from '@/components/Button';
import * as ModalS from '@/components/Modal/styled';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/shared/hooks';
import { unit } from '@/shared/utils/base';
import { successToast } from '@/shared/utils/toastUtils';

type ProfileInfo = {
	organization: string;
	userId: string;
	role: string;
	usedTokens: number;
};

const formatTokens = (usedTokens: number) => `${usedTokens.toLocaleString()} Tokens`;

const resolveProfileInfo = (userId: string, email: string, nickname: string): ProfileInfo => {
	const normalizedId = userId || email || nickname || 'user';

	if (email.endsWith('@goldenplanet.co.kr')) {
		return {
			organization: '골든플래닛',
			userId: normalizedId,
			role: '관리자',
			usedTokens: 98,
		};
	}

	return {
		organization: '농정원',
		userId: normalizedId,
		role: '편집자',
		usedTokens: 120,
	};
};

export default function ProfileModal() {
	const { user, nickname, updateNickname } = useAuth();
	const { closeFreeModal } = useModal();
	const [nextNickname, setNextNickname] = useState(nickname);

	useEffect(() => {
		setNextNickname(nickname);
	}, [nickname]);

	const profileInfo = useMemo(
		() => resolveProfileInfo(user?.uid ?? '', user?.email ?? '', nickname),
		[user?.email, user?.uid, nickname],
	);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		updateNickname(nextNickname);
		successToast('닉네임이 저장되었습니다.');
		closeFreeModal();
	};

	return (
		<Container onSubmit={handleSubmit}>
			<ModalS.SharedModalHeader>
				<ModalS.SharedModalTitle>프로필 관리</ModalS.SharedModalTitle>
				<ModalS.SharedModalDescription>닉네임을 수정하고 본인 계정 정보를 확인할 수 있습니다.</ModalS.SharedModalDescription>
			</ModalS.SharedModalHeader>

			<ModalS.SharedModalBody>
				<ProfileCard>
					<SectionTitle>회원 정보</SectionTitle>
					<ProfileGrid>
						<ProfileField>
							<span>소속</span>
							<strong>{profileInfo.organization}</strong>
						</ProfileField>
						<ProfileField>
							<span>유저명</span>
							<strong>{nickname || user?.displayName || '-'}</strong>
						</ProfileField>
						<ProfileField>
							<span>ID</span>
							<strong>{profileInfo.userId}</strong>
						</ProfileField>
						<ProfileField>
							<span>권한</span>
							<strong>{profileInfo.role}</strong>
						</ProfileField>
						<ProfileField $emphasis>
							<span>Tokens</span>
							<strong>{formatTokens(profileInfo.usedTokens)}</strong>
						</ProfileField>
					</ProfileGrid>
				</ProfileCard>

				<Field>
					<label htmlFor="profile-nickname-modal">유저명 변경</label>
					<input
						id="profile-nickname-modal"
						value={nextNickname}
						onChange={(e) => setNextNickname(e.target.value)}
						placeholder="닉네임 입력"
						autoFocus
					/>
				</Field>
			</ModalS.SharedModalBody>

			<ModalS.SharedModalFooter>
				<Button type="button" status="neutral_outlined" onClick={closeFreeModal} width={84}>
					취소
				</Button>
				<Button type="submit" status="primary" width={84}>
					저장
				</Button>
			</ModalS.SharedModalFooter>
		</Container>
	);
}

const Container = styled.form`
	width: min(${unit(480)}, calc(100vw - ${unit(32)}));
	background: white;
	border: 1px solid rgba(222, 229, 237, 1);
	border-radius: ${unit(16)};
	padding: ${unit(24)};
	box-shadow: 0 ${unit(18)} ${unit(40)} rgba(18, 34, 66, 0.18);
	display: flex;
	flex-direction: column;
	gap: ${unit(18)};
`;

const ProfileCard = styled.section`
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
`;

const SectionTitle = styled.h3`
	font-size: ${unit(15)};
	font-weight: 700;
	color: rgba(31, 53, 92, 1);
`;

const ProfileGrid = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
`;

const ProfileField = styled.div<{ $emphasis?: boolean }>`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(18)};
	padding: ${({ $emphasis }) => ($emphasis ? `${unit(10)} ${unit(12)}` : '0')};
	border-radius: ${({ $emphasis }) => ($emphasis ? unit(10) : '0')};
	background: ${({ $emphasis }) => ($emphasis ? 'rgba(245, 249, 255, 1)' : 'transparent')};

	span {
		font-size: ${unit(13)};
		font-weight: 600;
		color: ${({ $emphasis }) => ($emphasis ? 'rgba(65, 94, 149, 1)' : 'rgba(93, 109, 137, 1)')};
		white-space: nowrap;
	}

	strong {
		font-size: ${({ $emphasis }) => ($emphasis ? unit(16) : unit(15))};
		font-weight: ${({ $emphasis }) => ($emphasis ? 800 : 700)};
		color: ${({ $emphasis }) => ($emphasis ? 'rgba(31, 72, 145, 1)' : 'rgba(31, 53, 92, 1)')};
		word-break: break-all;
		text-align: right;
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
		transition: border-color 0.2s ease, box-shadow 0.2s ease;

		&:focus {
			border-color: rgba(84, 121, 190, 1);
			box-shadow: 0 0 0 ${unit(3)} rgba(84, 121, 190, 0.18);
		}
	}
`;
