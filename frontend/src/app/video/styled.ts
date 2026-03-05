import { HEADER_HEIGHT, NAVBAR_WIDTH } from '@/shared/constants';
import { unit } from '@/shared/utils/base';
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

const fadeIn = keyframes`
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
`;

const fadeOut = keyframes`
	from {
		opacity: 1;
	}
	to {
		opacity: 0;
	}
`;

const CONTENT_GAP = unit(100);
const CONTENT_WIDTH = `min(calc(100vw - ${NAVBAR_WIDTH}), ${unit(1580)})`;
const HEADER_OFFSET = NAVBAR_WIDTH;

export const VideoWrapper = styled.div`
	background-color: rgb(242, 246, 250);
	width: ${CONTENT_WIDTH};
	margin-left: ${NAVBAR_WIDTH};
	position: relative;
	box-sizing: border-box;

	padding: calc(${HEADER_HEIGHT} + ${unit(20)}) ${unit(40)} ${unit(40)} ${CONTENT_GAP};

	min-height: 100vh;
	min-height: 100dvh;

	background-color: white;

	max-width: ${unit(1580)};
	display: flex;
	flex-direction: column;

	/* align-items: center; */
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

export const NavigationSkeleton = styled.div`
	width: 100%;
	margin-top: ${unit(16)};
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
`;

export const NavigationSkeletonTitle = styled.div`
	width: ${unit(240)};
	height: ${unit(30)};
	border-radius: ${unit(6)};
	background: linear-gradient(90deg, rgba(219, 227, 239, 0.9) 25%, rgba(237, 241, 248, 0.7) 50%, rgba(219, 227, 239, 0.9) 75%);
	background-size: 220% 100%;
	animation: ${pulse} 1.2s ease-in-out infinite;
`;

export const NavigationSkeletonLine = styled.div<{ $height?: string }>`
	width: 100%;
	height: ${({ $height }) => $height || unit(18)};
	border-radius: ${unit(6)};
	background: linear-gradient(90deg, rgba(219, 227, 239, 0.9) 25%, rgba(237, 241, 248, 0.7) 50%, rgba(219, 227, 239, 0.9) 75%);
	background-size: 220% 100%;
	animation: ${pulse} 1.2s ease-in-out infinite;
`;

export const VideoTitleWraper = styled.div`
	position: relative;
	display: flex;
	flex-direction: column;
	gap: ${unit(8)};

	margin-bottom: ${unit(10)};
`;

export const PageSectionTitle = styled.h2`
	color: rgba(26, 43, 89, 1);
	font-size: ${unit(24)};
	font-weight: 700;
	line-height: ${unit(34)};
	margin: 0;
`;

export const VideoTitleField = styled.div`
	position: relative;
	.ico-edit {
		position: absolute;
		top: 50%;
		right: ${unit(18)};
		transform: translateY(-50%);

		width: ${unit(21)};
		height: ${unit(21)};

		cursor: pointer;
		transition: all 0.3s ease;
		&:hover {
			transform: translateY(-50%) scale(1.1);
		}
		&:active {
			transform: translateY(-50%) scale(0.9);
		}
	}
`;

export const IMSIWrapper = styled.div`
	height: calc(100vh - ${unit(20)});
	height: calc(100dvh - ${unit(20)});

	display: flex;
	justify-content: center;
	align-items: center;

	font-size: ${unit(32)};
	font-weight: 600;
	text-align: center;

	color: rgba(19, 19, 20, 1);
`;

export const SkeletonWrapper = styled.div`
	width: 100%;
	height: ${unit(52)};

	border-radius: ${unit(8)};

	border: solid 1px rgba(185, 194, 205, 1);

	padding-left: ${unit(24)};
	padding-top: ${unit(14)};
`;

export const VideoTitleInput = styled.input<{ isEditing: boolean }>`
	width: 100%;
	border-radius: ${unit(8)} !important;
	border: solid 1.5px;
	background-color: ${({ isEditing }) => (isEditing ? 'white' : '#f8f9fa ')};
	border-color: ${({ isEditing }) => (isEditing ? 'rgba(75, 137, 212, 1)' : 'rgba(185, 194, 205, 1)')};

	padding: ${unit(12)} ${unit(54)} ${unit(10)} ${unit(22)};

	color: rgba(19, 19, 20, 1);
	font-size: ${unit(17.5)};
	font-weight: 600;
	line-height: ${unit(30)};
`;

export const LeftNavBar = styled.nav`
	position: fixed;
	left: 0;
	top: ${HEADER_HEIGHT};

	width: ${NAVBAR_WIDTH};

	min-height: calc(100vh - ${HEADER_HEIGHT});
	min-height: calc(100dvh - ${HEADER_HEIGHT});

	background-color: rgba(26, 43, 89, 1);

	padding: ${unit(20)} ${unit(20)};

	display: flex;
	flex-direction: column;
`;

export const FixedHeader = styled.header`
	position: fixed;
	top: 0;
	left: ${HEADER_OFFSET};
	width: ${CONTENT_WIDTH};
	height: ${HEADER_HEIGHT};

	border-bottom: 1px solid rgba(222, 229, 237, 1);

	background-color: white;
	z-index: 50;

	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	gap: ${unit(18)};

	padding: 0 ${unit(22)};

	.logo-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: ${unit(7)};

		.logo-navy {
			width: auto;
			height: ${unit(26)};
			cursor: pointer;
		}

		span {
			font-weight: 700;
			font-size: ${unit(20)};
			letter-spacing: ${unit(-0.2)};
			color: rgba(26, 43, 89, 0.9);
		}
	}

	.page-title {
		font-size: ${unit(22)};
		font-weight: 700;
		color: rgba(26, 43, 89, 0.9);
		line-height: ${unit(30)};
		white-space: nowrap;
		padding-left: 0;
		margin-right: auto;
	}
`;

export const FixedHeaderButtonArea = styled.div`
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: ${unit(6)};

	button {
		width: ${unit(26)};
		height: ${unit(26)};

		border-radius: 50%;
		background-color: transparent;

		display: flex;
		justify-content: center;
		align-items: center;

		gap: ${unit(5)};

		&.language-button {
			width: ${unit(74)};
			border-radius: ${unit(20)};
		}

		img {
			width: ${unit(24)};
			height: ${unit(24)};
		}

		span {
			font-size: ${unit(13)};
			font-weight: 600;
			color: rgba(114, 115, 126, 1);
		}
	}

	margin-left: auto;
}
`;

export const LanguageSelector = styled.select`
	padding: ${unit(8)} ${unit(32)} ${unit(8)} ${unit(12)};
	border: 1px solid rgba(222, 229, 237, 1);
	border-radius: ${unit(6)};
	background-color: white;
	color: rgba(19, 19, 20, 1);
	font-size: ${unit(14)};
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s ease;
	min-width: ${unit(120)};

	&:hover {
		border-color: rgba(75, 137, 212, 1);
	}

	&:focus {
		outline: none;
		border-color: rgba(75, 137, 212, 1);
		box-shadow: 0 0 0 3px rgba(75, 137, 212, 0.1);
	}

	option {
		padding: ${unit(8)};
	}
`;

export const LanguageToggleContainer = styled.div`
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: ${unit(8)};
`;

export const LanguageToggleButton = styled.button<{ isActive: boolean }>`
	padding: ${unit(8)} ${unit(16)};
	border: 1px solid ${({ isActive }) => (isActive ? 'rgba(75, 137, 212, 1)' : 'rgba(222, 229, 237, 1)')};
	border-radius: ${unit(6)};
	background-color: ${({ isActive }) => (isActive ? 'rgba(75, 137, 212, 1)' : 'white')};
	color: ${({ isActive }) => (isActive ? 'white' : 'rgba(19, 19, 20, 1)')};
	font-size: ${unit(14)};
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		border-color: rgba(75, 137, 212, 1);
		background-color: ${({ isActive }) => (isActive ? 'rgba(75, 137, 212, 0.9)' : 'rgba(75, 137, 212, 0.05)')};
	}

	&:active {
		transform: scale(0.98);
	}
`;

export const OtherLanguageSelector = styled.select`
	padding: ${unit(8)} ${unit(12)};
	border: 1px solid rgba(222, 229, 237, 1);
	border-radius: ${unit(6)};
	background-color: white;
	color: rgba(19, 19, 20, 1);
	font-size: ${unit(14)};
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s ease;
	min-width: ${unit(120)};

	&:hover {
		border-color: rgba(75, 137, 212, 1);
	}

	&:focus {
		outline: none;
		border-color: rgba(75, 137, 212, 1);
		box-shadow: 0 0 0 3px rgba(75, 137, 212, 0.1);
	}

	option {
		padding: ${unit(8)};
	}

	option[value=''] {
		color: rgba(114, 115, 126, 1);
	}
`;

export const Popper = styled.div`
	background-color: white;
	border: 1px solid rgb(229, 234, 240);
	border-radius: ${unit(7)};
	box-shadow: 0 ${unit(2)} ${unit(8)} rgba(0, 0, 0, 0.15);
	padding: ${unit(20)};
`;

export const NewThreadButton = styled.button`
	padding: ${unit(10.5)} ${unit(13)};
	width: 100%;
	min-height: ${unit(38)};

	border-radius: ${unit(8)};
	border: 1.5px solid rgba(96, 106, 135, 1);
	background: transparent;

	display: flex;
	flex-direction: row;
	align-items: center;
	gap: ${unit(12)};

	margin-bottom: ${unit(22)};

	.ico-plus {
		width: ${unit(18.5)};
		height: ${unit(18.5)};
	}

	span {
		color: white;
		font-size: ${unit(15)};
		font-weight: 600;
	}
`;

export const MenuWrapper = styled.ul`
	display: flex;
	flex-direction: column;
	gap: ${unit(15)};
`;

export const Menu = styled.li`
	display: flex;
	flex-direction: row;
	align-items: center;

	width: 100%;
	gap: ${unit(12)};

	padding: ${unit(10.5)} ${unit(13)};

	border-radius: ${unit(8)};

	user-select: none;
	cursor: pointer;

	&.selected-menu {
		/* background-color: rgba(19, 19, 20, 0.3); */
		background-color: rgba(96, 106, 135, 1);
	}

	.menu-icon {
		width: ${unit(18.5)};
		height: ${unit(18.5)};
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: ${unit(15)};
	}

	span {
		color: rgba(249, 250, 251, 1);
		font-size: ${unit(15)};
		font-weight: 600;
	}
`;

export const NavBottomSection = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
	margin-top: auto;
	padding-top: ${unit(16)};

	border-top: 1px solid rgba(255, 255, 255, 0.16);
`;

export const NavUserInfo = styled.div`
	color: rgba(249, 250, 251, 1);
	font-size: ${unit(13)};
	font-weight: 500;
	line-height: 1.4;
	word-break: break-all;
`;

export const NavLogoutButton = styled.button`
	padding: ${unit(7)} ${unit(10)};
	width: fit-content;
	border-radius: ${unit(7)};
	border: 1px solid rgba(255, 255, 255, 0.35);
	background: transparent;
	color: white;
	font-size: ${unit(13)};
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.08);
	}
`;
