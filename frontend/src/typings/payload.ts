export interface PagingPayload {
	page?: number;
	countPerPage?: number;
}

export interface IPostUploadByLinkPayload {
	url: string;
	title?: string;
	description?: string;
}

export interface IPostUploadByFilePayload {
	file: File;
}

export interface ICancelUploadPayload {
	cancel_reason: string;
}

export interface ISplitVideoPayload {
	segments: {
		segment_no: number;
		start_time: string;
		end_time: string;
		title: string;
	}[];
	thumbnail_image?: string; // Base64 인코딩된 이미지 문자열
}

export interface IGetUploadUrlPayload {
	filename: string;
	content_type: string;
	file_size: number;
}

export interface IConfirmUploadPayload {
	video_id: string;
}
