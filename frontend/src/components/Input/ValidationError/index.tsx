import React, { FC } from 'react';

import * as S from './styled';

interface IValidErrorProps {
	children: JSX.Element;
}

const InputValidError: FC<IValidErrorProps> = ({ children }) => <S.ValidErrorP>{children}</S.ValidErrorP>;
export default InputValidError;
