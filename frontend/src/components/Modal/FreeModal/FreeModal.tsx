/* eslint-disable react/no-array-index-key */
import { IModal } from '..';
import * as S from '../styled';
import { useModal } from '@/shared/hooks';
import ico_close from '@images/ico_close.png';
import Image from 'next/image';

import React, { useState, ForwardRefRenderFunction, forwardRef, useImperativeHandle } from 'react';
import ReactModal from 'react-modal';

const Modal = ReactModal as any; // 또는 더 구체적인 타입을 지정할 수 있습니다

interface Props {
	needCloseButton?: boolean;
	needOKButton?: boolean;
	onAfterClose?: any;
	containerStyle?: any;
	children?: JSX.Element;

	shouldCloseOnOverlayClick?: boolean;
	shouldCloseOnEsc?: boolean;
}

const FreeModal: ForwardRefRenderFunction<IModal, Props> = ({ children, needCloseButton = false, ...props }, ref) => {
	/**
	 * States
	 */
	const { closeFreeModal } = useModal();
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
		closeFreeModal();
		setOpen(false);
	};

	/**
	 * Helpers
	 */
	useImperativeHandle(ref, () => ({
		open: openModal,
		close: closeModal,
	}));

	return (
		<Modal
			className="Modal FreeModal"
			overlayClassName="Overlay FreeOverlay"
			isOpen={isOpen}
			onRequestClose={closeModal}
			shouldCloseOnEsc
			ariaHideApp={false}
			{...props}
		>
			{needCloseButton && (
				<S.CloseWrapper>
					<Image src={ico_close} onClick={closeModal} alt="닫기 버튼" />
				</S.CloseWrapper>
			)}

			{needCloseButton && <S.ModalBlank />}

			{/*  */}

			{children}
		</Modal>
	);
};

export default forwardRef(FreeModal);
