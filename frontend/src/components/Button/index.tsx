import React, { FC } from 'react';
import { ButtonStatus } from '@/typings/base';
import { isUndefined } from 'lodash-es';

import * as S from './styled';

interface ButtonProps {
	text: string;
	status: ButtonStatus;
	onClick?: any;
	width?: number;
	height?: number;
	radius?: number;
	disabled?: boolean;

	children?: JSX.Element;
	style?: React.CSSProperties;
	type?: 'button' | 'submit' | 'reset';
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
	status,
	onClick,
	width = 140,
	height = 38,
	radius,
	disabled,

	children,
	style = {},
	type = 'button',
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
			type={type}
			style={style}
			onClick={onClick}
		>
			<>
				{children}
				{text}
			</>
		</S.Button>
	);
};

export default Button;
