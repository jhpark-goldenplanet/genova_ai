export interface TokenInfoSchema {
	expiresIn: number;
	accessToken: string;
	refreshToken: string;
}

export interface IPostUploadSchema {
	code: number;
	error_code: number;
	file_id: string;
	message: string;
	video_id: string;
}

export type EStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'CANCELED' | 'INVALID_VIDEO_ID';

export interface IGetStatusFileSchema {
	code: number;
	error_code: number;
	message: string;
	status: EStatus;
	video_id: string;

	progress: number;

	step: 'UPLOADING' | 'UPLOADING_TO_GCS' | 'SUMMARIZATION' | 'TRANSCRIBE' | 'FINALIZING';

	// segments 필드는 /statusProgressSummary에서 제거됨 (성능 최적화)
	// 실제 segments 데이터는 /analyze 엔드포인트에서 가져와야 함
	segments?: [
		{
			start_time: string;
			end_time: string;
			title: string;
			summary: string;
			keywords: string[];
			scripts: string;
		},
	];
}

export interface ISegmentsSchema {
	segments_id: string;
	start_time: string;
	end_time: string;
	title: string; // 요청한 언어로 반환 (language 파라미터에 따라)
	summary: string; // 요청한 언어로 반환
	keywords: string[]; // 요청한 언어로 반환
	scripts: string; // 요청한 언어로 반환

	class: string;
	time: number;
}

export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'vi';

export interface IVideoSchema {
	code: number;
	message: string;
	file_id: string;
	title: string; // 요청한 언어로 반환
	path: string;
	summary: string; // 요청한 언어로 반환
	keywords: string[]; // 요청한 언어로 반환
	segments: ISegmentsSchema[];
	gcs_view_link: string;
	processing_status?: string;
	thumbnail_url?: string;
	source_language?: LanguageCode; // 원본 언어
}

export interface ISplitDownloadVideoSchema {
	download_urls: {
		segment_no: number;
		start_time: string;
		end_time: string;
		title: string;
		download_url: string;
		file_size_bytes: number;
		gcs_path: string;
	}[];
	expires_at: string;
}

export interface ICancelUploadSchema {
	code: number;
	message: string;
	cancel_reason: string;
}

export interface IGetUploadUrlSchema {
	code: number;
	message: string;
	upload_url: string;
	video_id: string;
	file_id: string;
}

export interface IConfirmUploadSchema {
	code: number;
	message: string;
	video_id: string;
}
