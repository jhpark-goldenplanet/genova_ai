import React from 'react';
import * as S from './styled';

interface Props {
	isChecked: boolean;
	onChange: () => void;
}

function Toggle({ isChecked, onChange }: Props) {
	return (
		<S.ToggleWrapper onClick={onChange}>
			<S.Slider isChecked={isChecked}>{isChecked ? 'EN' : 'KO'}</S.Slider>

			{/* KO / EN 텍스트 레이어 */}
			<S.TextLayer isChecked={isChecked}>
				<span className="left-text">KO</span>
				<span className="right-text">EN</span>
			</S.TextLayer>
		</S.ToggleWrapper>
	);
}

export default Toggle;
