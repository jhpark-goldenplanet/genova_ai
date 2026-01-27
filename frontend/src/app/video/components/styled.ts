import { unit } from '@/shared/utils/base';
import styled from '@emotion/styled';

export const AddThumbnailContainer = styled.form`
	padding: ${unit(40)};

	h2 {
		font-size: ${unit(20)};
		line-height: ${unit(25)};
		font-weight: 600;
		color: rgba(19, 19, 20, 1);

		margin-bottom: ${unit(8)};

		text-align: center;
	}

	p {
		font-size: ${unit(16)};
		line-height: ${unit(24)};
		font-weight: 400;
		color: rgba(52, 53, 65, 1);

		margin-bottom: ${unit(30)};

		text-align: center;
	}
`;

interface DragAndDropWrapperProps {
	isDragActive: boolean;
}

export const DragAndDropWrapper = styled.section<DragAndDropWrapperProps>`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;

	width: ${unit(502)};
	height: ${unit(172)};
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
	width: ${unit(97)};
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

export const LinkInsertButtonWrapper = styled.div<LinkInputProps>`
	display: flex;
	justify-content: center;
	gap: ${unit(10)};

	margin-top: ${unit(30)};

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
			opacity: ${(props) => (props.error ? 0.3 : 1)};
			color: white;
		}
	}
`;

export const Divider = styled.div`
	width: 100%;
	height: 1px;
	background: rgba(222, 229, 237, 1);

	margin-bottom: ${unit(30)};
`;

export const InserLinkH3Label = styled.h3`
	font-size: ${unit(18)};
	line-height: ${unit(24)};
	font-weight: 600;
	color: rgba(19, 19, 20, 1);

	margin-bottom: ${unit(8)};
`;

interface LinkInputProps {
	error?: boolean; // optional boolean prop
}

export const LinkInput = styled.input<LinkInputProps>`
	width: ${unit(502)};
	border-radius: ${unit(8)} !important;
	border: solid 1.5px;
	border-color: ${(props) => (props.error ? 'rgba(212, 75, 75, 1)' : 'rgba(185, 194, 205, 1)')};

	color: ${(props) => (props.error ? 'rgba(212, 75, 75, 1)' : 'rgba(19, 19, 20, 1)')};

	padding: ${unit(14)};
	font-size: ${unit(17)};
	font-weight: 400;
`;

export const ErrorMessage = styled.p`
	color: rgba(212, 75, 75, 1) !important;

	font-size: ${unit(12.5)};
	font-weight: 400;

	margin-top: ${unit(8)};
	margin-left: ${unit(9)};

	text-align: left !important;
`;
