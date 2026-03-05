import { unit } from '@/shared/utils/base';
import { HEADER_HEIGHT, NAVBAR_WIDTH } from '@/shared/constants';
import initial_bg from '@images/initial_bg.png';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

const pulse = keyframes`
	from {
		background-position: 0% 0;
	}
	to {
		background-position: 100% 0;
	}
`;

const fadeInUp = keyframes`
	from {
		opacity: 0;
		transform: translateY(${unit(14)});
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
`;

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

	opacity: 0;
	animation: ${fadeInUp} 0.55s ease forwards;
	animation-delay: 0.08s;

	margin-bottom: ${unit(30)};
`;

export const SubText = styled.p`
	font-weight: 400;
	font-size: ${unit(16)};
	line-height: ${unit(28)};
	text-align: center;

	opacity: 0;
	animation: ${fadeInUp} 0.55s ease forwards;
	animation-delay: 0.2s;

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
	transition: all 0.2s ease;
	opacity: 0;
	animation: ${fadeInUp} 0.55s ease forwards;
	animation-delay: 0.32s;

	cursor: pointer;
	box-shadow: 0 0 0 rgba(75, 137, 212, 0);

	margin-bottom: ${unit(10)};

	&:hover {
		background: rgba(82, 143, 220, 1);
		transform: translateY(-1px);
		box-shadow: 0 8px 16px rgba(75, 137, 212, 0.25);
	}

	&:active {
		transform: translateY(0);
		box-shadow: 0 3px 8px rgba(75, 137, 212, 0.2);
	}
`;

export const UploadButton = styled.label`
	width: ${unit(275 * 0.8)};
	height: ${unit(70 * 0.8)};
	border-radius: ${unit(36)};

	background: rgba(255, 255, 255, 1);
	border: 1.5px solid rgba(75, 137, 212, 1);
	color: rgba(75, 137, 212, 1);

	display: flex;
	align-items: center;
	justify-content: center;

	font-weight: 600;
	font-size: ${unit(21)};

	cursor: pointer;
	user-select: none;
	transition: all 0.2s ease;
	box-shadow: 0 0 0 rgba(75, 137, 212, 0);
	opacity: 0;
	animation: ${fadeInUp} 0.55s ease forwards;
	animation-delay: 0.44s;

	margin-bottom: ${unit(12)};

	&:hover {
		background: rgba(245, 250, 255, 1);
		border-color: rgba(82, 143, 220, 1);
		color: rgba(82, 143, 220, 1);
		transform: translateY(-1px);
		box-shadow: 0 8px 16px rgba(75, 137, 212, 0.25);
	}

	&:active {
		transform: translateY(0);
		box-shadow: 0 3px 8px rgba(75, 137, 212, 0.2);
	}
`;

//
//
//

export const UploadNotice = styled.p`
	font-size: ${unit(12.5)};
	font-weight: 400;
	line-height: ${unit(24)};
	opacity: 0;
	animation: ${fadeInUp} 0.55s ease forwards;
	animation-delay: 0.56s;
	color: rgba(114, 115, 126, 1);
`;

export const ManualText = styled.p`
	color: white;
	text-align: center;

	opacity: 0;
	animation: ${fadeInUp} 0.55s ease forwards;
	animation-delay: 0.38s;

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

export const RootShell = styled.div`
	position: relative;
	min-height: 100vh;
	min-height: 100dvh;
	background: #f2f6fa;
`;

export const SideNav = styled.nav`
	position: fixed;
	left: 0;
	top: 0;
	width: ${NAVBAR_WIDTH};
	height: 100dvh;

	background: rgba(26, 43, 89, 1);
	padding: ${unit(18)} ${unit(16)};

	display: flex;
	flex-direction: column;
	z-index: 1000;
	box-sizing: border-box;
`;

export const SideNavBrand = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
	margin-bottom: ${unit(24)};
	padding-bottom: ${unit(16)};
	border-bottom: 1px solid rgba(255, 255, 255, 0.16);

	span {
		color: white;
		font-size: ${unit(17)};
		font-weight: 700;
	}

	img {
		width: ${unit(24)};
		height: ${unit(24)};
		filter: brightness(0) invert(1);
	}
`;

export const SideMenu = styled.ul`
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

export const SideMenuItem = styled.li<{ $active: boolean; $disabled?: boolean }>`
	display: flex;
	align-items: center;

	width: 100%;
	gap: ${unit(10)};

	padding: ${unit(10)} ${unit(12)};
	border-radius: ${unit(8)};

	color: rgba(249, 250, 251, 1);
	font-size: ${unit(15)};
	font-weight: 600;
	cursor: ${(props) => (props.$disabled ? 'default' : 'pointer')};

	background-color: ${(props) => (props.$active ? 'rgba(96, 106, 135, 1)' : 'transparent')};
	transition: all 0.2s ease;
	opacity: ${(props) => (props.$disabled ? 0.5 : 1)};

	&:hover {
		background-color: ${(props) => (props.$disabled ? 'transparent' : 'rgba(120, 133, 172, 0.9)')};
		box-shadow: ${(props) => (props.$disabled ? 'none' : 'inset 0 0 0 1px rgba(255, 255, 255, 0.22)')};
		transform: ${(props) => (props.$disabled ? 'none' : 'translateX(2px)')};
	}

	&:active {
		transform: ${(props) => (props.$disabled ? 'none' : 'scale(0.985)')};
	}
`;

export const SideMenuAction = styled.button`
	position: relative;
	width: 100%;
	text-align: left;
	display: flex;
	justify-content: flex-start;
	align-items: center;
	gap: ${unit(10)};
	border: none;
	background: transparent;
	color: inherit;
	font: inherit;
	cursor: pointer;
	padding: 0;
	transition: all 0.2s ease;

	svg {
		width: ${unit(18.5)};
		height: ${unit(18.5)};
		stroke: rgba(249, 250, 251, 1);
		flex-shrink: 0;
		transition: stroke 0.2s ease;
	}

	&:hover svg {
		stroke: #ffffff;
	}

	&:hover {
		color: #ffffff;
	}

	.menu-icon-image {
		width: ${unit(18.5)};
		height: ${unit(18.5)};
		filter: brightness(0) invert(1);
		opacity: 0.96;
		transition: opacity 0.2s ease;
	}

	&:hover .menu-icon-image {
		opacity: 1;
	}

	&:disabled {
		cursor: default;
		opacity: 0.88;
	}

	&:disabled:hover {
		color: inherit;
		transform: none;
		box-shadow: none;
	}

	&:disabled:hover::after,
	&:disabled:hover::before {
		opacity: 0;
		visibility: hidden;
	}

	&:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.55);
		outline-offset: 2px;
	}

	&[data-tooltip]::after,
	&[data-tooltip]::before {
		opacity: 0;
		pointer-events: none;
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%) translateX(100%);
		color: white;
		white-space: pre-line;
		visibility: hidden;
		transition: opacity 0.12s ease;
		z-index: 20;
	}

	&[data-tooltip]::after {
		content: attr(data-tooltip);
		background: rgba(26, 43, 89, 0.98);
		padding: ${unit(8)} ${unit(10)};
		border-radius: ${unit(6)};
		border: 1px solid rgba(255, 255, 255, 0.22);
		font-size: ${unit(12.5)};
		line-height: 1.4;
		box-shadow: 0 10px 28px rgba(10, 23, 45, 0.25);
		max-width: ${unit(250)};
	}

	&[data-tooltip]::before {
		content: '';
		width: 0;
		height: 0;
		border-top: ${unit(5)} solid transparent;
		border-bottom: ${unit(5)} solid transparent;
		border-right: ${unit(6)} solid rgba(26, 43, 89, 0.98);
		left: auto;
		right: 2px;
		top: 50%;
		transform: translateY(-50%) translateX(100%);
	}

	&[data-tooltip]:hover::after,
	&[data-tooltip]:hover::before {
		opacity: 1;
		visibility: visible;
	}

	.menu-icon {
		display: inline-flex;
		width: ${unit(18.5)};
		height: ${unit(18.5)};
		align-items: center;
		justify-content: center;
		font-size: ${unit(14)};
	}
`;

export const SideNavSpacer = styled.div`
	flex: 1;
`;

export const SideNavFooter = styled.div`
	padding-top: ${unit(16)};
	border-top: 1px solid rgba(255, 255, 255, 0.16);
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

export const SideNavUser = styled.div`
	color: rgba(249, 250, 251, 1);
	font-size: ${unit(13)};
	font-weight: 500;
	word-break: break-all;
	line-height: 1.4;
`;

export const SideNavButton = styled.button`
	padding: ${unit(7)} ${unit(10)};
	border-radius: ${unit(7)};
	border: 1px solid rgba(255, 255, 255, 0.35);
	background: transparent;
	color: white;
	font-size: ${unit(13)};
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s ease;
	width: fit-content;

	&:hover {
		background: rgba(255, 255, 255, 0.08);
	}
`;

export const RootContent = styled.div<{ $withHeader?: boolean }>`
	min-height: 100dvh;
	margin-left: ${NAVBAR_WIDTH};
	padding-top: ${({ $withHeader }) => ($withHeader ? HEADER_HEIGHT : '0')};
	position: relative;
	background: #fff;
`;

export const FixedHeader = styled.header`
	position: fixed;
	top: 0;
	left: ${NAVBAR_WIDTH};
	width: calc(100% - ${NAVBAR_WIDTH});
	height: ${HEADER_HEIGHT};
	border-bottom: 1px solid rgba(222, 229, 237, 1);
	background-color: white;
	z-index: 50;
	display: flex;
	align-items: center;
	padding: 0 ${unit(22)};

	.page-title {
		font-size: ${unit(22)};
		font-weight: 700;
		color: rgba(26, 43, 89, 0.9);
		line-height: ${unit(30)};
		white-space: nowrap;
		padding-left: 0;
	}
`;

export const RouteTransitionContent = styled.div<{ $isLoading: boolean }>`
	position: relative;
	width: 100%;
	min-height: 100%;
	filter: ${({ $isLoading }) => ($isLoading ? 'blur(8px)' : 'none')};
	opacity: ${({ $isLoading }) => ($isLoading ? 0.45 : 1)};
	pointer-events: ${({ $isLoading }) => ($isLoading ? 'none' : 'auto')};
	will-change: filter, opacity;
	transition: ${({ $isLoading }) => ($isLoading ? 'none' : 'filter 0.25s ease, opacity 0.25s ease')};
`;

export const MembersPageHeader = styled.h1`
	color: rgba(26, 43, 89, 1);
	font-size: ${unit(28)};
	font-weight: 700;
	line-height: ${unit(36)};
	margin: ${unit(28)} ${unit(40)} ${unit(14)};
`;

export const MembersPageBody = styled.div`
	display: flex;
	align-items: stretch;
	flex-direction: column;
	gap: ${unit(12)};
	padding: ${unit(18)} ${unit(40)};
`;

export const MembersPlaceholder = styled.section`
	min-height: ${unit(320)};
	border: 1px solid rgba(222, 229, 237, 1);
	border-radius: ${unit(12)};
	background: rgba(248, 250, 253, 1);
	padding: ${unit(28)};

	h2 {
		font-size: ${unit(24)};
		font-weight: 700;
		line-height: ${unit(32)};
		color: rgba(26, 43, 89, 0.95);
		margin-bottom: ${unit(10)};
	}

	p {
		font-size: ${unit(16)};
		font-weight: 500;
		line-height: ${unit(26)};
		color: rgba(96, 107, 138, 1);
	}
`;

export const MembersTableCard = styled.section`
	border: 1px solid rgba(222, 229, 237, 1);
	border-radius: ${unit(12)};
	background: white;
	overflow: hidden;
`;

export const MembersTopActions = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(12)};
	margin-bottom: ${unit(6)};
`;

export const MembersPageDescription = styled.p`
	font-size: ${unit(15)};
	font-weight: 500;
	line-height: ${unit(20)};
	color: rgba(96, 107, 138, 1);
`;

export const MembersRegisterButton = styled.button`
	height: ${unit(42)};
	padding: 0 ${unit(16)};
	border-radius: ${unit(8)};
	border: 1px solid rgba(26, 43, 89, 1);
	background: rgba(26, 43, 89, 1);
	color: white;
	font-size: ${unit(14)};
	font-weight: 700;
	transition: box-shadow 0.3s ease, background-color 0.3s ease;

	&:hover {
		background: rgba(35, 57, 110, 1);
		box-shadow: 0 6px 12px rgba(26, 43, 89, 0.24);
	}

	&:active {
		box-shadow: 0 3px 8px rgba(26, 43, 89, 0.22);
	}
`;

export const MembersTableHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: ${unit(18)} ${unit(24)};
	border-bottom: 1px solid rgba(236, 241, 247, 1);

	h2 {
		font-size: ${unit(20)};
		font-weight: 700;
		color: rgba(26, 43, 89, 0.95);
	}

	p {
		font-size: ${unit(14)};
		font-weight: 500;
		color: rgba(96, 107, 138, 1);
	}
`;

export const MembersTable = styled.table`
	width: 100%;
	border-collapse: collapse;

	thead {
		background: rgba(247, 249, 253, 1);
	}

	th {
		padding: ${unit(12)} ${unit(16)};
		text-align: left;
		font-size: ${unit(14)};
		font-weight: 700;
		color: rgba(84, 98, 130, 1);
		border-bottom: 1px solid rgba(236, 241, 247, 1);
	}

	td {
		padding: ${unit(14)} ${unit(16)};
		font-size: ${unit(15)};
		font-weight: 500;
		color: rgba(31, 42, 68, 1);
		border-bottom: 1px solid rgba(242, 245, 250, 1);
	}

	tbody tr {
		transition: background-color 0.16s ease, transform 0.16s ease;
		cursor: pointer;
	}

	tbody tr:hover {
		background: rgba(235, 242, 252, 0.7);
	}

	tbody tr:last-of-type td {
		border-bottom: none;
	}
`;

export const MembersCredit = styled.span<{ $isLow?: boolean }>`
	display: inline-flex;
	align-items: center;
	padding: ${unit(5)} ${unit(10)};
	border-radius: ${unit(999)};
	background: ${({ $isLow }) => ($isLow ? 'rgba(255, 235, 238, 1)' : 'rgba(236, 244, 255, 1)')};
	color: ${({ $isLow }) => ($isLow ? 'rgba(194, 35, 45, 1)' : 'rgba(45, 95, 174, 1)')};
	font-size: ${unit(13)};
	font-weight: 700;
`;

export const MembersModalOverlay = styled.div<{ $closing?: boolean }>`
	@keyframes membersOverlayFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes membersOverlayFadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	position: fixed;
	inset: 0;
	background: rgba(8, 16, 33, 0.52);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1400;
	animation: ${({ $closing }) =>
		$closing ? 'membersOverlayFadeOut 0.22s ease forwards' : 'membersOverlayFadeIn 0.22s ease forwards'};
`;

export const MembersModal = styled.section<{ $closing?: boolean }>`
	@keyframes membersModalFadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(${unit(18)});
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes membersModalFadeSlideOut {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(${unit(18)});
		}
	}

	width: min(${unit(560)}, calc(100vw - ${unit(32)}));
	border-radius: ${unit(14)};
	background: white;
	border: 1px solid rgba(222, 229, 237, 1);
	padding: ${unit(24)};
	animation: ${({ $closing }) =>
		$closing ? 'membersModalFadeSlideOut 0.22s ease forwards' : 'membersModalFadeSlideIn 0.22s ease forwards'};

	h3 {
		font-size: ${unit(22)};
		font-weight: 700;
		color: rgba(26, 43, 89, 0.95);
		margin-bottom: ${unit(18)};
	}
`;

export const MembersFormGrid = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: ${unit(12)};
	margin-bottom: ${unit(18)};
`;

export const MembersField = styled.label`
	display: flex;
	flex-direction: column;
	gap: ${unit(6)};

	span {
		font-size: ${unit(13)};
		font-weight: 700;
		color: rgba(84, 98, 130, 1);
	}

	input {
		height: ${unit(42)};
		border: 1px solid rgba(201, 211, 225, 1);
		border-radius: ${unit(8)};
		padding: 0 ${unit(12)};
		font-size: ${unit(14)};
		font-weight: 500;
		color: rgba(31, 42, 68, 1);
	}

	input[readonly] {
		background: rgba(246, 248, 252, 1);
		color: rgba(104, 115, 140, 1);
	}
`;

export const MembersModalActions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(8)};

	button {
		height: ${unit(40)};
		padding: 0 ${unit(14)};
		border-radius: ${unit(8)};
		font-size: ${unit(14)};
		font-weight: 700;
		transition: box-shadow 0.3s ease, background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
	}

	.cancel {
		border: 1px solid rgba(201, 211, 225, 1);
		background: white;
		color: rgba(84, 98, 130, 1);

		&:hover {
			background: rgba(246, 248, 252, 1);
			box-shadow: 0 4px 9px rgba(113, 126, 157, 0.2);
		}

		&:active {
			box-shadow: 0 2px 6px rgba(113, 126, 157, 0.18);
		}
	}

	.save {
		border: 1px solid rgba(26, 43, 89, 1);
		background: rgba(26, 43, 89, 1);
		color: white;

		&:hover {
			background: rgba(35, 57, 110, 1);
			box-shadow: 0 6px 12px rgba(26, 43, 89, 0.24);
		}

		&:active {
			box-shadow: 0 3px 8px rgba(26, 43, 89, 0.22);
		}
	}
`;

export const RouteTransitionSkeleton = styled.div`
	width: 100%;
	padding: ${unit(30)} ${unit(40)} ${unit(40)};
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
`;

export const RouteTransitionTitle = styled.div`
	width: ${unit(260)};
	height: ${unit(30)};
	border-radius: ${unit(6)};
	background: linear-gradient(90deg, rgba(219, 227, 239, 0.9) 25%, rgba(237, 241, 248, 0.7) 50%, rgba(219, 227, 239, 0.9) 75%);
	background-size: 220% 100%;
	animation: ${pulse} 1.2s ease-in-out infinite;
`;

export const RouteTransitionLine = styled.div<{ $height?: string }>`
	width: 100%;
	height: ${({ $height }) => $height || unit(18)};
	border-radius: ${unit(6)};
	background: linear-gradient(90deg, rgba(219, 227, 239, 0.9) 25%, rgba(237, 241, 248, 0.7) 50%, rgba(219, 227, 239, 0.9) 75%);
	background-size: 220% 100%;
	animation: ${pulse} 1.2s ease-in-out infinite;
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
