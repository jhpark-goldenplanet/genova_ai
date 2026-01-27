import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { Colors } from '@/styles/globalStyles';

interface InputStyleProps {
	$width?: number;
	$height?: number;
	$isError?: boolean;
	$checked?: boolean;
	$disabled?: boolean;
	status: string;
}

export const CheckboxContainer = styled.div<{ $align?: string }>`
	display: flex;
	align-items: center;
	justify-content: ${({ $align }) => $align || 'initial'};
`;

export const Icon = styled.svg`
	fill: none;
	stroke: white;
	stroke-width: ${unit(3)};
`;

export const HiddenCheckbox = styled.input`
	border: 0;
	clip: rect(0 0 0 0);
	height: ${unit(1)};
	margin: ${unit(-1)};
	overflow: hidden;
	padding: 0;
	position: absolute;
	white-space: nowrap;
	width: ${unit(1)};
`;

export const StyledCheckbox = styled.div<InputStyleProps>`
	display: inline-block;
	width: ${({ $width }) => ($width ? unit($width) : unit(22))};
	height: ${({ $height }) => ($height ? unit($height) : unit(22))};
	background: ${({ $checked, status }) => ($checked ? Colors[status] : 'none')};
	border: ${({ $checked, status }) => ($checked ? `1px solid ${Colors[status]}` : `none`)};
	box-shadow: ${({ $checked }) => ($checked ? 'none' : 'rgb(223, 229, 239) 0px 0px 0px 1px inset')};
	border-radius: ${unit(3)};
	transition: all 150ms;

	${Icon} {
		visibility: ${({ $checked }) => ($checked ? 'visible' : 'hidden')};
	}

	&:hover {
		cursor: pointer;
	}
`;

export const LabelText = styled.span`
	color: ${Colors.navyBlack};
	font-size: ${unit(14)};
	font-weight: 400;
	line-height: ${unit(21)};
	letter-spacing: ${unit(-0.32)};
	margin-left: ${unit(8)};
	&:hover {
		cursor: pointer;
	}
`;
