import { unit } from '@/shared/utils/base';
import initial_bg from '@images/initial_bg.png';
import styled from '@emotion/styled';

export const Container = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;

	height: 100vh;
	height: 100dvh;

	background: url(${initial_bg.src});
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
`;

export const Main = styled.main`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;

	width: 100%;
	height: 100%;

	/* border: 1px dotted rgba(56, 78, 97, 1);
	border-radius: ${unit(8)};

	padding: ${unit(180)} ${unit(492)} ${unit(148)};

	@media screen and (max-width: 2200px) {
		padding: ${unit(112)} ${unit(410)} ${unit(92)};
	}

	@media screen and (max-width: 1480px) {
		padding: ${unit(84)} ${unit(328)} ${unit(70)};
	} */
`;

export const Header = styled.header`
	width: 100%;
	/* min-height: ${unit(80)}; */
	background: transparent;

	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(10)};

	padding: ${unit(22)};

	position: fixed;
	top: 0;
	left: 0;

	user-select: none;

	.logo-image {
		width: ${unit(34 * 0.95)};
		height: ${unit(33 * 0.95)};
	}

	span {
		color: white;
		font-size: ${unit(20)};
		font-weight: 600;
	}
`;

export const HeaderLeft = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(10)};
`;

export const HeaderRight = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(12)};
`;

export const UserInfo = styled.div`
	color: white;
	font-size: ${unit(14)};
	font-weight: 500;
`;

export const LogoutButton = styled.button`
	padding: ${unit(8)} ${unit(16)};
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.3);
	border-radius: ${unit(6)};
	color: white;
	font-size: ${unit(14)};
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s;

	&:hover {
		background: rgba(255, 255, 255, 0.2);
	}
`;

export const GradientTitle = styled.h1`
	font-weight: 800;
	font-size: ${unit(32)};
	line-height: ${unit(42)};
	text-align: center;

	background: linear-gradient(90deg, #4b89d4 0%, #57d7ee 54.5%, #68acff 74%, #a0c3ff 100%);

	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text; // 최신 브라우저 지원을 위해 추가
	color: transparent;

	margin-bottom: ${unit(30)};
`;

export const SubText = styled.p`
	font-weight: 400;
	font-size: ${unit(16)};
	line-height: ${unit(28)};
	text-align: center;

	color: white;
	margin-bottom: ${unit(28)};
`;

export const Form = styled.form`
	display: flex;
	flex-direction: column;
	align-items: center;
`;

export const LinkInsertButton = styled.button`
	width: ${unit(275 * 0.8)};
	height: ${unit(70 * 0.8)};
	border-radius: ${unit(36)};

	background: rgba(75, 137, 212, 1);
	color: #fff;

	display: flex;
	align-items: center;
	justify-content: center;

	font-weight: 600;
	font-size: ${unit(21)};

	cursor: pointer;

	margin-bottom: ${unit(10)};
`;

export const UploadButton = styled.label`
	width: ${unit(275 * 0.8)};
	height: ${unit(70 * 0.8)};
	border-radius: ${unit(36)};

	background: transparent;
	border: 1.5px solid rgba(75, 137, 212, 1);
	color: rgba(75, 137, 212, 1);

	display: flex;
	align-items: center;
	justify-content: center;

	font-weight: 600;
	font-size: ${unit(21)};

	cursor: pointer;
	user-select: none;

	margin-bottom: ${unit(12)};
`;

//
//
//

export const UploadNotice = styled.p`
	font-size: ${unit(12.5)};
	font-weight: 400;
	line-height: ${unit(24)};
	color: rgba(114, 115, 126, 1);
`;

export const ManualText = styled.p`
	color: white;
	text-align: center;

	font-size: ${unit(16)};
	font-weight: 400;
	line-height: ${unit(28)};

	margin-top: ${unit(36)};
	margin-bottom: ${unit(26)};
`;

export const Footer = styled.footer`
	position: absolute;
	bottom: ${unit(30)};
	p.copyright {
		color: rgba(185, 194, 205, 1);

		font-size: ${unit(14)};
		font-weight: 400;
		line-height: ${unit(24)};
		text-align: center;
		letter-spacing: 0%;

		margin-bottom: ${unit(4)};
	}
`;

export const TermsRow = styled.div`
	display: flex;
	flex-direction: row;

	align-items: center;
	justify-content: center;

	gap: ${unit(6)};

	color: rgba(142, 142, 147, 1);

	font-size: ${unit(12)};
	line-height: ${unit(24)};
	font-weight: 400;

	button {
		color: rgba(142, 142, 147, 1);
		font-size: ${unit(12)};
		line-height: ${unit(24)};
		font-weight: 400;

		user-select: initial;
	}

	span {
		user-select: none;
	}
`;

export const DragOverlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(75, 137, 212, 0.7);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 9999;

	div {
		color: white;
		font-size: ${unit(42)};
		font-weight: 700;

		text-align: center;

		width: calc(100% - ${unit(70)});
		height: calc(100% - ${unit(70)});

		border: 2px dotted rgba(255, 255, 255, 0.8);
		border-radius: ${unit(16)};

		display: flex;
		justify-content: center;
		align-items: center;
	}
`;

export const InsertLinkForm = styled.form`
	padding: ${unit(6)} ${unit(40)} ${unit(40)};

	h3 {
		font-size: ${unit(20)};
		line-height: ${unit(28)};
		font-weight: 700;
		color: rgba(19, 19, 20, 1);

		margin-bottom: ${unit(18)};
	}
`;

interface LinkInputProps {
	error?: boolean; // optional boolean prop
}

export const LinkInput = styled.input<LinkInputProps>`
	width: ${unit(502)};
	border-radius: ${unit(8)} !important;
	border: solid 1.5px;
	border-color: ${(props) => (props.error ? 'rgba(212, 75, 75, 1)' : 'rgba(185, 194, 205, 1)')};

	padding: ${unit(15)};

	color: ${(props) => (props.error ? 'rgba(212, 75, 75, 1)' : 'rgba(19, 19, 20, 1)')};

	font-size: ${unit(16)};
	font-weight: 400;
`;

export const ErrorMessage = styled.p`
	color: rgba(212, 75, 75, 1);

	font-size: ${unit(12.5)};
	font-weight: 400;

	margin-top: ${unit(8.5)};
	margin-left: ${unit(6)};
`;

export const LinkInsertButtonWrapper = styled.div<LinkInputProps>`
	display: flex;
	justify-content: flex-end;
	margin-top: ${unit(20)};
	gap: ${unit(10)};

	button {
		width: ${unit(88)};
		height: ${unit(40)};
		border-radius: ${unit(8)};

		display: flex;
		align-items: center;
		justify-content: center;

		font-size: ${unit(16)};
		font-weight: 600;
		letter-spacing: -0.4%;

		cursor: pointer;

		&:nth-of-type(1) {
			background: white;
			color: rgba(114, 115, 126, 1);
			border: 1px solid rgba(185, 194, 205, 1);
		}

		&:nth-of-type(2) {
			background: rgba(26, 43, 89, 1);

			opacity: ${(props) => (props.error ? 0.3 : 1)};

			color: white;
		}
	}
`;
