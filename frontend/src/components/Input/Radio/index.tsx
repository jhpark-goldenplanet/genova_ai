import React, { FC, useMemo } from 'react';
import { Path, RegisterOptions, UseFormRegister } from 'react-hook-form';

import * as S from './styled';

interface RadioProps {
	name?: string;
	value?: string;
	label?: string;
	onClick?: any;
	checked?: boolean;
	register?: UseFormRegister<any>;
	options?: RegisterOptions<any>;
	error?: boolean;

	$width?: number;
	$height?: number;
	readonly?: boolean;
	disabled?: boolean;
}

const RadioButton: FC<RadioProps> = ({
	name,
	value,
	label,
	onClick,
	checked,
	register,
	options,
	error,
	$width,
	$height,
	disabled,
	readonly = false,
}) => {
	/**
	 * States
	 */

	/**
	 * Queries
	 */

	/**
	 * Side-Effects
	 */

	/**
	 * Handlers
	 */

	/**
	 * Helpers
	 */
	const isRegister = useMemo(() => register && name && { ...register(name), options }, [register, name, options]);

	return (
		<S.RadioContainer>
			<S.RadioCircle
				{...isRegister}
				$isError={error}
				$isReadonly={readonly}
				type="radio"
				checked={checked}
				name={name}
				value={value}
				$width={$width}
				$height={$height}
				disabled={disabled}
				onClick={onClick}
			/>
			{label}
		</S.RadioContainer>
	);
};

export default RadioButton;
