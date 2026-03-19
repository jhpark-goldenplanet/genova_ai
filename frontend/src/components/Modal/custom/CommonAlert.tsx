import * as S from './styled';
import Button from '@/components/Button';
import ico_error from '@images/ico_error.png';
import React, { FC } from 'react';
import { ButtonStatus, StringKeyAndVal } from '@/typings/base';

interface Props {
	message?: string;
	type: 'success' | 'error' | 'warning' | 'info' | 'question' | 'none';
	buttonHandler: () => void;
}

export const modalIcon: StringKeyAndVal = {
	success: 'modal_success.webp',
	error: 'modal_error.webp',
	warning: 'modal_warning.webp',
	info: 'modal_success.webp',
	question: 'modal_warning.webp',
	none: '',
};

const buttonStatusMap: Record<Props['type'], ButtonStatus> = {
	success: 'primary',
	error: 'danger',
	warning: 'warning',
	info: 'primary',
	question: 'primary',
	none: 'primary',
};

const CommonAlert: FC<Props> = ({ message, type = 'info', buttonHandler }) => {
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
	const splittedMessage = message?.split(/<b>|<\/b>/) || [];

	return (
		<S.CommonAlert>
			<S.ModalIcon src={ico_error} alt="얼럿 아이콘" width={60} height={60} />

			{/*  */}

			<S.ModalDescription>
				{splittedMessage.map((text, index) => {
					// eslint-disable-next-line react/no-array-index-key
					if (!(index === 0) && index % 2 === 1) return <b key={index}>{text}</b>;
					return text;
				})}
			</S.ModalDescription>

			<S.ModalButtonWrapper>
				<Button type="button" status={buttonStatusMap[type]} onClick={buttonHandler} width={96}>
					다시 시도
				</Button>
			</S.ModalButtonWrapper>
		</S.CommonAlert>
	);
};

export default CommonAlert;
