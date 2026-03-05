import {
	ICancelUploadSchema,
	IGetStatusFileSchema,
	IPostUploadSchema,
	ISplitDownloadVideoSchema,
	IVideoSchema,
	LanguageCode,
	IGetUploadUrlSchema,
	IConfirmUploadSchema,
} from '@/typings/schema';
import { getRequest, postFormRequest, postRequest } from './apiActions';
import {
	ICancelUploadPayload,
	IPostUploadByFilePayload,
	IPostUploadByLinkPayload,
	ISplitVideoPayload,
	IGetUploadUrlPayload,
	IConfirmUploadPayload,
} from '@/typings/payload';

const PATH_VIDEO = 'v1/video';

// 8f076afc7ffd4b3b9748235c6e58bbe1-0ba6e3f3
// 5873b407575c4bfaaa96b552aee94c48-f3c7e045

// Get
export const getStautsFile = (videoId?: string): Promise<IGetStatusFileSchema> => {
	return getRequest(`${PATH_VIDEO}/${videoId}/status`);
};

export const getStatusProgressSummary = (videoId?: string): Promise<IGetStatusFileSchema> => {
	return getRequest(`${PATH_VIDEO}/${videoId}/statusProgressSummary`);
};

export const getStatusProgressTranscribe = (videoId?: string): Promise<IGetStatusFileSchema> => {
	return getRequest(`${PATH_VIDEO}/${videoId}/statusProgressTranscribe`);
};

//

// Post
export const uploadByLink = (payload: IPostUploadByLinkPayload): Promise<IPostUploadSchema> => {
	return postRequest(`${PATH_VIDEO}/uploadByLink`, payload);
};

export const analyzeVideo = (videoId: string, language?: LanguageCode): Promise<IVideoSchema> => {
	const url = language
		? `${PATH_VIDEO}/${videoId}/analyze?language=${language}`
		: `${PATH_VIDEO}/${videoId}/analyze`;
	return postRequest(url);
};

export const splitDownload = (videoId: string, payload: ISplitVideoPayload): Promise<ISplitDownloadVideoSchema> => {
	return postRequest(`${PATH_VIDEO}/${videoId}/splitDownload`, payload);
};

export const cancelUpload = (videoId: string, payload: ICancelUploadPayload): Promise<ICancelUploadSchema> => {
	return postRequest(`${PATH_VIDEO}/${videoId}/cancel`, payload);
};

//

// Post (multipart/form-data)
export const uploadByFile = (payload: IPostUploadByFilePayload): Promise<IPostUploadSchema> => {
	return postFormRequest(`${PATH_VIDEO}/uploadByFile`, payload);
};

// GCS 직접 업로드 - Step 1: Signed URL 요청
export const getUploadUrl = (payload: IGetUploadUrlPayload): Promise<IGetUploadUrlSchema> => {
	return postRequest(`${PATH_VIDEO}/getUploadUrl`, payload);
};

// GCS 직접 업로드 - Step 2: GCS에 파일 업로드
export const uploadToGCS = async (
	uploadUrl: string,
	file: File,
	contentType?: string,
	onProgress?: (progress: number) => void,
): Promise<void> => {
	const normalizedContentType = (contentType || file.type || 'video/mp4')
		.split(';')[0]
		.trim()
		.toLowerCase();

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		// 진행률 이벤트
		if (onProgress) {
			xhr.upload.addEventListener('progress', (e) => {
				if (e.lengthComputable) {
					const percentComplete = (e.loaded / e.total) * 100;
					onProgress(percentComplete);
				}
			});
		}

		// 완료 이벤트
		xhr.addEventListener('load', () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
			} else {
				reject(new Error(`Upload failed with status ${xhr.status}`));
			}
		});

		// 에러 이벤트
		xhr.addEventListener('error', () => {
			reject(new Error('Upload failed'));
		});

		xhr.addEventListener('abort', () => {
			reject(new Error('Upload aborted'));
		});

		// PUT 요청으로 파일 업로드
		xhr.open('PUT', uploadUrl);
		xhr.setRequestHeader('Content-Type', normalizedContentType);
		xhr.send(file);
	});
};

// GCS 직접 업로드 - Step 3: 업로드 완료 알림
export const confirmUpload = (payload: IConfirmUploadPayload): Promise<IConfirmUploadSchema> => {
	return postRequest(`${PATH_VIDEO}/confirmUpload`, payload);
};
