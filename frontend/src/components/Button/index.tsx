import React, { ButtonHTMLAttributes, FC, ReactNode } from 'react';
import { ButtonStatus } from '@/typings/base';
import { isUndefined } from 'lodash-es';

import * as S from './styled';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	text?: string;
	status?: ButtonStatus;
	width?: number | string;
	height?: number | string;
	radius?: number | string;
	fullWidth?: boolean;
	size?: 'sm' | 'md' | 'lg';
	children?: ReactNode;
}

/**
 * Presentation Component - Button
 * @param {
 *  text: string;
 *  width: number;
 *  status: {
 *      primary: '#3eacfb',
 * 		primary-bold : '#3078f6',
 * 		success: '#25c5ba',
 * 		success-bold: '#00a2a8'
 *      light: '#fff'
 *  }
 * }
 * @returns
 */
const Button: FC<ButtonProps> = ({
	text,
	status = 'primary',
	onClick,
	width = 140,
	height = 38,
	radius,
	fullWidth = false,
	size = 'md',
	disabled,
	children,
	style = {},
	type = 'button',
	className,
	...rest
}) => {
	const hasIcon = !isUndefined(children);
	return (
		<S.Button
			disabled={disabled}
			$width={width}
			$height={height}
			$radius={radius}
			$status={status}
			$hasIcon={hasIcon}
			$fullWidth={fullWidth}
			$size={size}
			type={type}
			style={style}
			onClick={onClick}
			className={className}
			{...rest}
		>
			{children ?? text}
		</S.Button>
	);
};

export default Button;
