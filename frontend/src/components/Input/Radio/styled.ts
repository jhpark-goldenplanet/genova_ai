import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { Colors, flexRow } from '@/styles/globalStyles';

interface InputStyleProps {
	$width?: number;
	$height?: number;
	$isError?: boolean;
	$isReadonly?: boolean;
}

export const RadioContainer = styled.label`
	${flexRow}
	flex-wrap: wrap;
	gap: ${unit(9)};

	&:hover {
		cursor: pointer;
	}
`;

export const Text = styled.span`
	color: ${Colors.navyBlack};
	font-size: ${unit(14)};
	font-weight: 400;
	line-height: ${unit(21)};
	letter-spacing: ${unit(-0.32)};

	&:hover {
		cursor: pointer;
	}
`;

export const RadioCircle = styled.input<InputStyleProps>`
	/* width: ${({ $width }) => ($width ? unit($width) : unit(20))};
	height: ${({ $height }) => ($height ? unit($height) : unit(20))}; */

	&:hover {
		cursor: ${({ $isReadonly }) => ($isReadonly ? 'default' : 'pointer')};
	}
`;
