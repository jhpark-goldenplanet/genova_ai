import { useAlertStore, useConfirmStore, useFreeModalStore } from '../store';
import { AlertStore, ConfirmStore, FreeModalStore, IAlertParam, IConfirmParam, IFreeModalParam } from '../store/types';

interface IReturn {
	alert: (payload: IAlertParam) => void;
	closeAlert: () => void;

	confirm: (payload: IConfirmParam) => void;
	closeConfirm: () => void;

	custom: (payload: IFreeModalParam) => void;
	closeFreeModal: () => void;

	failAlert: (desc?: string) => void;
}

const useModal = (): IReturn => {
	const { dispatchOpenAlert, dispatchCloseAlert } = useAlertStore((state: AlertStore) => state);
	const { dispatchOpenConfirm, dispatchCloseConfirm } = useConfirmStore((state: ConfirmStore) => state);
	const { dispatchOpenFreeModal, dispatchCloseFreeModal } = useFreeModalStore((state: FreeModalStore) => state);

	const alert = (payload: IAlertParam) => {
		dispatchOpenAlert(payload);
	};

	const closeAlert = () => {
		dispatchCloseAlert();
	};

	const confirm = (payload: IConfirmParam) => {
		dispatchOpenConfirm(payload);
	};

	const closeConfirm = () => {
		dispatchCloseConfirm();
	};

	const custom = (payload: IFreeModalParam) => {
		dispatchOpenFreeModal(payload);
	};

	const closeFreeModal = () => {
		dispatchCloseFreeModal();
	};

	const failAlert = (message = '필수 정보를 정확히 입력해 주세요.') => {
		alert({
			type: 'error',
			message,
		});
	};

	return { alert, closeAlert, confirm, closeConfirm, failAlert, custom, closeFreeModal };
};

export default useModal;
