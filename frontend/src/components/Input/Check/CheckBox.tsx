import { ButtonStatus } from '@/typings/base';
import React, { FC, useState } from 'react';

import * as S from './styled';

interface CheckBoxProps {
	label?: string;
	isChecked?: boolean;
	checkHandler?: any;
	containerStyle?: any;
	align?: 'center' | 'left' | 'right';

	//

	status?: ButtonStatus;
	name?: string;
	value?: string;
	$width?: number;
	$height?: number;
	disabled?: boolean;
	labelStyle?: any;
}

const CheckBox: FC<CheckBoxProps> = ({
	label,
	isChecked = false,
	checkHandler,
	containerStyle = {},
	align,

	//

	status = 'primary',
	name = '',
	value,
	$width,
	$height,
	disabled,
	labelStyle,
}) => {
	/**
	 * States
	 */
	const [, setChecked] = useState<boolean>(isChecked);

	/**
	 * Side-Effects
	 */

	/**
	 * Handlers
	 */
	const handleCheck = () => {
		setChecked((prev) => {
			checkHandler({ id: Number(name), enable: !prev });
			return !prev;
		});
	};

	/**
	 * Helpers
	 */

	return (
		<S.CheckboxContainer $align={align} style={containerStyle} onClick={handleCheck}>
			<S.HiddenCheckbox type="checkbox" name={name} value={value} disabled={disabled} defaultChecked={isChecked} />
			<S.StyledCheckbox
				status={status}
				$width={$width}
				$height={$height}
				$checked={isChecked}
				$disabled={disabled}
				// onClick={handleCheck}
			>
				<S.Icon viewBox="0 0 24 24">
					<polyline points="20 6 9 17 4 12" />
				</S.Icon>
			</S.StyledCheckbox>
			{label ? <S.LabelText style={labelStyle}>{label}</S.LabelText> : null}
		</S.CheckboxContainer>
	);
};

export default CheckBox;
