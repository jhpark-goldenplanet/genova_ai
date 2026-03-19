import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { unit, munit } from '@/shared/utils/base';
import { mobilePoint } from '@/styles/globalStyles';

export const ButtonWrapper = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	margin-bottom: ${unit(40)};

	@media screen and (max-width: ${mobilePoint}) {
		margin-bottom: ${munit(35)};
	}

	button {
		width: ${unit(150)};
		height: ${unit(50)};
		border-radius: ${unit(8)};

		display: flex;
		justify-content: center;
		align-items: center;

		font-size: ${unit(16)};
		color: white;
	}
`;

//

export const CloseWrapper = styled.div`
	position: absolute;
	top: 0;
	right: 0;

	background-color: white;
	width: 100%;
	height: ${unit(24 + 8)};

	display: flex;
	justify-content: flex-end;
	align-items: flex-end;
	padding-right: ${unit(8)};
	z-index: 999;
	border-radius: ${unit(8)};
	@media screen and (max-width: ${mobilePoint}) {
		height: ${munit(18 + 15)};
		padding-right: ${munit(15)};
		border-radius: ${munit(8)};
	}
	img {
		width: ${unit(24)};
		height: ${unit(24)};
		cursor: pointer;

		@media screen and (max-width: ${mobilePoint}) {
			width: ${munit(18)};
			height: ${munit(18)};
		}
	}
`;

export const ModalBlank = styled.figure`
	height: ${unit(24 + 8)};
	@media screen and (max-width: ${mobilePoint}) {
		height: ${munit(16)};
	}
`;

const modalOverlayFadeIn = keyframes`
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
`;

const modalOverlayFadeOut = keyframes`
	from {
		opacity: 1;
	}
	to {
		opacity: 0;
	}
`;

const modalPanelFadeSlideIn = keyframes`
	from {
		opacity: 0;
		transform: translateY(${unit(18)});
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
`;

const modalPanelFadeSlideOut = keyframes`
	from {
		opacity: 1;
		transform: translateY(0);
	}
	to {
		opacity: 0;
		transform: translateY(${unit(18)});
	}
`;

export const SharedModalOverlay = styled.div<{ $closing?: boolean }>`
	position: fixed;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: ${unit(16)};
	background: rgba(8, 16, 33, 0.52);
	z-index: 1400;
	animation: ${({ $closing }) =>
		$closing
			? css`
					${modalOverlayFadeOut} 0.22s ease forwards
				`
			: css`
					${modalOverlayFadeIn} 0.22s ease forwards
				`};
`;

export const SharedModalPanel = styled.section<{ $closing?: boolean; $width?: string }>`
	width: ${({ $width }) => $width || `min(${unit(560)}, calc(100vw - ${unit(32)}))`};
	background: white;
	border: 1px solid rgba(222, 229, 237, 1);
	border-radius: ${unit(16)};
	padding: ${unit(24)};
	box-shadow: 0 ${unit(18)} ${unit(40)} rgba(18, 34, 66, 0.18);
	animation: ${({ $closing }) =>
		$closing
			? css`
					${modalPanelFadeSlideOut} 0.22s ease forwards
				`
			: css`
					${modalPanelFadeSlideIn} 0.22s ease forwards
				`};
`;

export const SharedModalHeader = styled.header`
	display: flex;
	flex-direction: column;
	gap: ${unit(6)};
	margin-bottom: ${unit(18)};
`;

export const SharedModalTitle = styled.h2`
	font-size: ${unit(22)};
	font-weight: 700;
	color: rgba(26, 43, 89, 0.95);
`;

export const SharedModalDescription = styled.p`
	font-size: ${unit(14)};
	line-height: ${unit(22)};
	color: rgba(86, 102, 128, 1);
`;

export const SharedModalBody = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(16)};
`;

export const SharedModalFooter = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(8)};
	margin-top: ${unit(18)};
`;
