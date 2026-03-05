'use client';

import * as S from './styled';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Skeleton from 'react-loading-skeleton';
import Image from 'next/image';
import ico_prev from '@images/ico_prev.png';
import ico_next from '@images/ico_next.png';
import ico_copy from '@images/ico_copy.png';
import { convertTimeToSeconds, convertToCSV, generateIncrements, unit, decodeHtmlEntities } from '@/shared/utils/base';
import { LoaderOnly } from '@/components/LoaderOnly';
import useGetVideoInfo from '@/shared/hooks/useGetVideoInfo';
import { isUndefined } from 'lodash-es';
import VideoPlayer from '@/components/VideoPlayer';
import { ISegmentsSchema } from '@/typings/schema';
import copy from 'copy-to-clipboard';
import { successToast } from '@/shared/utils/toastUtils';
import { useModal } from '@/shared/hooks';
import TimelineSummarySkeleton from './components/TimelineSummarySkeleton';
import { useLanguageStore } from '@/shared/store/language';
import AnimatedSelect from '@/components/AnimatedSelect';

const TOTAL_STEPS = (60 * 2.5) / 2; // 10분 동안 2초마다

export default function Summary() {
	const { language, dispatchLanguage } = useLanguageStore((state) => state);

	const { confirm, closeConfirm } = useModal();
	const router = useRouter();

	// 첫 로딩 시에는 language 없이 요청 (원본), 이후 언어 변경 시 해당 언어로 요청
	// 페이지 이동 시 저장된 언어가 있으면 해당 언어로 시작
	const [requestLanguage, setRequestLanguage] = useState<string | undefined>(
		language !== 'ko' ? (language as any) : undefined
	);
	const { isLoaded, isError, videoInfo, originLanguage, status } = useGetVideoInfo(requestLanguage as any);
	const isReady = isLoaded && !isError && !isUndefined(videoInfo) && videoInfo.segments.length > 0;
	const isConverting = status === 'PENDING' || status === 'IN_PROGRESS';

	const [timestamp, setTimestamp] = useState<ISegmentsSchema[]>();
	const [selectedSummaryIndex, setSelectedSummaryIndex] = useState(0);
	const [count, setCount] = useState(0);

	const videoRef = useRef<any>(null);
	const incrementsRef = useRef(generateIncrements(TOTAL_STEPS, 99));


	useEffect(() => {
		let currentStep = 0;
		const intervalId = setInterval(() => {
			// 마지막 구간 직전까지는 미리 정해진 증가량을 더함

			if (isReady || count >= 99) {
				clearInterval(intervalId);
			} else if (currentStep < TOTAL_STEPS - 1) {
				setCount((prevCount) => {
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
	}, [isReady]);

	//

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
		if (!originLanguage) return; // 원본 언어를 아직 모르면 대기

		// 사용자가 언어를 변경했고, 원본 언어와 다르면 번역 요청
		if (language !== originLanguage && language !== requestLanguage) {
			setRequestLanguage(language as any);
		}
		// 사용자가 원본 언어로 돌아왔으면 language 파라미터 제거
		else if (language === originLanguage && requestLanguage !== undefined) {
			setRequestLanguage(undefined);
		}
	}, [language, originLanguage, requestLanguage]);

	useEffect(() => {
		if (!isReady) return;

		const CLASS_NAMES = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5'];

		const initialTimeStamps = videoInfo.segments.map((item, index) => {
			const time = convertTimeToSeconds(item.start_time);
			return {
				...item,
				time,
				class: CLASS_NAMES[index],
			};
		});

		setTimestamp(initialTimeStamps);
	}, [isReady, videoInfo]);

	//
	//

	const seletedTimeStamp = timestamp?.[selectedSummaryIndex];

	return (
		<S.Main>
			<S.PageTopBar>
				<S.PageDescription>영상 핵심 구간의 타임라인 요약과 키워드를 확인할 수 있습니다.</S.PageDescription>
				<S.PageTopActions>
					<AnimatedSelect
						value={language}
						onChange={(nextValue) => dispatchLanguage(nextValue)}
						options={[
							{ value: 'ko', label: '한국어' },
							{ value: 'en', label: 'English' },
							{ value: 'ja', label: '日本語' },
							{ value: 'zh', label: '中文' },
							{ value: 'vi', label: 'Tiếng Việt' },
						]}
					/>
				</S.PageTopActions>
			</S.PageTopBar>

			<S.DashboardContainer isReady={isReady}>
				<S.DashboardLeft>
					<S.VideoWrapper>
						{isReady && !isUndefined(timestamp) ? (
							<VideoPlayer key={videoInfo.gcs_view_link} ref={videoRef} src={videoInfo.gcs_view_link} chapters={timestamp} />
						) : (
							<>
								<Skeleton width="100%" height="100%" />
								<S.LoaderContainer>
									<LoaderOnly />
									<strong className="percentage">{`${count}%`}</strong>
									<h3>{isConverting ? '변환 중입니다. 🚀' : '영상을 핵심 주제별로 분할 중입니다. 🚀'}</h3>
									<p>{isConverting ? '요약/스크립트/분할 데이터가 준비되는 중입니다.' : '이 작업은 최대 10분까지 소요될 수 있습니다.'}</p>
									<button
										type="button"
										onClick={() => {
											confirm({
												message: `정말 업로드를 취소하시겠습니까?\n취소 시, 이전에 업로드한 영상은 확인할 수 없습니다.`,
												okHandler: () => {
													router.push('/');
													closeConfirm();
													successToast('업로드가 취소되었습니다.');
												},
											});
										}}
									>
										업로드 취소
									</button>
								</S.LoaderContainer>
							</>
						)}
					</S.VideoWrapper>
					<S.TimelineTopicWrapper>
						<h1>타임라인 주제</h1>

						{isReady ? (
							<ul>
								{timestamp?.map(({ start_time, end_time, title }, index) => {
									return (
										<li
											key={index}
											className="normal"
											onClick={() => {
												videoRef.current?.seekTo(convertTimeToSeconds(start_time));
											}}
										>
											<div className="timebox">
												<span className="time-text">{start_time}</span>
												<span className="time-wave">~</span>
												<span className="time-text">{end_time}</span>
											</div>
											<h3>{decodeHtmlEntities(title)}</h3>
										</li>
									);
								})}

								{timestamp?.map((_, index) => {
									return (
										<Fragment key={index}>
											<S.TimelineLine index={index} total={timestamp.length} />
										</Fragment>
									);
								})}
							</ul>
						) : (
							<ul>
								{[...Array(5)].map((_, index) => {
									const widthArray = [250, 350, 320, 400, 300];
									return (
										<li key={index} className="skeleton">
											<Skeleton width={unit(40)} />
											<span>~</span>
											<Skeleton width={unit(40)} />
											<Skeleton width={unit(widthArray[index])} />
										</li>
									);
								})}

								{[...Array(5)].map((_, index) => {
									return (
										<Fragment key={index}>
											<S.TimelineLine index={index} total={5} />
										</Fragment>
									);
								})}
							</ul>
						)}
					</S.TimelineTopicWrapper>
				</S.DashboardLeft>

				<S.TimelineSummaryWrapper
					isReady={isReady}
					selectedIndex={selectedSummaryIndex}
					maxIndex={(timestamp?.length ?? 5) - 1}
				>
					<div className="header-section">
						<h1>타임라인 별 요약</h1>

						<div className="page-button">
							<Image
								onClick={() =>
									setSelectedSummaryIndex((prev) => {
										if (!isReady) return prev;
										if (prev === 0) return prev;
										return prev - 1;
									})
								}
								src={ico_prev}
								alt="prev"
								width={22}
								height={22}
							/>
							<Image
								onClick={() =>
									setSelectedSummaryIndex((prev) => {
										if (!isReady) return prev;
										if (prev === (timestamp?.length ?? 0) - 1) return prev;
										return prev + 1;
									})
								}
								src={ico_next}
								alt="next"
								width={22}
								height={22}
							/>
						</div>
					</div>

					{isReady && !isUndefined(timestamp) ? (
						<>
							<S.TimelineSummaryBox>
								<span>{`${seletedTimeStamp!.start_time}  ~  ${seletedTimeStamp!.end_time}`}</span>
								<S.TimelineSummaryH3>{decodeHtmlEntities(seletedTimeStamp!.title)}</S.TimelineSummaryH3>
								<p>{decodeHtmlEntities(seletedTimeStamp!.summary)}</p>
							</S.TimelineSummaryBox>

							<S.Divider />

							<S.TimelineSummaryH3>이 타임라인의 핵심 키워드</S.TimelineSummaryH3>

							<S.TimelineSummaryKeyword>
								{seletedTimeStamp!.keywords.map((keyword, index) => {
									const isLast = index === seletedTimeStamp!.keywords.length - 1;
									const label = isLast ? decodeHtmlEntities(keyword) : `${decodeHtmlEntities(keyword)}, `;
									return <span key={index}>{label}</span>;
								})}
							</S.TimelineSummaryKeyword>
						</>
					) : (
						<TimelineSummarySkeleton />
					)}
				</S.TimelineSummaryWrapper>
			</S.DashboardContainer>

			{/*  */}
			{/*  */}
			{/*  */}

			{isReady && (
				<>
					<S.TotalSummaryWrapper>
						<div className="header-section">
							<h1>전체 영상 요약</h1>
							<Image
								onClick={() => {
									copy(videoInfo?.summary ?? '');
									successToast('클립보드에 복사되었습니다.');
								}}
								src={ico_copy}
								alt="next"
								width={22}
								height={22}
							/>
						</div>

						<p>{decodeHtmlEntities(videoInfo?.summary ?? '')}</p>

						<div className="header-section" style={{ marginBottom: unit(10) }}>
							<h3>이 영상의 핵심 키워드</h3>
							<Image
								onClick={() => {
									copy(videoInfo?.keywords.join(', ') ?? '');
									successToast('클립보드에 복사되었습니다.');
								}}
								src={ico_copy}
								alt="next"
								width={22}
								height={22}
							/>
						</div>

						<h5>{videoInfo?.keywords.map(k => decodeHtmlEntities(k)).join(', ')}</h5>
					</S.TotalSummaryWrapper>

					{/*  */}
					{/*  */}

					<S.TotalTimelineSummaryWrapper>
						<div className="header-section">
							<h1>타임라인 별 요약 모음</h1>
							<Image
								onClick={() => {
									const copyText = convertToCSV(timestamp);
									copy(copyText);
									successToast('타임라인 별 요약 모음이 복사되었습니다.');
								}}
								src={ico_copy}
								alt="next"
								width={22}
								height={22}
							/>
						</div>

						<S.TotalTimelineSummaryUL>
							{timestamp?.map(({ start_time, end_time, title, summary }, index) => {
								return (
									<li key={index}>
										<div className="left-section">
											<span className="time-text">{`${start_time}  ~  ${end_time}`}</span>
											<h3>{decodeHtmlEntities(title)}</h3>
										</div>

										<p>{decodeHtmlEntities(summary)}</p>
									</li>
								);
							})}
						</S.TotalTimelineSummaryUL>
					</S.TotalTimelineSummaryWrapper>
				</>
			)}
		</S.Main>
	);
}

//
//
//
//
//
//
//
//
