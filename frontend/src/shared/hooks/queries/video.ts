import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
	ICancelUploadSchema,
	IGetStatusFileSchema,
	IPostUploadSchema,
	ISplitDownloadVideoSchema,
	IVideoSchema,
	LanguageCode,
} from '@/typings/schema';
import {
	getStautsFile,
	uploadByLink,
	analyzeVideo,
	splitDownload,
	cancelUpload,
	uploadByFile,
	getStatusProgressSummary,
	getStatusProgressTranscribe,
} from '@/shared/apis/video';
import {
	ICancelUploadPayload,
	IPostUploadByFilePayload,
	IPostUploadByLinkPayload,
	ISplitVideoPayload,
} from '@/typings/payload';

export const VIDEO_KEYS = {
	all: ['video'],
	status: (videoId?: string) => [...VIDEO_KEYS.all, 'status', videoId] as const,
	statusProgressSummary: (videoId?: string) => [...VIDEO_KEYS.all, 'statusProgressSummary', videoId] as const,
	statusProgressTranscribe: (videoId?: string) => [...VIDEO_KEYS.all, 'statusProgressTranscribe', videoId] as const,
	analyze: (videoId?: string, language?: LanguageCode) => [...VIDEO_KEYS.all, 'analyze', videoId, language] as const,
};

const POLLING_INTERVAL = 5000;

// Get
export const useGetStatusFile = (videoId?: string): UseQueryResult<IGetStatusFileSchema> =>
	useQuery({
		queryKey: VIDEO_KEYS.status(videoId),
		queryFn: () => getStautsFile(videoId),
		enabled: !!videoId,
		refetchInterval: ({ state: { data, error } }) => {
			return error || (data?.status !== 'IN_PROGRESS' && data?.status !== 'PENDING') ? false : POLLING_INTERVAL;
		},
		refetchIntervalInBackground: true,
	});

export const useGetStatusProgressSummary = (videoId?: string): UseQueryResult<IGetStatusFileSchema> =>
	useQuery({
		queryKey: VIDEO_KEYS.statusProgressSummary(videoId),
		queryFn: () => getStatusProgressSummary(videoId),
		enabled: !!videoId,
		refetchInterval: ({ state: { data, error } }) => {
			return error || (data?.status !== 'IN_PROGRESS' && data?.status !== 'PENDING') ? false : POLLING_INTERVAL;
		},
		refetchIntervalInBackground: true,
	});

export const useGetStatusProgressTranscribe = (videoId?: string): UseQueryResult<IGetStatusFileSchema> =>
	useQuery({
		queryKey: VIDEO_KEYS.statusProgressTranscribe(videoId),
		queryFn: () => getStatusProgressTranscribe(videoId),
		enabled: !!videoId,
		refetchInterval: ({ state: { data, error } }) => {
			return error || (data?.status !== 'IN_PROGRESS' && data?.status !== 'PENDING') ? false : POLLING_INTERVAL;
		},
		refetchIntervalInBackground: true,
	});

export const useAnalyzeVideo = (videoId?: string, language?: LanguageCode): UseQueryResult<IVideoSchema> =>
	useQuery({
		queryKey: VIDEO_KEYS.analyze(videoId, language),
		queryFn: () => analyzeVideo(videoId as string, language),
		enabled: !!videoId,
	});

// Post
export const useUploadByLink = (): UseMutationResult<IPostUploadSchema, Error, IPostUploadByLinkPayload> =>
	useMutation({
		mutationFn: (payload: IPostUploadByLinkPayload) => uploadByLink(payload),
	});

export const useAnalyzeVideoDEPRECATED = (): UseMutationResult<IVideoSchema, Error, { videoId: string; language?: LanguageCode }> =>
	useMutation({
		mutationFn: ({ videoId, language }) => analyzeVideo(videoId, language),
	});

export const useSplitDownload = (): UseMutationResult<
	ISplitDownloadVideoSchema,
	Error,
	{ videoId: string; payload: ISplitVideoPayload }
> =>
	useMutation({
		mutationFn: ({ videoId, payload }) => splitDownload(videoId, payload),
	});

export const useCancelUpload = (): UseMutationResult<
	ICancelUploadSchema,
	Error,
	{ videoId: string; payload: ICancelUploadPayload }
> =>
	useMutation({
		mutationFn: ({ videoId, payload }) => cancelUpload(videoId, payload),
	});

// Post (multipart/form-data)
export const useUploadByFile = (): UseMutationResult<IPostUploadSchema, Error, IPostUploadByFilePayload> =>
	useMutation({
		mutationFn: (payload: IPostUploadByFilePayload) => uploadByFile(payload),
	});
