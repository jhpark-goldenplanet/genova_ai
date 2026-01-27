import * as S from './styled';
import React, { FC } from 'react';
import { StringKeyAndVal } from '@/typings/base';
import { Colors } from '@/styles/globalStyles';

interface Props {
	message: string;
	type?: 'success' | 'error' | 'warning' | 'info' | 'question' | 'none';
	buttonHandler: [any, () => void]; // 확인 | 취소
}

export const modalIcon: StringKeyAndVal = {
	success: 'modal_success.webp',
	error: 'modal_error.webp',
	warning: 'modal_warning.webp',
	info: 'modal_success.webp',
	question: 'modal_warning.webp',
	none: '',
};

const buttonStyle: { [key: string]: any } = {
	success: [{ backgroundColor: Colors.primary }, {}],
	error: [{ backgroundColor: Colors.danger }, {}],
	warning: [{ backgroundColor: Colors.warning }, {}],
	info: [{ backgroundColor: Colors.primary }, {}],
	question: [{ backgroundColor: Colors.primary }, {}],
	green: [{}, {}],
};

const CommonConfirm: FC<Props> = ({ message, type = 'error', buttonHandler }) => {
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

	const buttons = ['취소', '확인'];

	return (
		<S.CommonAlert>
			<S.ModalDescription>
				{splittedMessage.map((text, index) => {
					// eslint-disable-next-line react/no-array-index-key
					if (!(index === 0) && index % 2 === 1) return <b key={index}>{text}</b>;
					return text;
				})}
			</S.ModalDescription>

			<S.ModalButtonWrapper $isConfirm>
				{[0, 1].map((i) => (
					<button
						key={i}
						type="button"
						onClick={() => {
							if (i === 0) buttonHandler[0]();
							else buttonHandler[1]();
						}}
						style={
							i === 0
								? {
										backgroundColor: 'white',
										border: '1px solid rgba(185, 194, 205, 1)',
										color: 'rgba(114, 115, 126, 1)',
									}
								: { backgroundColor: 'rgba(26, 43, 89, 1)' }
						}
						// style={buttonStyle[type][i]}
					>
						{buttons[i]}
					</button>
				))}
			</S.ModalButtonWrapper>
		</S.CommonAlert>
	);
};

export default CommonConfirm;
