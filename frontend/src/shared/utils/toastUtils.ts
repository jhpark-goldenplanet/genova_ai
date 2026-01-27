import { toast, Slide, Bounce } from 'react-toastify';

// 성공 알람 ( 초록색 창 )
export const successToast = (text: string, options?: any): void => {
	toast.success(text, {
		// hideProgressBar: true,
		closeOnClick: true,
		position: 'bottom-center',
		autoClose: 2000,
		transition: Bounce,
		progress: undefined,
		pauseOnHover: true,
		draggable: true,
		closeButton: false,
		pauseOnFocusLoss: false,
		...options,
	});
	toast.clearWaitingQueue();
};

// 실패 알람 ( 빨간색 창 )
export const errorToast = (text: string | JSX.Element, options?: any): void => {
	toast.error(text, {
		// hideProgressBar: true,
		closeOnClick: true,
		position: 'bottom-center',
		autoClose: 3500,
		transition: Bounce,
		progress: undefined,
		pauseOnHover: true,
		draggable: true,
		closeButton: false,
		pauseOnFocusLoss: false,
		...options,
	});
	toast.clearWaitingQueue();
};

// 경고 알람 ( 노란색 창 )
export const warningToast = (text: string, options?: any): void => {
	toast.warning(text, {
		// hideProgressBar: true,
		closeOnClick: true,
		position: 'bottom-center',
		autoClose: 2000,
		transition: Bounce,
		progress: undefined,
		pauseOnHover: true,
		draggable: true,
		closeButton: false,
		pauseOnFocusLoss: false,
		...options,
	});
	toast.clearWaitingQueue();
};

// 정보 알람
export const infoToast = (text: string, options?: any): void => {
	toast.info(text, {
		// hideProgressBar: true,
		closeOnClick: true,
		position: 'bottom-center',
		autoClose: 2000,
		transition: Bounce,
		progress: undefined,
		pauseOnHover: true,
		draggable: true,
		closeButton: false,
		pauseOnFocusLoss: false,
		...options,
	});
	toast.clearWaitingQueue();
};
