import { AlertStore, ConfirmStore, FreeModalStore, IAlertParam, IConfirmParam, IFreeModalParam } from './types';
import { create } from 'zustand';

export const useAlertStore = create<AlertStore>()((set) => ({
	dispatchOpenAlert: (alertInfo: IAlertParam) =>
		set((prev: any) => ({ ...prev, show: true, onAfterClose: undefined, ...alertInfo })),

	dispatchCloseAlert: () =>
		set((prev: any) => ({
			...prev,
			show: false,
			needOKButton: false,
			needCloseButton: false,
			onAfterClose: prev.onAfterClose,
		})),
}));

export const useConfirmStore = create<ConfirmStore>()((set) => ({
	dispatchOpenConfirm: (confirmInfo: IConfirmParam) => set((prev: any) => ({ ...prev, show: true, ...confirmInfo })),

	dispatchCloseConfirm: () =>
		set((prev: any) => ({ ...prev, show: false, needOKButton: false, needCloseButton: false })),
}));

export const useFreeModalStore = create<FreeModalStore>()((set) => ({
	dispatchOpenFreeModal: (freeModalInfo: IFreeModalParam) =>
		set((prev: any) => ({ ...prev, show: true, onAfterClose: undefined, ...freeModalInfo })),

	dispatchCloseFreeModal: () =>
		set((prev: any) => ({
			...prev,
			show: false,
			needOKButton: false,
			needCloseButton: false,
			onAfterClose: prev.onAfterClose,
		})),
}));
