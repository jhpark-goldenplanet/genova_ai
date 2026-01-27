import { getColor, unit } from '@/shared/utils/base';
import styled from '@emotion/styled';
import Image from 'next/image';

export const VideoWrapper = styled.section`
	background-color: rgba(247, 247, 249, 1);
	border: 1.5px solid rgba(222, 229, 237, 1);

	min-height: ${unit(300)};

	padding: 0 ${unit(190)};

	border-radius: ${unit(8)};
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

		img {
			width: ${unit(20)};
			height: ${unit(20)};
		}

		&.download-button {
			background-color: rgba(26, 43, 89, 1);
			color: white;
		}
		&.reset-button {
			background-color: white;
			color: rgba(26, 43, 89, 1);
		}
	}
`;

export const AddThumbnailContainer = styled.article`
	padding: ${unit(40)};

	h3 {
		font-size: ${unit(18)};
		line-height: ${unit(28)};
		font-weight: 600;
		color: rgba(19, 19, 20, 1);

		margin-bottom: ${unit(30)};

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

	width: ${unit(340)};
	height: ${unit(214)};
	border-radius: ${unit(8)};

	border: 1.5px dashed rgba(75, 137, 212, 1);
	background-color: ${(props) => (props.isDragActive ? 'rgba(75, 137, 212, 0.1)' : 'white')};
	margin-bottom: ${unit(30)};

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
	justify-content: center;
	gap: ${unit(10)};

	button {
		width: ${unit(88)};
		height: ${unit(40)};
		border-radius: ${unit(8)};

		display: flex;
		align-items: center;
		justify-content: center;

		font-size: ${unit(16)};
		font-weight: 700;
		letter-spacing: -0.4%;

		cursor: pointer;

		&:nth-of-type(1) {
			background: white;
			color: rgba(114, 115, 126, 1);
			border: 1px solid rgba(185, 194, 205, 1);
		}

		&:nth-of-type(2) {
			background: rgba(26, 43, 89, 1);
			color: white;
		}
	}
`;
