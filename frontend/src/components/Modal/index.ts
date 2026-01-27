/* eslint-disable import/no-cycle */
export { default as AlertModal } from './AlertModal/AlertModal';
export { default as ConfirmModal } from './ConfirmModal/ConfirmModal';
export { default as FreeModal } from './FreeModal/FreeModal';

export interface IModal {
	open: () => void;
	close: () => void;
}
