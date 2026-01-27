import {
	useAnalyzeVideo,
	useGetStatusFile,
	useGetStatusProgressSummary,
	useGetStatusProgressTranscribe,
} from './queries/video';
import { useParams, useRouter } from 'next/navigation';
import { LanguageCode } from '@/typings/schema';

const useGetVideoInfoForScript = (language?: LanguageCode) => {
	const { videoId: videoIdParams } = useParams();
	const videoId = videoIdParams as string;
	const router = useRouter();



	//

	// const { data: videoStatusResult, isError: isGetStatusError } = useGetStatusFile(videoId);
	const { data: videoStatusResult, isError: isGetStatusError } = useGetStatusProgressTranscribe(videoId);

	const isStatusComplete = videoStatusResult?.status === 'COMPLETE';
	const isFailedStatus =
		videoStatusResult?.status === 'FAILED' ||
		videoStatusResult?.status === 'CANCELED' ||
		videoStatusResult?.status === 'INVALID_VIDEO_ID';

	const {
		data: videoInfo,
		isError: analyzeError,
		isFetched: isFetchedAnalyze,
	} = useAnalyzeVideo(isStatusComplete ? videoId : undefined, language);

	//

	const percentage = videoStatusResult?.progress ?? 0;

	const isLoaded = isFailedStatus || isFetchedAnalyze;
	const isError = isGetStatusError || analyzeError || isFailedStatus;

	return { isLoaded, isError, videoInfo, videoId, percentage, originLanguage: videoInfo?.source_language ?? '' };
};

export default useGetVideoInfoForScript;
