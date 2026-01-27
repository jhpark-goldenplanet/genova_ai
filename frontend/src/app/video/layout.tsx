'use client';

import logo_navy from '@images/logo_navy.png';
import ico_plus from '@images/ico_plus.png';
import ico_summary from '@images/ico_summary.png';
import ico_script from '@images/ico_script.png';
import ico_split from '@images/ico_split.png';
import ico_edit from '@images/ico_edit.png';
import * as S from './styled';
import Image from 'next/image';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import useGetVideoInfo from '@/shared/hooks/useGetVideoInfo';
import { isUndefined } from 'lodash-es';
import { errorToast } from '@/shared/utils/toastUtils';
import { useModal } from '@/shared/hooks';
import Skeleton from 'react-loading-skeleton';
import { unit } from '@/shared/utils/base';
import NewVideoModal from './components/NewVideoModal';
import Loader from '@/components/Loader';
import { useLanguageStore } from '@/shared/store/language';

const NAV_MENUS = [
	{
		icon: ico_summary,
		keyword: 'summary',
		title: '요약 정리',
	},
	{
		icon: ico_script,
		keyword: 'script',
		title: '스크립트',
	},
	{
		icon: ico_split,
		keyword: 'split',
		title: '영상 분할',
	},
];

const TIMEOUT_INTERVAL = 900 * 1000; // 15분

export default function VideoLayout({ children }: { children: React.ReactNode }) {
	const { alert, confirm, closeConfirm, custom, closeFreeModal } = useModal();
	const { language, dispatchLanguage } = useLanguageStore((state) => state);

	const router = useRouter();
	const pathName = usePathname();

	const { isLoaded, isError, videoInfo, videoId, error } = useGetVideoInfo();

	const [videoTitle, setVideoTitle] = useState('');
	const [isBusy, setIsBusy] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const inputRef = useRef<HTMLInputElement>(null);
	const intervalRef = useRef<any>(null);
	const startTimeRef = useRef<number>(Date.now());

	const isReady = isLoaded && !isError && !isUndefined(videoInfo);

	// 에러 메시지 생성 함수
	const getErrorMessage = (error: any) => {
		const errorData = error as any;
		const error_code = errorData?.error_code;
		const retryable = errorData?.retryable;

		// retryable이 명시되지 않은 경우 에러 코드로 판단
		let shouldRetry = retryable;
		if (retryable === undefined || retryable === null) {
			// 1000번대 user_error는 재시도 불가
			if (error_code >= 1000 && error_code < 1100) {
				shouldRetry = false;
			} else {
				shouldRetry = true;
			}
		}

		let errorMsg = '';

		if (error_code === 1003) {
			errorMsg = '영상 길이는 최소 1분 이상이어야 합니다.';
		} else if (error_code === 1008 || error_code === 1005) {
			// 1008: VIDEO_TOO_LONG (문서 기준)
			// 1005: 백엔드가 현재 보내는 코드 (임시 처리)
			errorMsg = '영상 길이는 최대 45분까지 업로드 가능합니다.';
		} else if (error_code === 1002) {
			errorMsg = '파일 크기가 500MB를 초과합니다.';
		} else if (error_code >= 1700 && error_code <= 1706) {
			if (error_code === 1703) {
				errorMsg = 'YouTube 영상을 다운로드할 수 없습니다.\n연령 제한이 있는 영상입니다.';
			} else if (error_code === 1704) {
				errorMsg = 'YouTube 영상을 다운로드할 수 없습니다.\n비공개 영상입니다.';
			} else if (error_code === 1705) {
				errorMsg = 'YouTube 영상을 다운로드할 수 없습니다.\n지역 제한이 있는 영상입니다.';
			} else if (error_code === 1702) {
				errorMsg = 'YouTube 영상을 찾을 수 없습니다.\n삭제되었거나 URL이 잘못되었습니다.';
			} else {
				errorMsg = 'YouTube 영상을 다운로드할 수 없습니다.';
			}
		} else {
			errorMsg = '영상 생성 중 오류가 발생했습니다.';
		}

		// shouldRetry가 true인 경우에만 재시도 문구 추가
		if (shouldRetry) {
			errorMsg += '\n잠시 후 다시 시도해주세요.';
		}

		return errorMsg;
	};

	useEffect(() => {
		// 5초마다 실행되는 체크 함수
		const check = () => {
			try {
				// 현재 시간과 시작 시간의 차이 계산 (밀리초)
				const elapsedTime = Date.now() - startTimeRef.current;

				// 이미 에러가 발생했거나 준비가 완료되면 interval 정리
				if (isReady || isError) {
					clearInterval(intervalRef.current);
				}
				//
				else if (elapsedTime >= TIMEOUT_INTERVAL) {
					alert({
						message: `영상 생성 시간이 초과되었습니다.\n처음부터 다시 시도해주세요.`,
						onAfterClose: () => {
							router.push('/');
						},
					});
					clearInterval(intervalRef.current);
				}
			} catch (error) {
				console.error('Check failed:', error);
			}
		};

		intervalRef.current = setInterval(check, 5000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [isReady, isError]);

	useEffect(() => {
		if (!isUndefined(videoInfo?.title)) {
			setVideoTitle(videoInfo.title);
		}
	}, [videoInfo?.title]);

	useEffect(() => {
		if (isError) {
			setTimeout(() => {
				const errorMessage = getErrorMessage(error);
				const errorData = error as any;
				const error_code = errorData?.error_code;
				const retryable = errorData?.retryable;

				// retryable이 명시되지 않은 경우 에러 코드로 판단
				let shouldRetry = retryable;
				if (retryable === undefined || retryable === null) {
					// 1000번대 user_error는 재시도 불가
					if (error_code >= 1000 && error_code < 1100) {
						shouldRetry = false;
					} else {
						shouldRetry = true;
					}
				}

				alert({
					message: errorMessage,
					onAfterClose: () => {
						// retryable이 false면 홈으로, true면 새로고침
						if (shouldRetry === false) {
							router.push('/');
						} else {
							window.location.reload();
						}
					},
				});
			}, 500);
		}
	}, [isError, error]);

	const goToSelectedMenu = (keyword: string) => {
		if (!isReady) {
			if (isError) {
				errorToast('에러가 발생했습니다. 잠시 후 다시 시도해주세요.');
			} else {
				errorToast('영상 정보를 불러오는 중입니다. 잠시만 기다려주세요.');
			}

			return;
		}

		router.push(`/video/${videoId}/${keyword}`);
	};

	const goToInitalPage = () => {
		confirm({
			message: `다른 영상으로 시작하면\n진행 중인 작업 내용이 모두 사라집니다.\n정말 실행하시겠습니까?`,
			okHandler: () => {
				closeConfirm();

				custom({
					children: <NewVideoModal setIsBusy={setIsBusy} onClose={closeFreeModal} />,
				});
			},
		});
	};

	const handleHeaderClick = () => {
		confirm({
			message: '현재 영상을 종료하고 메인 화면으로 이동하시겠습니까?',
			okHandler: () => {
				closeConfirm();
				router.push('/');
			},
		});
	};

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setVideoTitle(newValue);
	};

	return (
		<S.VideoWrapper>
			<S.LeftNavBar>
				<S.NewThreadButton type="button" onClick={goToInitalPage}>
					<Image className="ico-plus" src={ico_plus} alt="ico-plus" width={18.5} height={18.5} />
					<span>새 영상</span>
				</S.NewThreadButton>

				<S.MenuWrapper>
					{NAV_MENUS.map(({ icon, title, keyword }) => {
						const isSelected = pathName.includes(keyword);
						const className = isSelected ? 'selected-menu' : '';
						return (
							<S.Menu key={title} className={className} onClick={() => goToSelectedMenu(keyword)}>
								<Image className="menu-icon" src={icon} alt={title} width={18.5} height={18.5} />
								<span>{title}</span>
							</S.Menu>
						);
					})}
				</S.MenuWrapper>
			</S.LeftNavBar>

			{/*  */}

			<S.VideoTitleWraper>
				{isReady ? (
					<S.VideoTitleInput
						ref={inputRef}
						name="input"
						placeholder="영상 제목을 입력해주세요!"
						value={videoTitle}
						// disabled={!isEditing}
						// onKeyDown={handleKeyDown}
						onChange={handleTitleChange}
						maxLength={80}
						isEditing={isEditing}
						onFocus={() => {
							setIsEditing(true);
						}}
						onBlur={() => {
							setTimeout(() => {
								setIsEditing(false);
							}, 200);
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								inputRef.current?.blur();
							}
						}}
					/>
				) : (
					<S.SkeletonWrapper>
						<Skeleton width={unit(846)} />
					</S.SkeletonWrapper>
				)}
				<Image
					className="ico-edit"
					src={ico_edit}
					alt="ico-edit"
					width={21}
					height={21}
					onClick={() => {
						if (isEditing) {
							inputRef.current?.blur();
						} else {
							inputRef.current?.focus();
						}
					}}
					role="button"
				/>
			</S.VideoTitleWraper>

			{children}

			<S.FixedHeader>
				<div className="logo-row">
					<Image onClick={handleHeaderClick} className="logo-navy" src={logo_navy} alt="logo-navy" height={26} />
					<span>Genova AI</span>
				</div>

				<S.FixedHeaderButtonArea>
					<S.LanguageSelector
						value={language}
						onChange={(e) => {
							if (!isReady) {
								if (isError) {
									errorToast('에러가 발생했습니다. 잠시 후 다시 시도해주세요.');
								} else {
									errorToast('영상 정보를 불러오는 중입니다. 잠시만 기다려주세요.');
								}
								return;
							}
							dispatchLanguage(e.target.value);
						}}
					>
						<option value="ko">한국어</option>
						<option value="en">English</option>
						<option value="ja">日本語</option>
						<option value="zh">中文</option>
						<option value="vi">Tiếng Việt</option>
					</S.LanguageSelector>
				</S.FixedHeaderButtonArea>
			</S.FixedHeader>
			<Loader isLoading={isBusy} isFetching={isBusy} />
		</S.VideoWrapper>
	);
}
