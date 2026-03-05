import { useAnalyzeVideo, useGetStatusProgressTranscribe } from './queries/video';
import { useParams } from 'next/navigation';
import { EStatus, LanguageCode } from '@/typings/schema';

const useGetVideoInfoForScript = (language?: LanguageCode) => {
	const { videoId: videoIdParams } = useParams();
	const videoId = videoIdParams as string;



	//

	// const { data: videoStatusResult, isError: isGetStatusError } = useGetStatusFile(videoId);
	const { data: videoStatusResult, isError: isGetStatusError } = useGetStatusProgressTranscribe(videoId);
	const status = videoStatusResult?.status;
	const step = videoStatusResult?.step;
	const isConvertingStatus = status === 'PENDING' || status === 'IN_PROGRESS';

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

	return {
		isLoaded,
		isError,
		videoInfo,
		videoId,
		percentage,
		originLanguage: videoInfo?.source_language ?? '',
		status: status as EStatus | undefined,
		step,
		isConverting: isConvertingStatus,
	};
};

export default useGetVideoInfoForScript;
