'use client';

import Image from 'next/image';
import { useState } from 'react';
import logo_icon from '@images/logo_icon.png';
import GoogleSignIn from './GoogleSignIn';
import { useAuth } from '@/context/AuthContext';
import * as S from '@/app/(root)/styled';
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { SubmitHandler, useForm } from 'react-hook-form';
import Textfield from '@/components/Input/Text';

interface LoginFormValues {
	id: string;
	password: string;
}

export default function LoginPage() {
	const { signInWithIdPassword } = useAuth();
	const { register, handleSubmit, watch, formState } = useForm<LoginFormValues>({
		defaultValues: {
			id: '',
			password: '',
		},
		mode: 'onChange',
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const watchId = watch('id');
	const watchPassword = watch('password');

	const handleLogin: SubmitHandler<LoginFormValues> = async ({ id, password }) => {
		try {
			setLoading(true);
			setError('');
			await signInWithIdPassword(id, password);
		} catch (err: any) {
			setError(err.message || '로그인에 실패했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const onLoginClick = () => {
		handleSubmit(handleLogin)();
	};

	return (
		<S.Container>
			<S.Header>
				<S.HeaderLeft>
					<Image className="logo-image" src={logo_icon} alt="logo-icon" width={34} height={33} />
					<span>Genova AI</span>
				</S.HeaderLeft>
			</S.Header>

			<S.Main>
				<Title>Genova AI에 오신 것을 환영합니다</Title>

				<Form>
					<Textfield
						name="id"
						placeholder="아이디(또는 이메일)"
						register={register}
						options={{ required: '아이디를 입력해주세요.' }}
						disabled={loading}
						inputStyle={{
							background: 'rgba(255, 255, 255, 0.1)',
							color: '#ffffff',
						}}
						error={!!formState.errors.id}
						errors={formState.errors}
					/>
					<Textfield
						name="password"
						placeholder="비밀번호"
						disabled={loading}
						type="password"
						register={register}
						options={{ required: '비밀번호를 입력해주세요.' }}
						inputStyle={{
							background: 'rgba(255, 255, 255, 0.1)',
							color: '#ffffff',
						}}
						error={!!formState.errors.password}
						errors={formState.errors}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								onLoginClick();
							}
						}}
					/>
					<ButtonRow>
						<LoginButton type="button" onClick={onLoginClick} disabled={loading || !watchId || !watchPassword}>
							{loading ? '로그인 중...' : '로그인'}
						</LoginButton>
						<GoogleSignIn fullHeight={40} />
					</ButtonRow>
				</Form>
				{error && <ErrorMessage>{error}</ErrorMessage>}
			</S.Main>

			<S.Footer>
				<p className="copyright">© 2025 GOLDEN PLANET Co.,Ltd. All rights reserved.</p>
				<S.TermsRow>
					<button
						type="button"
						onClick={() =>
							window.open(
								'https://shorthaired-fossa-a9f.notion.site/Genova-AI-1d8bbfa86f7b8017a40fee1bef8ede6a?pvs=4',
								'_blank',
								'noopener,noreferrer',
							)
						}
					>
						Genova AI 이용약관
					</button>
					<span>|</span>
					<button
						type="button"
						onClick={() =>
							window.open(
								' https://shorthaired-fossa-a9f.notion.site/Genova-AI-d460f513f14f4f7588cc7e8f3a002f4a?pvs=4',
								'_blank',
								'noopener,noreferrer',
							)
						}
					>
						AI 윤리
					</button>
					<span>|</span>
					<button
						type="button"
						onClick={() =>
							window.open(
								'https://shorthaired-fossa-a9f.notion.site/Genova-AI-1cbbbfa86f7b80faa111d41db87ad129?pvs=4',
								'_blank',
								'noopener,noreferrer',
							)
						}
					>
						도움말
					</button>
				</S.TermsRow>
			</S.Footer>
		</S.Container>
);
}

const Title = styled.h1`
	font-size: ${unit(48)};
	font-weight: 700;
	background: linear-gradient(90deg, #4b89d4 0%, #57d7ee 54.5%, #68acff 74%, #a0c3ff 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
	color: transparent;
	text-align: center;
	margin: 0;
	margin-bottom: ${unit(60)};
`;

const Subtitle = styled.p`
	font-size: ${unit(16)};
	color: white;
	text-align: center;
	margin: 0;
	margin-bottom: ${unit(24)};
`;

const Form = styled.div`
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: ${unit(14)};
	width: min(92vw, 360px);

	input {
		padding: ${unit(12)} ${unit(14)};
		border: 1px solid rgba(255, 255, 255, 0.45) !important;
		border-radius: ${unit(6)};
		transition: all 0.2s;
	}

	input::placeholder {
		color: rgba(255, 255, 255, 0.8);
	}

	input:focus {
		border-color: #8ac3ff !important;
		outline: none;
		background: rgba(255, 255, 255, 0.16);
	}
`;

const ButtonRow = styled.div`
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: ${unit(12)};
	width: 100%;
`;

const LoginButton = styled.button`
	width: 100%;
	height: ${unit(40)};
	border-radius: ${unit(4)};
	border: 0;
	background: #4f75db;
	color: white;
	font-size: ${unit(14)};
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s;

	&:hover:not(:disabled) {
		opacity: 0.92;
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const ErrorMessage = styled.div`
	color: #ffd6d6;
	font-size: ${unit(13)};
	text-align: center;
	margin-top: ${unit(4)};
`;
