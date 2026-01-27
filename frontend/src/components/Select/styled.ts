import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { Colors, numberOfLines } from '@/styles/globalStyles';

interface SelectProps {
	$width?: number;
	$height?: number;

	$isError?: boolean;
	placeholder?: string;
}

export const Container = styled.div<SelectProps>`
	/* width: ${({ $width }) => ($width ? unit($width) : 'initial')}; */
	width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
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

export const Select = styled.select<SelectProps>`
	width: ${({ $width }) => ($width ? unit($width) : '100%')};
	height: ${({ $height }) => ($height ? unit($height) : 'initial')};

	border: ${({ $isError }) => ($isError ? `solid 1px ${Colors.danger} !important` : `solid 1px rgb(223, 229, 239)`)};
	border-radius: ${unit(7)};
	padding: ${unit(10)} ${unit(14)};

	color: ${Colors.navyBlack};
	font-size: ${unit(14)};
	line-height: ${unit(22)};
	letter-spacing: -${unit(0.32)};

	font-weight: normal;
	font-stretch: normal;
	font-style: normal;

	background-color: #fff;

	&:hover,
	&:focus {
		border: solid 2px rgb(93, 135, 255);
	}

	option {
		width: ${({ $width }) => $width && unit($width)};
		height: ${({ $height }) => $height && unit($height)};
	}

	& > option:hover {
		background-color: #f1f7fc;
		color: #000;
	}

	&:disabled {
		background-color: white;
		border: solid 1px rgb(223, 229, 239);
		color: rgb(168, 168, 168);
	}
`;

export const ValidErrorP = styled.p`
	/* color: #ff0000; */
	color: ${Colors.danger};
	font-size: ${unit(12)};
	letter-spacing: ${unit(-0.26)};
	padding-top: ${unit(4)};
	padding-left: ${unit(14)};
	width: 100%;
	text-align: left;

	/* 혹시나 width 잘리는 경우 대비하여 numberOfLines */
	${numberOfLines(1)}
`;
