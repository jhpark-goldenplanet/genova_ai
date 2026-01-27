import { StringKeyAndAny } from '@/typings/base';
import { ChangeEvent, FC, useEffect, useMemo, useState } from 'react';
import { FieldErrors, RegisterOptions, UseFormRegister } from 'react-hook-form';

import { Colors } from '@/styles/globalStyles';
import { ErrorMessage } from '@hookform/error-message';
import { isEmpty, isUndefined } from 'lodash-es';
import * as S from './styled';

interface SelectProps {
	label?: string;
	name?: string;
	values: string[] | StringKeyAndAny[] | any;
	placeholder?: string;
	width?: number;
	height?: number;
	onChange?: (e: ChangeEvent<HTMLSelectElement>) => any;

	register?: UseFormRegister<any>;
	options?: RegisterOptions<any>;
	error?: boolean;
	errors?: FieldErrors<any>;

	valueStructure?: { label: string; key: string };
	disabled?: boolean;
	defaultValue?: string;
}

const Select: FC<SelectProps> = ({
	label,
	name,
	values,
	placeholder,
	width,
	height = 45,
	onChange,

	register,
	error,
	errors,
	options,

	valueStructure, // values=[{ a, b }] 값으로 들어갈 경우 사용 (string[]이 아닌 경우)
	defaultValue,
	disabled,
}) => {
	/**
	 * States
	 */
	const [value, setValue] = useState<string>('');

	/**
	 * Queries
	 */

	/**
	 * Side-Effects
	 */

	useEffect(() => {
		if (defaultValue) setValue(defaultValue);
	}, [defaultValue]);

	/**
	 * Handlers
	 */

	/**
	 * Helpers
	 */
	const isRegister = useMemo(
		() =>
			register &&
			name && {
				...register(name, {
					...options,
					onChange: (e) => {
						setValue(e.target.value);
						onChange?.(e);
					},
				}),
			},
		[register, name, options],
	);

	const selectColor = useMemo(
		// 수정하면 공유 부탁드립니다!!!
		() => (isEmpty(value) || value === placeholder ? 'rgb(91, 99, 112)' : Colors.navyBlack),
		[value, placeholder],
	);

	return (
		<S.Container $width={width} $height={height}>
			{label && <S.Label $required={!isUndefined(options)}>{label}</S.Label>}

			<S.Select
				{...isRegister}
				$isError={error}
				$width={width}
				$height={height}
				defaultValue=""
				placeholder={placeholder}
				disabled={disabled}
				style={{ color: selectColor }}
			>
				{/* 수정 이유 : 미선택으로 돌아갈 수 없음 */}
				{placeholder ? <option value="">{placeholder}</option> : null}

				{values?.map((v: string) => {
					if (typeof v === 'string') {
						return (
							<option value={v === '전체' ? '' : v} key={v}>
								{v}
							</option>
						);
					}

					//

					const { key, label: objLabel } = valueStructure!;
					return (
						<option value={JSON.stringify(v)} key={v[key]}>
							{v[objLabel]}
						</option>
					);
				}) ?? null}
			</S.Select>

			{error && name && (
				<S.ValidErrorP>
					<ErrorMessage errors={errors} name={name} />
				</S.ValidErrorP>
			)}
		</S.Container>
	);
};

export default Select;
