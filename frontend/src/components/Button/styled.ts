import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { unit } from '@/shared/utils/base';
import { ButtonStatus } from '@/typings/base';
import { Colors } from '@/styles/globalStyles';

interface ButtonStyleProps {
	$width?: number;
	$height?: number;
	$radius?: number;
	$status: ButtonStatus;
	$hasIcon: boolean;
}

const status = {
	primary: css`
		background-color: ${Colors.primary};
		border: none;
		color: #fff;
	`,

	primary_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.primary};
		color: ${Colors.primary};
	`,

	secondary: css`
		background-color: ${Colors.secondary};
		border: none;
		color: #fff;
	`,

	secondary_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.secondary};
		color: ${Colors.secondary};
	`,

	third: css`
		background-color: ${Colors.third};
		border: none;
		color: #fff;
	`,

	third_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.third};
		color: ${Colors.third};
	`,

	danger: css`
		background-color: ${Colors.danger};
		border: none;
		color: #fff;
	`,

	danger_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.danger};
		color: ${Colors.danger};
	`,

	warning: css`
		background-color: ${Colors.warning};
		border: none;
		color: #fff;
	`,

	warning_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.warning};
		color: ${Colors.warning};
	`,

	success: css`
		background-color: ${Colors.success};
		border: none;
		color: #fff;
	`,

	success_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.success};
		color: ${Colors.success};
	`,

	disabled: css`
		background-color: ${Colors.disabled};
		border: none;
		color: #c3c7cc;

		&:hover {
			cursor: default;
		}
	`,
};

export const Button = styled.button<ButtonStyleProps>`
	${({ $status }) =>
		($status === 'primary' && status.primary) ||
		($status === 'primary_outlined' && status.primary_outlined) ||
		/*  */

		($status === 'secondary' && status.secondary) ||
		($status === 'secondary_outlined' && status.secondary_outlined) ||
		/*  */

		($status === 'third' && status.third) ||
		($status === 'third_outlined' && status.third_outlined) ||
		/*  */

		($status === 'danger' && status.danger) ||
		($status === 'danger_outlined' && status.danger_outlined) ||
		/*  */

		($status === 'warning' && status.warning) ||
		($status === 'warning_outlined' && status.warning_outlined) ||
		/*  */

		($status === 'success' && status.success) ||
		($status === 'success_outlined' && status.success_outlined) ||
		/*  */
		($status === 'disabled' && status.disabled)};

	border-radius: ${({ $radius }) => ($radius ? unit($radius) : unit(7))};
	${({ $hasIcon }) => $hasIcon && `gap: ${unit(5)}`};
	display: flex;
	justify-content: center;
	align-items: center;

	font-size: ${unit(14)};
	font-weight: 400;
	line-height: 1.75;
	letter-spacing: -${unit(0.32)};

	min-width: ${({ $width }) => ($width ? unit($width) : 'auto')};
	height: ${({ $height }) => ($height ? unit($height) : 'auto')};
	padding: 0 ${unit(18)};

	&:hover {
		cursor: pointer;
	}
`;
