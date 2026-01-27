import { ErrorMessage } from '@hookform/error-message';
import { isUndefined } from 'lodash-es';
import React, { FC, forwardRef, useMemo } from 'react';
import { FieldErrors, RegisterOptions, UseFormRegister } from 'react-hook-form';

import * as S from './styled';

interface TextAreaProps {
	label?: string;

	name: string;
	placeholder?: string;
	width?: number;
	height?: number;

	register?: UseFormRegister<any>;
	options?: RegisterOptions<any>;
	error?: boolean;
	errors?: FieldErrors<any>;

	inputStyle?: React.CSSProperties;
	hasNoErrorMessage?: boolean;
	onKeyDown?: any;

	//

	disabled?: boolean;
	maxLength?: number;
}

const TextArea: FC<TextAreaProps> = ({
	label,
	name,
	placeholder,
	register,
	options,
	error,
	errors,
	width,
	height,

	inputStyle,
	hasNoErrorMessage = false,
	onKeyDown,
	//

	disabled,
	maxLength,
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

	const isRegister = useMemo(() => name && register && { ...register(name, options) }, [name, options, register]);

	return (
		<S.Container>
			{label && <S.Label $required={!isUndefined(options)}>{label}</S.Label>}

			<S.TextArea
				{...isRegister}
				$width={width}
				$height={height}
				$isError={error}
				placeholder={placeholder}
				disabled={disabled}
				maxLength={maxLength}
				style={inputStyle}
				onKeyDown={onKeyDown}
			/>

			{error && !hasNoErrorMessage && (
				<S.ValidErrorP>
					<ErrorMessage errors={errors} name={name} />
				</S.ValidErrorP>
			)}
		</S.Container>
	);
};

//

export default TextArea;
