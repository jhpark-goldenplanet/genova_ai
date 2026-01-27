'use client';

import * as S from './styled';
import dynamic from 'next/dynamic';
import ico_download from '@images/ico_download.png';
import ico_reset from '@images/ico_reset.png';
import Image from 'next/image';
import TimeRangePicker from '@/components/TimeRangePicker';
import { Fragment, useEffect, useRef, useState } from 'react';
import { isUndefined } from 'lodash-es';
import {
	convertTimeToSeconds,
	downloadFromGCP,
	fileToBase64,
	getPinImage,
	validateTimeRanges,
} from '@/shared/utils/base';
// import { splitDownload } from '@/shared/apis/video';
import useGetVideoInfo from '@/shared/hooks/useGetVideoInfo';
import { ISegmentsSchema } from '@/typings/schema';
import { splitDownload } from '@/shared/apis/video';
import Loader from '@/components/Loader';
import { useQueryClient } from '@tanstack/react-query';
import { VIDEO_KEYS } from '@/shared/hooks/queries/video';
import { useModal } from '@/shared/hooks';
import AddThumbnailModal from './components/AddThumbnailModal';
import VideoPlayer from '@/components/VideoPlayer';
import { useLanguageStore } from '@/shared/store/language';
import { errorToast, successToast } from '@/shared/utils/toastUtils';

const CLASS_NAMES = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];

export default function Split() {
	const { custom, closeFreeModal } = useModal();
	const { language, dispatchLanguage } = useLanguageStore((state) => state);

	// 첫 로딩 시에는 language 없이 요청 (원본), 이후 언어 변경 시 해당 언어로 요청
	// 페이지 이동 시 저장된 언어가 있으면 해당 언어로 시작
	const [requestLanguage, setRequestLanguage] = useState<string | undefined>(
		language !== 'ko' ? (language as any) : undefined
	);
	const { isLoaded, isError, videoInfo, videoId, originLanguage } = useGetVideoInfo(requestLanguage as any);

	const [timestamp, setTimestamp] = useState<ISegmentsSchema[]>();
	const [isBusy, setIsBusy] = useState(false);
	const [currentVideoId, setCurrentVideoId] = useState<string>();

	const videoRef = useRef<any>(null);
	const initialTimeStamps = useRef<ISegmentsSchema[]>();
	const videoDuration = useRef(0);

	const isReady = isLoaded && !isError && !isUndefined(videoInfo);

	const queryClient = useQueryClient();

	// 원본 언어 초기화 (첫 로딩 시에만)
	useEffect(() => {
		if (!isReady) return;

		// 첫 로딩이고 원본 언어를 받았고, 현재 언어가 기본값(ko)이면 원본 언어로 설정
		if (originLanguage && !requestLanguage && language === 'ko') {
			dispatchLanguage(originLanguage);
		}
	}, [isReady, originLanguage, requestLanguage, dispatchLanguage, language]);

	// 언어 변경 감지 및 재요청
	useEffect(() => {
		if (!originLanguage) return;

		if (language !== originLanguage && language !== requestLanguage) {
			setRequestLanguage(language as any);
		} else if (language === originLanguage && requestLanguage !== undefined) {
			setRequestLanguage(undefined);
		}
	}, [language, originLanguage, requestLanguage]);

	// videoId 변경 감지 및 state 초기화
	useEffect(() => {
		if (videoId && videoId !== currentVideoId) {
			console.log('[Split] videoId 변경 감지:', { prev: currentVideoId, new: videoId });
			setCurrentVideoId(videoId);
			setTimestamp(undefined); // timestamp 초기화
			initialTimeStamps.current = undefined; // initialTimeStamps 초기화
		}
	}, [videoId, currentVideoId]);

	useEffect(() => {
		if (videoInfo?.segments) {
			console.log('[Split] videoInfo 업데이트:', {
				videoId,
				title: videoInfo.title,
				segmentsCount: videoInfo.segments?.length
			});
			const initial = videoInfo.segments.map((item, index) => {
				const time = convertTimeToSeconds(item.start_time);
				return {
					...item,
					time,
					class: CLASS_NAMES[index],
				};
			});
			initialTimeStamps.current = initial;
			setTimestamp(initial);
		}
	}, [videoInfo]);

	const changeTimeStamp = (index: number, key: 'start_time' | 'end_time', value: string | null) => {
		// if (!value) return;

		setTimestamp((prevTimestamps) => {
			const updatedTimestamps = [...prevTimestamps!];

			updatedTimestamps[index] = {
				...updatedTimestamps[index],
				[key]: value,
				time: key === 'start_time' ? convertTimeToSeconds(value ?? '0') : updatedTimestamps[index].time,
			};

			return updatedTimestamps;
		});
	};

	const splitAndDownloadVideo = async (img_file?: File) => {
		if (!timestamp) return;

		// 다운로드 시점의 최신 데이터 사용 (클로저 문제 방지)
		const currentVideoInfo = videoInfo;
		const currentVideoId = videoId;

		if (!currentVideoInfo || !currentVideoId) {
			console.error('다운로드할 비디오 정보가 없습니다.');
			errorToast('비디오 정보를 불러올 수 없습니다.');
			return;
		}

		const isValid = validateTimeRanges(timestamp, videoDuration.current);

		if (!isValid) return;
		setIsBusy(true);

		try {
			console.log('[splitAndDownloadVideo] videoId:', currentVideoId);
			console.log('[splitAndDownloadVideo] title:', currentVideoInfo.title);
			console.log('[splitAndDownloadVideo] segments count:', timestamp.length);

			const segments = timestamp.map(({ start_time, end_time, title }, index) => {
				return {
					segment_no: index + 1,
					start_time,
					end_time,
					title,
				};
			});

			// File이 있으면 Base64로 변환
			let thumbnail_image: string | undefined;
			if (img_file) {
				thumbnail_image = await fileToBase64(img_file);
			}

			const payload = {
				segments,
				thumbnail_image, // Base64 문자열 (optional)
			};

			const { title, summary, keywords, segments: videoSegments } = currentVideoInfo;
			const target_download_json = {
				title,
				summary,
				keywords,
				segments: videoSegments,
			};

			const jsonFileName = `${(title || 'video').replace(/\.mp4$/, '')}_metadata.json`;

			const { download_urls } = await splitDownload(currentVideoId, payload);

			queryClient.invalidateQueries({
				queryKey: VIDEO_KEYS.analyze(currentVideoId),
			});

			// 1. 비디오 파일 다운로드
			const downloadLinks = download_urls.map(({ download_url, gcs_path }) => {
				// gcs_path에서 파일명 추출: segments/2025/10/23/.../segment_01.mp4
				const filename = gcs_path.split('/').pop() || 'segment.mp4';
				return { url: download_url, filename };
			});
			await downloadFromGCP(downloadLinks);

			// 2. JSON 파일 다운로드 로직 추가
			try {
				const jsonString = JSON.stringify(target_download_json, null, 2);
				const blob = new Blob([jsonString], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = jsonFileName;
				document.body.appendChild(a); // DOM에 추가해야 Firefox 등 일부 브라우저에서 작동
				a.click();
				document.body.removeChild(a); // 다운로드 후 DOM에서 제거
				URL.revokeObjectURL(url); // 메모리 해제

				successToast(
					`분할된 영상 ${download_urls.length}개와 메타데이터(JSON) 파일 다운로드가 완료되었습니다.`,
				);
			} catch (jsonError) {
				console.error('JSON 다운로드 중 오류 발생:', jsonError);

				errorToast('메타데이터(JSON) 파일 다운로드 중 오류가 발생했습니다. 다시 시도해주세요.');
			}
		} catch (error) {
			console.error('ERROR during split or download:', error);

			errorToast('영상 분할 중 오류가 발생했습니다. 다시 시도해주세요.');
		} finally {
			setIsBusy(false);
		}
	};

	const handleDownloadButton = async () => {
		const isValid = validateTimeRanges(timestamp!, videoDuration.current);
		if (!isValid) return;

		custom({
			children: <AddThumbnailModal splitAndDownloadVideo={splitAndDownloadVideo} onClose={closeFreeModal} />,
		});
	};

	const handleReset = () => {
		setTimestamp(initialTimeStamps.current);
	};

	const onDurationChange = (duration: number) => {
		videoDuration.current = duration;
	};

	//
	//

	if (!isReady) return null;
	// console.log('videoInfo', videoInfo);

	return (
		<main>
			<S.VideoWrapper>
				<VideoPlayer
					key={videoInfo.gcs_view_link}
					ref={videoRef}
					src={videoInfo.gcs_view_link}
					chapters={timestamp}
					onDurationChange={onDurationChange}
					isInfinityControl
				/>
			</S.VideoWrapper>

			{!isUndefined(timestamp) && (
				<>
					<S.TimeStampContainer>
						<h1>영상 분할</h1>

						<ul>
							{timestamp.map(({ start_time, end_time, title }, index) => {
								return (
									<li
										key={index}
										onClick={() => {
											videoRef.current?.seekTo(convertTimeToSeconds(start_time));
										}}
									>
										<S.TimePickerWrapper
											onClick={(e) => {
												e.stopPropagation();
											}}
										>
											<TimeRangePicker
												value={start_time}
												onChange={(value) => {
													changeTimeStamp(index, 'start_time', value);
												}}
												onBlur={() => {
													validateTimeRanges(timestamp, videoDuration.current);
												}}
											/>

											<span>~</span>

											<TimeRangePicker
												value={end_time}
												onChange={(value) => {
													changeTimeStamp(index, 'end_time', value);
												}}
											/>
										</S.TimePickerWrapper>
										<p>{title}</p>
									</li>
								);
							})}

							{timestamp?.map((_, index) => {
								const src = getPinImage(index);
								return (
									<Fragment key={index}>
										<S.TimelineLine index={index} total={timestamp.length} />
										<S.TimeLinePin src={src} index={index} total={timestamp.length} alt="ico_reset" width={9} height={12} />
									</Fragment>
								);
							})}
						</ul>
					</S.TimeStampContainer>

					<S.ButtonContainer>
						<button className="download-button" type="button" onClick={() => handleDownloadButton()}>
							<Image src={ico_download} alt="ico_download" width={18.5} height={18.5} />
							<span>다운로드</span>
						</button>
						<button className="reset-button" type="button" onClick={handleReset}>
							<Image src={ico_reset} alt="ico_reset" width={18.5} height={18.5} />
							<span>초기화</span>
						</button>
					</S.ButtonContainer>
				</>
			)}

			<Loader isFetching={isBusy} isLoading={isBusy} />
		</main>
	);
}
