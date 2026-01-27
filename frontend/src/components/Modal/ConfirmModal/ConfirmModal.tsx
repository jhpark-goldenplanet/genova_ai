/* eslint-disable react/no-array-index-key */
import { IModal } from '..';
import { useModal } from '@/shared/hooks';
import React, { useState, ForwardRefRenderFunction, forwardRef, useImperativeHandle } from 'react';
import CommonConfirm from '../custom/CommonConfirm';
import ReactModal from 'react-modal';

const Modal = ReactModal as any; // 또는 더 구체적인 타입을 지정할 수 있습니다

interface Props {
	containerStyle?: any;

	//
	okHandler?: any;
	message?: string;
	type?: 'success' | 'error' | 'warning' | 'info' | 'question' | 'none';
}

const ConfirmModal: ForwardRefRenderFunction<IModal, Props> = (
	{ containerStyle, okHandler = () => {}, message = '', type = 'error' },
	ref,
) => {
	/**
	 * States
	 */
	const { closeConfirm } = useModal();
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
		closeConfirm();
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
	};

	return (
		<Modal
			className="Modal"
			overlayClassName="Overlay"
			isOpen={isOpen}
			onRequestClose={closeModal}
			shouldCloseOnEsc
			style={containerStyle}
			ariaHideApp={false}
		>
			<CommonConfirm message={message} type={type} buttonHandler={[onClickButton, okHandler]} />
		</Modal>
	);
};

export default forwardRef(ConfirmModal);
