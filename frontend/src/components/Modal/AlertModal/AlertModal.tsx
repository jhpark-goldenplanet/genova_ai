/* eslint-disable react/no-array-index-key */
import { IModal } from '..';
import * as S from '../styled';
import { useModal } from '@/shared/hooks';
import React, { useState, ForwardRefRenderFunction, forwardRef, useImperativeHandle } from 'react';
import CommonAlert from '../custom/CommonAlert';
import ReactModal from 'react-modal';

const Modal = ReactModal as any; // 또는 더 구체적인 타입을 지정할 수 있습니다

interface Props {
	needCloseButton?: boolean;
	needOKButton?: boolean;
	onAfterClose?: any;
	disabled?: boolean;
	containerStyle?: any;
	children?: JSX.Element;

	//

	message?: string;
	type?: 'success' | 'error' | 'warning' | 'info' | 'question' | 'none';
}

const AlertModal: ForwardRefRenderFunction<IModal, Props> = (
	{ message, onAfterClose, containerStyle, type = 'info' },
	ref,
) => {
	/**
	 * States
	 */
	const { closeAlert } = useModal();
	const [isOpen, setOpen] = useState(false);

	/**
	 * Queries
	 */

	/**
	 * Side-Effects
	 */

	/**
	 * Handlers
	 */
	const openModal = () => setOpen(true);
	const closeModal = () => {
		closeAlert();
		setOpen(false);
	};

	/**
	 * Helpers
	 */
	useImperativeHandle(ref, () => ({
		open: openModal,
		close: closeModal,
	}));

	const onClickButton = () => {
		closeModal();
		// onAfterClose?.();
	};

	return (
		<Modal
			className="Modal"
			overlayClassName="Overlay"
			isOpen={isOpen}
			onRequestClose={closeModal}
			style={containerStyle}
			shouldCloseOnEsc
			onAfterClose={() => {
				onAfterClose?.();
			}}
			ariaHideApp={false}
		>
			<CommonAlert message={message} type={type} buttonHandler={onClickButton} />
		</Modal>
	);
};

export default forwardRef(AlertModal);
