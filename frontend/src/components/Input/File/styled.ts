import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { Colors } from '@/styles/globalStyles';

interface InputStyleProps {
	$width?: number;
	$height?: number;
	$isError?: boolean;
}

export const FileSection = styled.section`
	position: relative;
	width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;

	& > button {
		margin-left: ${unit(10)};
	}
`;
export const FileBox = styled.div<InputStyleProps>`
	width: ${({ $width }) => ($width ? unit($width) : '100%')};
	height: ${({ $height }) => ($height ? unit($height) : 'initial')};

	border: ${({ $isError }) => ($isError ? `solid 1px ${Colors.danger} !important` : `solid 1px rgb(223, 229, 239)`)};
	border-radius: ${unit(7)} !important;
	padding: ${unit(10)} ${unit(14)};

	color: ${Colors.navyBlack};
	font-size: ${unit(30)};
	line-height: ${unit(22)};
	letter-spacing: -${unit(0.32)};

	display: flex;
	align-items: center;
`;

export const Label = styled.label<{ $required: boolean }>`
	color: rgb(42, 53, 71);
	letter-spacing: ${unit(-0.24)};
	font-size: ${unit(15)};
	font-weight: 600;
	margin-bottom: ${unit(6)};

	white-space: pre-line;
	word-break: break-all;
	word-wrap: break-word;
	text-align: center;

	${({ $required }) =>
		$required
			? `&::before {
					content: '*';
					color: #f00;
					font-size: ${unit(14)};
					margin-right: ${unit(4)};
				}
				`
			: ''}
`;

export const FileLabel = styled.label`
	background-color: ${Colors.third};
	border: none;
	color: #fff;

	border-radius: ${unit(7)};
	display: flex;
	justify-content: center;
	align-items: center;

	font-size: ${unit(14)};
	font-weight: 500;
	line-height: 1.75;
	letter-spacing: -${unit(0.32)};

	width: ${unit(120)};
	height: ${unit(36)};

	margin-right: ${unit(16)};

	&:hover {
		cursor: pointer;
	}
`;

export const FileText = styled.div<{ $isActive?: boolean }>`
	color: ${({ $isActive }) => ($isActive ? Colors.navyBlack : 'rgb(168, 168, 168)')};
	font-size: ${unit(14)};
	line-height: ${unit(22)};
	letter-spacing: -${unit(0.32)};

	white-space: pre;
	text-overflow: ellipsis;
	overflow: hidden;

	font-weight: normal;
	font-stretch: normal;
	font-style: normal;
`;

export const FileInput = styled.input`
	display: none;
`;

export const FileList = styled.ul`
	margin-top: ${unit(15)};
	margin-bottom: ${unit(4)};

	display: flex;
	flex-direction: column;
	gap: ${unit(14)};
`;

export const FileItem = styled.li`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-left: ${unit(16)};
	gap: ${unit(30)};
`;

export const FileItemText = styled.span`
	font-size: ${unit(16)};
	max-width: ${unit(360)};

	white-space: pre;
	text-overflow: ellipsis;
	overflow: hidden;
`;

export const FileItemCloseBox = styled.div`
	img {
		width: ${unit(15)};
		height: ${unit(15)};

		position: relative;
		top: ${unit(2)};

		&:hover {
			cursor: pointer;
		}
	}
`;
