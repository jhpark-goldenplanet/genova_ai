import { useAnalyzeVideo, useGetStatusFile, useGetStatusProgressSummary } from './queries/video';
import { useParams, useRouter } from 'next/navigation';
import { LanguageCode } from '@/typings/schema';

const useGetVideoInfo = (language?: LanguageCode) => {
	const { videoId: videoIdParams } = useParams();
	const videoId = videoIdParams as string;
	const router = useRouter();

	// const { data: videoStatusResult, isError: isGetStatusError, error: statusError } = useGetStatusFile(videoId);
	const { data: videoStatusResult, isError: isGetStatusError, error: statusError } = useGetStatusProgressSummary(videoId);

	const isStatusComplete = videoStatusResult?.status === 'COMPLETE';
	const isFailedStatus =
		videoStatusResult?.status === 'FAILED' ||
		videoStatusResult?.status === 'CANCELED' ||
		videoStatusResult?.status === 'INVALID_VIDEO_ID';

	const {
		data: videoInfo,
		isError: analyzeError,
		isFetched: isFetchedAnalyze,
		isLoading: isAnalyzeLoading,
		error: analyzeErrorObj,
	} = useAnalyzeVideo(isStatusComplete ? videoId : undefined, language);

	const percentage = videoStatusResult?.progress ?? 0;

	const isLoaded = isFailedStatus || isFetchedAnalyze;
	const isError = isGetStatusError || analyzeError || isFailedStatus;

	// 에러 객체 생성
	// 1. statusError 또는 analyzeErrorObj가 있으면 사용
	// 2. status가 FAILED이고 error_code가 있으면 videoStatusResult를 에러로 사용
	let error = statusError || analyzeErrorObj;

	if (!error && isFailedStatus && videoStatusResult?.error_code) {
		// status API가 HTTP 200으로 성공했지만 내부에 error_code가 있는 경우
		error = videoStatusResult as any;
	}

	return {
		isLoaded,
		isError,
		videoInfo,
		videoId,
		percentage,
		originLanguage: videoInfo?.source_language ?? '',
		error // 에러 객체 추가
	};
};

export default useGetVideoInfo;
