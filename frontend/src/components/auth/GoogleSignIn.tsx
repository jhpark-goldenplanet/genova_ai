'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { useAuth } from '@/context/AuthContext';
import { unit } from '@/shared/utils/base';

interface GoogleSignInProps {
	fullHeight?: number;
}

export default function GoogleSignIn({ fullHeight = 40 }: GoogleSignInProps) {
	const { signInWithGoogle } = useAuth();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSignIn = async () => {
		try {
			setLoading(true);
			setError(null);
			await signInWithGoogle();
		} catch (err: any) {
			setError(err.message || '로그인에 실패했습니다.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Container>
			<GoogleButton $height={fullHeight} onClick={handleSignIn} disabled={loading}>
				<GoogleIcon />
				<span>{loading ? '로그인 중...' : 'Google로 계속하기'}</span>
			</GoogleButton>
			{error && <ErrorMessage>{error}</ErrorMessage>}
		</Container>
	);
}

const Container = styled.div`
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: ${unit(12)};
	width: 100%;
`;

const GoogleButton = styled.button<{ $height: number }>`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: ${unit(12)};
	width: 100%;
	height: ${({ $height }) => `${unit($height)}`};
	box-sizing: border-box;
	border-radius: ${unit(4)};
	background: white;
	border: 1px solid #dadce0;
	cursor: pointer;
	font-size: ${unit(14)};
	font-weight: 500;
	color: #3c4043;
	transition: all 0.2s;

	&:hover:not(:disabled) {
		background: #f8f9fa;
		box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const ErrorMessage = styled.div`
	color: #d93025;
	font-size: ${unit(14)};
	text-align: center;
`;

function GoogleIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 18 18">
			<path
				fill="#4285F4"
				d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
			/>
			<path
				fill="#34A853"
				d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
			/>
			<path
				fill="#FBBC05"
				d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
			/>
			<path
				fill="#EA4335"
				d="M9 3.582c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.582 9 3.582z"
			/>
		</svg>
	);
}
