'use client';

import Image from 'next/image';
import * as S from './styled';
import ico_download from '@images/ico_download.png';
import { useEffect, useRef, useState } from 'react';
import { ISegmentsSchema } from '@/typings/schema';
import { useModal } from '@/shared/hooks';
import { isUndefined } from 'lodash-es';
import { convertTimeToSeconds, downloadAsCSV, downloadAsXLSX, generateIncrements, unit } from '@/shared/utils/base';
import { successToast } from '@/shared/utils/toastUtils';
import useGetVideoInfoForScript from '@/shared/hooks/useGetVideoInfoForScript';
import Skeleton from 'react-loading-skeleton';
import { LoaderOnly } from '@/components/LoaderOnly';
import { useLanguageStore } from '@/shared/store/language';

const TOTAL_STEPS = (60 * 1.5) / 2; // 10분 동안 2초마다

export default function Script() {
	const { confirm, closeConfirm } = useModal();
	const { language, dispatchLanguage } = useLanguageStore((state) => state);

	// 첫 로딩 시에는 language 없이 요청 (원본), 이후 언어 변경 시 해당 언어로 요청
	// 페이지 이동 시 저장된 언어가 있으면 해당 언어로 시작
	const [requestLanguage, setRequestLanguage] = useState<string | undefined>(
		language !== 'ko' ? (language as any) : undefined
	);

	const {
		isLoaded: isLoadedForScript,
		isError: isErrorForScript,
		videoInfo: videoInfoForScript,
		originLanguage,
		videoId,
	} = useGetVideoInfoForScript(requestLanguage as any);
	const isReadyForScript = isLoadedForScript && !isErrorForScript && !isUndefined(videoInfoForScript);

	const [timestamp, setTimestamp] = useState<ISegmentsSchema[]>();
	const [currentVideoId, setCurrentVideoId] = useState<string>();

	const [count, setCount] = useState(0);
	const incrementsRef = useRef(generateIncrements(TOTAL_STEPS, 99));

	useEffect(() => {
		let currentStep = 0;
		const intervalId = setInterval(() => {
			// 마지막 구간 직전까지는 미리 정해진 증가량을 더함

			if (isReadyForScript || count >= 99) {
				clearInterval(intervalId);
			} else if (currentStep < TOTAL_STEPS - 1) {
				setCount((prev) => {
					const prevCount = prev === 0 ? Math.floor(Math.random() * (59 - 31 + 1)) + 31 : prev;
					const newCount = prevCount + incrementsRef.current[currentStep];
					return newCount > 99 ? 99 : newCount;
				});
				currentStep++;
			} else {
				// 마지막 구간에서는 정확히 99로 마무리
				setCount(99);
				clearInterval(intervalId);
			}
		}, 2000); // 2초마다 업데이트
		return () => clearInterval(intervalId);
	}, [isReadyForScript]);

	//
	//

	// 원본 언어 초기화 (첫 로딩 시에만)
	useEffect(() => {
		if (!isReadyForScript) return;

		// 첫 로딩이고 원본 언어를 받았고, 현재 언어가 기본값(ko)이면 원본 언어로 설정
		if (originLanguage && !requestLanguage && language === 'ko') {
			dispatchLanguage(originLanguage);
		}
	}, [isReadyForScript, originLanguage, requestLanguage, dispatchLanguage, language]);

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
			console.log('[Script] videoId 변경 감지:', { prev: currentVideoId, new: videoId });
			setCurrentVideoId(videoId);
			setTimestamp(undefined); // timestamp 초기화
			setCount(0); // progress 초기화
		}
	}, [videoId, currentVideoId]);

	useEffect(() => {
		if (!isReadyForScript) return;

		console.log('[Script] videoInfo 업데이트:', {
			videoId,
			title: videoInfoForScript.title,
			segmentsCount: videoInfoForScript.segments?.length
		});

		setTimestamp(videoInfoForScript.segments);
	}, [isReadyForScript, videoInfoForScript, videoId]);

	const downloadScript = () => {
		closeConfirm();

		// 다운로드 시점의 최신 데이터 사용 (클로저 문제 방지)
		const currentTimestamp = timestamp || videoInfoForScript?.segments;
		const currentTitle = videoInfoForScript?.title;

		if (!currentTimestamp) {
			console.error('다운로드할 데이터가 없습니다.');
			return;
		}

		const prefix = currentTitle?.split('.')[0];
		const filename = `${prefix ? `${prefix}_` : ''}타임라인별_스크립트.xlsx`;

		console.log('[downloadScript] videoId:', videoInfoForScript?.file_id);
		console.log('[downloadScript] title:', currentTitle);
		console.log('[downloadScript] segments count:', currentTimestamp?.length);

		downloadAsXLSX(currentTimestamp, filename);
	};

	return (
		<S.Main>
			<S.TotalTimelineSummaryWrapper>
				<div className="header-section">
					<h1>타임라인 별 스크립트</h1>

					{isReadyForScript && !isUndefined(timestamp) && (
						<S.DownloadButton
							onClick={() => {
								confirm({
									message: '스크립트를 다운로드 하시겠습니까?',
									okHandler: downloadScript,
								});
							}}
						>
							<Image src={ico_download} alt="ico_download" width={21} height={21} />
							<span>다운로드</span>
						</S.DownloadButton>
					)}
				</div>

				{isReadyForScript && !isUndefined(timestamp) ? (
					<S.TotalTimelineSummaryUL>
						{videoInfoForScript.segments.map(({ start_time, end_time, title, scripts }, index) => {
							return (
								<li key={index}>
									<div className="left-section">
										<span className="time-text">{`${start_time}  ~  ${end_time}`}</span>
										<h3>{title}</h3>
									</div>

									<p>{scripts}</p>
								</li>
							);
						})}
					</S.TotalTimelineSummaryUL>
				) : (
					<>
						<Skeleton width="100%" height={unit(680)} />
						<S.LoaderContainer>
							<LoaderOnly />
							<strong className="percentage">{`${count}%`}</strong>
							<h3>타임라인 별 스크립트를 추출 중입니다. 🚀</h3>
							<p>이 작업은 최대 5분까지 소요될 수 있습니다.</p>
						</S.LoaderContainer>
					</>
				)}
			</S.TotalTimelineSummaryWrapper>

			{isReadyForScript && !isUndefined(timestamp) && (
				<S.DownloadButton
					onClick={() => {
						confirm({
							message: '스크립트를 다운로드 하시겠습니까?',
							okHandler: downloadScript,
						});
					}}
				>
					<Image src={ico_download} alt="ico_download" width={21} height={21} />
					<span>다운로드</span>
				</S.DownloadButton>
			)}
		</S.Main>
	);
}
