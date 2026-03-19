import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { unit } from '@/shared/utils/base';
import { ButtonStatus } from '@/typings/base';
import { Colors } from '@/styles/globalStyles';

interface ButtonStyleProps {
	$width?: number | string;
	$height?: number | string;
	$radius?: number | string;
	$status: ButtonStatus;
	$hasIcon: boolean;
	$fullWidth: boolean;
	$size: 'sm' | 'md' | 'lg';
}

const resolveUnit = (value?: number | string, fallback?: string) => {
	if (typeof value === 'number') return unit(value);
	return value || fallback || 'auto';
};

const status = {
	primary: css`
		background-color: ${Colors.primary};
		border: 1px solid transparent;
		color: #fff;
	`,

	primary_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.primary};
		color: ${Colors.primary};
	`,

	neutral: css`
		background-color: rgba(246, 248, 252, 1);
		border: 1px solid rgba(202, 215, 236, 1);
		color: rgba(53, 74, 112, 1);
	`,

	neutral_outlined: css`
		background-color: white;
		border: 1px solid rgba(201, 211, 225, 1);
		color: rgba(84, 98, 130, 1);
	`,

	secondary: css`
		background-color: ${Colors.secondary};
		border: 1px solid transparent;
		color: #fff;
	`,

	secondary_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.secondary};
		color: ${Colors.secondary};
	`,

	third: css`
		background-color: ${Colors.third};
		border: 1px solid transparent;
		color: #fff;
	`,

	third_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.third};
		color: ${Colors.third};
	`,

	danger: css`
		background-color: ${Colors.danger};
		border: 1px solid transparent;
		color: #fff;
	`,

	danger_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.danger};
		color: ${Colors.danger};
	`,

	warning: css`
		background-color: ${Colors.warning};
		border: 1px solid transparent;
		color: #fff;
	`,

	warning_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.warning};
		color: ${Colors.warning};
	`,

	success: css`
		background-color: ${Colors.success};
		border: 1px solid transparent;
		color: #fff;
	`,

	success_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.success};
		color: ${Colors.success};
	`,

	disabled: css`
		background-color: ${Colors.disabled};
		border: 1px solid transparent;
		color: #c3c7cc;

		&:hover {
			cursor: default;
			transform: none;
			box-shadow: none;
		}
	`,
};

const sizeStyles = {
	sm: css`
		min-height: ${unit(36)};
		padding: 0 ${unit(14)};
		font-size: ${unit(13)};
	`,
	md: css`
		min-height: ${unit(40)};
		padding: 0 ${unit(16)};
		font-size: ${unit(14)};
	`,
	lg: css`
		min-height: ${unit(44)};
		padding: 0 ${unit(18)};
		font-size: ${unit(15)};
	`,
};

export const Button = styled.button<ButtonStyleProps>`
	${({ $status }) =>
		($status === 'primary' && status.primary) ||
		($status === 'primary_outlined' && status.primary_outlined) ||
		($status === 'neutral' && status.neutral) ||
		($status === 'neutral_outlined' && status.neutral_outlined) ||
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

	${({ $size }) => sizeStyles[$size]};
	border-radius: ${({ $radius }) => resolveUnit($radius, unit(8))};
	${({ $hasIcon }) => $hasIcon && `gap: ${unit(5)}`};
	display: flex;
	justify-content: center;
	align-items: center;
	width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};

	font-weight: 700;
	line-height: 1;
	letter-spacing: -${unit(0.32)};

	min-width: ${({ $width, $fullWidth }) => ($fullWidth ? '100%' : resolveUnit($width, 'auto'))};
	height: ${({ $height }) => resolveUnit($height, 'auto')};
	transition: box-shadow 0.22s ease, background-color 0.22s ease, border-color 0.22s ease, color 0.22s ease, opacity 0.22s ease;
	white-space: nowrap;

	&:hover {
		cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
	}

	&:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(26, 43, 89, 0.14);
	}

	&:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 ${unit(3)} ${unit(8)} rgba(26, 43, 89, 0.12);
	}

	&:disabled {
		opacity: 0.7;
	}
`;
