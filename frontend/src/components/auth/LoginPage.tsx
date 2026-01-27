'use client';

import Image from 'next/image';
import logo_icon from '@images/logo_icon.png';
import GoogleSignIn from './GoogleSignIn';
import * as S from '@/app/(root)/styled';
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';

export default function LoginPage() {
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
				<Subtitle>goldenplanet.co.kr 계정으로 로그인해주세요</Subtitle>
				<GoogleSignIn />
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
	font-size: ${unit(36)};
	font-weight: 700;
	background: linear-gradient(90deg, #4b89d4 0%, #57d7ee 54.5%, #68acff 74%, #a0c3ff 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
	color: transparent;
	text-align: center;
	margin: 0;
	margin-bottom: ${unit(16)};
`;

const Subtitle = styled.p`
	font-size: ${unit(16)};
	color: white;
	text-align: center;
	margin: 0;
	margin-bottom: ${unit(24)};
`;
