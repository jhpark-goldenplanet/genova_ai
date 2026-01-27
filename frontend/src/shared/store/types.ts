// 얼럿 타입
export interface IAlertParam {
	message?: string;
	type?: 'success' | 'error' | 'warning';
	onAfterClose?: any;

	needCloseButton?: boolean;
	needOKButton?: boolean;
	disabled?: boolean;
	containerStyle?: any;
	children?: JSX.Element;

	//

	//
	show?: boolean;
}

//
//

// 컨펌 타입
export interface IConfirmParam {
	message?: string;
	type?: 'success' | 'error' | 'warning' | 'info' | 'question' | 'none';
	okHandler?: any;
	//
	show?: boolean;
}

export interface IFreeModalParam {
	needCloseButton?: boolean;
	needOKButton?: boolean;
	onAfterClose?: any;
	children?: JSX.Element;
	//
	disabled?: boolean;
	containerStyle?: any;

	//
	show?: boolean;
}
export interface AlertStore extends IAlertParam {
	dispatchOpenAlert: (alertInfo: IAlertParam) => void;
	dispatchCloseAlert: () => void;
}

export interface ConfirmStore extends IConfirmParam {
	dispatchOpenConfirm: (confirmInfo: IConfirmParam) => void;
	dispatchCloseConfirm: () => void;
}

export interface FreeModalStore extends IFreeModalParam {
	dispatchOpenFreeModal: (alertInfo: IAlertParam) => void;
	dispatchCloseFreeModal: () => void;
}

export interface ServiceTypeStore {
	selectedServiceType:
		| ''
		| '충북 스마트 챗봇'
		| 'InfoMate 챗봇'
		| 'GA4 챗봇'
		| '소비자원'
		| 'GA4 챗봇(리랭커 적용)'
		| 'GA4 챗봇(HybridSearch)'
		| 'GA4 챗봇(HybridSearch+리랭커)';
	isSuperPass: boolean;
	dispatchSelectedServiceType: (
		selectedServiceType:
			| ''
			| '충북 스마트 챗봇'
			| 'InfoMate 챗봇'
			| 'GA4 챗봇'
			| '소비자원'
			| 'GA4 챗봇(리랭커 적용)'
			| 'GA4 챗봇(HybridSearch)'
			| 'GA4 챗봇(HybridSearch+리랭커)',
	) => void;
	dispatchSuperPass: (isSuperPass: boolean) => void;
}

export type AvailableModels = 'gpt4o' | 'gpt_mini' | 'opus' | 'sonnet' | 'haiku';

export interface FlagStore {
	isUploaded: boolean;
	dispatchIsUpload: (isUploaded: boolean) => void;
}

export interface LanguageStore {
	language: string;
	dispatchLanguage: (language: string) => void;
}
