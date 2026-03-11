import { getColor, unit } from '@/shared/utils/base';
import styled from '@emotion/styled';
import Image from 'next/image';
import { keyframes } from '@emotion/react';

const pageFadeIn = keyframes`
	from {
		opacity: 0;
		transform: translateY(${unit(14)});
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
`;

const thumbnailModalFadeSlideIn = keyframes`
	from {
		opacity: 0;
		transform: translateY(${unit(18)});
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
`;

export const Main = styled.main`
	animation: ${pageFadeIn} 0.35s ease;
`;

export const PageTopBar = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${unit(12)};
	margin-bottom: ${unit(10)};
`;

export const PageDescription = styled.p`
	font-size: ${unit(15)};
	font-weight: 500;
	line-height: ${unit(20)};
	color: rgba(96, 107, 138, 1);
`;

export const PageTopActions = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
`;

export const PageSelect = styled.select`
	width: ${unit(96)};
	height: ${unit(36)};
	border-radius: ${unit(8)};
	border: 1px solid rgba(201, 211, 225, 1);
	background: white;
	color: rgba(31, 42, 68, 1);
	font-size: ${unit(13)};
	font-weight: 600;
	padding: 0 ${unit(10)};
`;

export const VideoWrapper = styled.section`
	width: 100%;
	aspect-ratio: 16 / 9;
	background-color: rgba(247, 247, 249, 1);
	border: 1.5px solid rgba(222, 229, 237, 1);
	min-height: ${unit(300)};
	border-radius: ${unit(8)};
	overflow: hidden;
	margin-bottom: ${unit(10)};
`;

export const TimeStampContainer = styled.form`
	background-color: white;
	padding: ${unit(22)} ${unit(26)} ${unit(26)};

	border: 1.5px solid rgba(185, 194, 205, 1);
	border-radius: ${unit(8)};

	margin-bottom: ${unit(20)};

	h1 {
		color: rgba(19, 19, 20, 1);

		font-weight: 600;
		font-size: ${unit(20)};
		line-height: ${unit(32)};

		margin-bottom: ${unit(12)};
	}

	ul {
		width: 100%;
		position: relative;

		li {
			padding: ${unit(17)} ${unit(28)};

			display: flex;
			flex-direction: row;
			align-items: center;
			gap: ${unit(26)};

			background-color: white;

			&:nth-of-type(odd) {
				background-color: rgba(249, 250, 251, 1);
			}

			cursor: pointer;

			&:hover {
				background: rgba(75, 137, 212, 0.1);
			}

			p {
				color: rgba(19, 19, 20, 1);
				font-size: ${unit(18)};
				font-weight: 600;
				line-height: ${unit(30)};
				/* text-decoration: underline; */
			}
		}
	}
`;

export const TimelineLine = styled.figure<{ index: number; total: number }>`
	position: absolute;
	left: 0;
	width: 1px;
	height: calc(100% / ${(props) => props.total});
	top: calc((100% / ${(props) => props.total}) * ${(props) => props.index});
	background: ${(props) => getColor(props.index)};
`;

export const TimeLinePin = styled(Image)<{ index: number; total: number }>`
	position: absolute;
	left: -${unit(4)};
	width: ${unit(9)};
	height: ${unit(12)};
	top: calc((100% / ${(props) => props.total}) * ${(props) => props.index});
`;

export const TimePickerWrapper = styled.section`
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: ${unit(6)};

	span {
		font-size: ${unit(15.5)};
		font-weight: 400;
		color: rgba(19, 19, 20, 1);
	}
`;

export const ButtonContainer = styled.section`
	display: flex;
	flex-direction: row;
	justify-content: flex-end;
	gap: ${unit(10)};

	button {
		padding: ${unit(12 * 0.9)} ${unit(20 * 0.9)};
		border-radius: ${unit(8)};

		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: ${unit(7.5)};

		font-size: ${unit(16)};
		font-weight: 600;
		line-height: ${unit(16)};
		letter-spacing: ${unit(-0.3)};

		border: 1.5px solid rgba(26, 43, 89, 1);
		transition: box-shadow 0.3s ease, background-color 0.3s ease, color 0.3s ease;

		img {
			width: ${unit(20)};
			height: ${unit(20)};
		}

		&.download-button {
			background-color: rgba(26, 43, 89, 1);
			color: white;

			&:hover {
				background: rgba(35, 57, 110, 1);
				box-shadow: 0 6px 12px rgba(26, 43, 89, 0.24);
			}

			&:active {
				box-shadow: 0 3px 8px rgba(26, 43, 89, 0.22);
			}
		}
		&.reset-button {
			background-color: white;
			color: rgba(26, 43, 89, 1);

			&:hover {
				background: rgba(246, 248, 252, 1);
				box-shadow: 0 4px 9px rgba(113, 126, 157, 0.2);
			}

			&:active {
				box-shadow: 0 2px 6px rgba(113, 126, 157, 0.18);
			}
		}
	}
`;

export const AddThumbnailContainer = styled.article`
	width: min(${unit(560)}, calc(100vw - ${unit(32)}));
	border-radius: ${unit(14)};
	background: white;
	border: 1px solid rgba(222, 229, 237, 1);
	padding: ${unit(24)};
	animation: ${thumbnailModalFadeSlideIn} 0.22s ease forwards;

	h3 {
		font-size: ${unit(22)};
		line-height: ${unit(32)};
		font-weight: 700;
		color: rgba(26, 43, 89, 0.95);

		margin-bottom: ${unit(18)};

		text-align: center;
	}
`;

interface DragAndDropWrapperProps {
	isDragActive: boolean;
}

export const DragAndDropWrapper = styled.form<DragAndDropWrapperProps>`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;

	width: 100%;
	max-width: ${unit(460)};
	height: ${unit(214)};
	border-radius: ${unit(8)};

	border: 1.5px dashed rgba(75, 137, 212, 1);
	background-color: ${(props) => (props.isDragActive ? 'rgba(75, 137, 212, 0.1)' : 'white')};
	margin: 0 auto ${unit(18)};

	h5 {
		font-size: ${unit(18)};
		line-height: ${unit(28)};
		font-weight: 600;
		color: rgba(75, 137, 212, 1);

		margin-bottom: ${unit(8)};
	}

	p {
		font-size: ${unit(14)};
		line-height: ${unit(18)};
		font-weight: 400;
		color: rgba(114, 115, 126, 1);
		margin-bottom: ${unit(20)};
	}
`;

export const UploadButton = styled.label`
	width: ${unit(125)};
	height: ${unit(36)};
	border-radius: ${unit(8)};
	background: transparent;
	border: 1px solid rgba(75, 137, 212, 1);

	display: flex;
	align-items: center;
	justify-content: center;

	font-weight: 600;
	font-size: ${unit(16)};
	color: rgba(75, 137, 212, 1);

	cursor: pointer;
	user-select: none;
`;

export const LinkInsertButtonWrapper = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(8)};

	button {
		min-width: ${unit(84)};
		padding: 0 ${unit(14)};
		height: ${unit(40)};
		border-radius: ${unit(8)};

		display: flex;
		align-items: center;
		justify-content: center;

		font-size: ${unit(14)};
		font-weight: 700;
		letter-spacing: -0.4%;

		cursor: pointer;
		transition: box-shadow 0.3s ease, background-color 0.3s ease, color 0.3s ease;

		&:nth-of-type(1) {
			background: white;
			color: rgba(114, 115, 126, 1);
			border: 1px solid rgba(185, 194, 205, 1);

			&:hover {
				background: rgba(246, 248, 252, 1);
				box-shadow: 0 4px 9px rgba(113, 126, 157, 0.2);
			}

			&:active {
				box-shadow: 0 2px 6px rgba(113, 126, 157, 0.18);
			}
		}

		&:nth-of-type(2) {
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
	}
`;
