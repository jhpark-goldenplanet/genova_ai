import React, { FC, HTMLInputTypeAttribute, useMemo } from 'react';
import { FieldErrors, RegisterOptions, UseFormRegister } from 'react-hook-form';

import * as S from './styled';
import { ErrorMessage } from '@hookform/error-message';
import { isUndefined } from 'lodash-es';

interface TextFieldProps {
	label?: string;
	name: string;
	placeholder?: string;
	type?: HTMLInputTypeAttribute;
	width?: number;
	height?: number;

	register?: UseFormRegister<any>;
	options?: RegisterOptions<any>;
	error?: boolean;
	errors?: FieldErrors<any>;

	inputStyle?: React.CSSProperties;
	hasNoErrorMessage?: boolean;

	//

	disabled?: boolean;
	maxLength?: number;
	inputMode?: 'email' | 'search' | 'text' | 'tel' | 'url' | 'numeric' | 'none' | 'decimal' | undefined;

	onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
}

const Textfield: FC<TextFieldProps> = ({
	label,
	name,
	placeholder,
	type = 'text',
	register,
	options,
	error,
	errors,
	width,
	height = 45,

	inputStyle,
	hasNoErrorMessage = false,
	//

	disabled,
	maxLength,
	inputMode,

	onKeyDown,
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
		<S.Article>
			<S.Container>
				{label && <S.Label $required={!isUndefined(options)}>{label}</S.Label>}

				<S.Input
					type={type}
					{...isRegister}
					$isError={error}
					$width={width}
					$height={height}
					disabled={disabled}
					placeholder={placeholder}
					inputMode={inputMode}
					maxLength={maxLength}
					onKeyDown={onKeyDown}
					style={inputStyle}
				/>
			</S.Container>

			{error && !hasNoErrorMessage && (
				<S.ValidErrorP>
					<ErrorMessage errors={errors} name={name} />
				</S.ValidErrorP>
			)}
		</S.Article>
	);
};

export default Textfield;
