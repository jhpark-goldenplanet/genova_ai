'use client';

import logo_navy from '@images/logo_navy.png';
import ico_summary from '@images/ico_summary.png';
import ico_script from '@images/ico_script.png';
import ico_split from '@images/ico_split.png';
import * as S from './styled';
import * as RootS from '../(root)/styled';
import Image, { StaticImageData } from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { flushSync } from 'react-dom';
import { startTransition, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import useGetVideoInfo from '@/shared/hooks/useGetVideoInfo';
import { errorToast, successToast } from '@/shared/utils/toastUtils';
import { useModal } from '@/shared/hooks';
import Loader from '@/components/Loader';
import { useGetStatusProgressSummary } from '@/shared/hooks/queries/video';
import { EStatus } from '@/typings/schema';

const TIMEOUT_INTERVAL = 900 * 1000; // 15분
const LAST_VIDEO_ID_KEY = 'genova_active_video_id';
const ROUTE_TRANSITION_STORAGE_KEY = 'genova_route_transition_active';
const ROUTE_TRANSITION_MS = 220;

type MenuPath = string | ((videoId: string | null) => string);

interface MenuItem {
	key: string;
	label: string;
	path: MenuPath;
	iconType: 'inline' | 'image';
	icon?: StaticImageData;
	requiresVideo?: boolean;
	disabledMessage?: string;
}

const ROOT_MENUS: MenuItem[] = [
	{
		key: 'upload',
		label: '영상 업로드',
		path: '/',
		iconType: 'inline',
	},
	{
		key: 'summary',
		label: '요약 정리',
		path: (videoId: string | null) => (videoId ? `/video/${videoId}/summary` : ''),
		iconType: 'image',
		icon: ico_summary,
		requiresVideo: true,
		disabledMessage: '영상 업로드 후 이용해주세요',
	},
	{
		key: 'script',
		label: '스크립트',
		path: (videoId: string | null) => (videoId ? `/video/${videoId}/script` : ''),
		iconType: 'image',
		icon: ico_script,
		requiresVideo: true,
		disabledMessage: '영상 업로드 후 이용해주세요',
	},
	{
		key: 'split',
		label: '영상 분할',
		path: (videoId: string | null) => (videoId ? `/video/${videoId}/split` : ''),
		iconType: 'image',
		icon: ico_split,
		requiresVideo: true,
		disabledMessage: '영상 업로드 후 이용해주세요',
	},
	{
		key: 'members',
		label: '회원 관리',
		path: '/members',
		iconType: 'inline',
	},
];

const findMenuLabel = (menuKey: string | null) => {
	const menu = ROOT_MENUS.find((item) => item.key === menuKey);
	return menu?.label ?? '';
};

const UploadMenuIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M12 4v12" />
		<path d="M7 9l5-5 5 5" />
		<path d="M6 20h12" />
	</svg>
);

const MembersMenuIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="8" r="3.5" />
		<path d="M5 20c1.2-3.8 3.8-6 7-6s5.8 2.2 7 6" />
	</svg>
);

export default function VideoLayout({ children }: { children: React.ReactNode }) {
	const { user, signOut } = useAuth();
	const { alert } = useModal();

	const router = useRouter();
	const pathname = usePathname() ?? '';

	const { isLoaded, isError, videoInfo, videoId, error, status } = useGetVideoInfo();
	const [storedVideoId, setStoredVideoId] = useState<string | null>(() => {
		if (typeof window === 'undefined') {
			return null;
		}
		return window.localStorage.getItem(LAST_VIDEO_ID_KEY);
	});

	const [isBusy, setIsBusy] = useState(false);
	const [pendingMenuKey, setPendingMenuKey] = useState<string | null>(null);
	const [pendingPath, setPendingPath] = useState<string | null>(null);
	const [isNavigationPending, setIsNavigationPending] = useState(false);
	const [isRouteTransitioning, setIsRouteTransitioning] = useState<boolean>(() => {
		if (typeof window === 'undefined') {
			return false;
		}

		return window.sessionStorage.getItem(ROUTE_TRANSITION_STORAGE_KEY) === '1';
	});
	const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const conversionToCompleteRef = useRef(false);
	const hasCompletionNotifiedRef = useRef(false);

	const intervalRef = useRef<any>(null);
	const startTimeRef = useRef<number>(Date.now());

	const isReady = isLoaded && !isError && !!videoInfo;

	// 에러 메시지 생성 함수
	const getErrorMessage = (error: any) => {
		const errorData = error as any;
		const error_code = errorData?.error_code;
		const retryable = errorData?.retryable;

		// shouldRetry 값 계산
		let shouldRetry = retryable;
		if (retryable === undefined || retryable === null) {
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

		if (shouldRetry) {
			errorMsg += '\n잠시 후 다시 시도해주세요.';
		}

		return errorMsg;
	};

	useEffect(() => {
		const check = () => {
			try {
				const elapsedTime = Date.now() - startTimeRef.current;

				if (isReady || isError) {
					clearInterval(intervalRef.current);
				} else if (elapsedTime >= TIMEOUT_INTERVAL) {
					alert({
						message: `영상 생성 시간이 초과되었습니다.\\n처음부터 다시 시도해주세요.`,
						onAfterClose: () => {
						startTransition(() => {
							router.push('/');
						});
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
		if (isError) {
			setTimeout(() => {
				const errorMessage = getErrorMessage(error);
				const errorData = error as any;
				const error_code = errorData?.error_code;
				const retryable = errorData?.retryable;

				let shouldRetry = retryable;
				if (retryable === undefined || retryable === null) {
					if (error_code >= 1000 && error_code < 1100) {
						shouldRetry = false;
					} else {
						shouldRetry = true;
					}
				}

				alert({
					message: errorMessage,
					onAfterClose: () => {
						if (shouldRetry === false) {
							startTransition(() => {
								router.push('/');
							});
						} else {
							window.location.reload();
						}
					},
				});
			}, 500);
		}
	}, [isError, error]);

	const pathParts = pathname.split('/').filter(Boolean);
	const activeVideoId = pathParts[0] === 'video' && pathParts[1] ? pathParts[1] : null;
	const effectiveVideoId = activeVideoId || videoId || storedVideoId;
	const hasExistingWork = !!effectiveVideoId;
	const isConverting = status === 'PENDING' || status === 'IN_PROGRESS';
	const { data: videoStatus } = useGetStatusProgressSummary(effectiveVideoId || undefined);
	const conversionStatus = videoStatus?.status as EStatus | undefined;
	const isConvertingByStatus = conversionStatus === 'PENDING' || conversionStatus === 'IN_PROGRESS';
	const isConvertingNow = isConverting || isConvertingByStatus;

	const activeMenu = (() => {
		if (pathname === '/') return 'upload';
		if (pathname.startsWith('/members')) return 'members';
		if (pathname.includes('/summary')) return 'summary';
		if (pathname.includes('/script')) return 'script';
		if (pathname.includes('/split')) return 'split';
		return '';
	})();
	const activeMenuKey = pendingMenuKey || activeMenu;

	const pageTitle = (() => {
		if (pathname === '/') return '영상 업로드';
		if (pathname.startsWith('/members')) return '회원 관리';
		if (pathname.includes('/summary')) return '요약 정리';
		if (pathname.includes('/script')) return '스크립트';
		if (pathname.includes('/split')) return '영상 분할';
		return 'Genova AI';
	})();
	const displayPageTitle = pendingMenuKey ? findMenuLabel(pendingMenuKey) : pageTitle;

	useEffect(() => {
		if (!effectiveVideoId) {
			conversionToCompleteRef.current = false;
			hasCompletionNotifiedRef.current = false;
			return;
		}

		if (isConvertingNow) {
			conversionToCompleteRef.current = true;
			hasCompletionNotifiedRef.current = false;
			return;
		}

		if (conversionToCompleteRef.current && conversionStatus === 'COMPLETE' && !hasCompletionNotifiedRef.current) {
			successToast('작업이 완료되었습니다');
			hasCompletionNotifiedRef.current = true;
		}

		if (conversionStatus && !isConvertingNow) {
			conversionToCompleteRef.current = false;
		}
	}, [conversionStatus, effectiveVideoId, isConvertingNow]);

	const handleMove = (path: string, menuKey: string) => {
		if (pathname === path) {
			return;
		}

		flushSync(() => {
			setPendingMenuKey(menuKey);
			setPendingPath(path);
			setIsNavigationPending(true);
			setIsRouteTransitioning(true);
		});
		if (typeof window !== 'undefined') {
			window.sessionStorage.setItem(ROUTE_TRANSITION_STORAGE_KEY, '1');
		}
		router.prefetch(path);
		router.push(path);
	};

	useEffect(() => {
		if (!isRouteTransitioning) {
			return;
		}

		// Keep pending menu state until the route is actually changed.
		if (pendingPath && pathname !== pendingPath) {
			return;
		}

		if (transitionTimerRef.current) {
			clearTimeout(transitionTimerRef.current);
		}

		transitionTimerRef.current = setTimeout(() => {
			setPendingMenuKey(null);
			setPendingPath(null);
			setIsNavigationPending(false);
			setIsRouteTransitioning(false);
			if (typeof window !== 'undefined') {
				window.sessionStorage.removeItem(ROUTE_TRANSITION_STORAGE_KEY);
			}
		}, ROUTE_TRANSITION_MS);

		return () => {
			if (transitionTimerRef.current) {
				clearTimeout(transitionTimerRef.current);
			}
		};
	}, [isRouteTransitioning, pathname, pendingPath]);

	useEffect(() => {
		return () => {
			if (transitionTimerRef.current) {
				clearTimeout(transitionTimerRef.current);
			}
		};
	}, []);

	const handleLogout = async () => {
		try {
			if (typeof window !== 'undefined') {
				window.localStorage.removeItem(LAST_VIDEO_ID_KEY);
				setStoredVideoId(null);
			}
			await signOut();
		} catch (error) {
			errorToast('로그아웃에 실패했습니다.');
		}
	};

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		if (activeVideoId) {
			window.localStorage.setItem(LAST_VIDEO_ID_KEY, activeVideoId);
			setStoredVideoId(activeVideoId);
			return;
		}

		const cachedVideoId = window.localStorage.getItem(LAST_VIDEO_ID_KEY);
		setStoredVideoId(cachedVideoId);
	}, [activeVideoId]);

	const isNavigatingToUpload = isNavigationPending && pendingPath === '/';

	return (
		<>
			<RootS.SideNav>
				<div>
					<RootS.SideNavBrand>
						<Image src={logo_navy} alt="genova-logo" width={24} height={24} />
						<span>Genova AI</span>
					</RootS.SideNavBrand>

					<RootS.SideMenu>
								{ROOT_MENUS.map((menu) => {
								const isActive = activeMenuKey === menu.key;
								const isConvertingDisabled =
									(menu.key === 'script' || menu.key === 'split') && isConvertingNow;
								const isNoExistingWork = !!menu.requiresVideo && !hasExistingWork;
								const isDisabled = !!menu.requiresVideo && (isNoExistingWork || isConvertingDisabled);
								const targetPath = typeof menu.path === 'function' ? menu.path(effectiveVideoId) : menu.path;
								const tooltipMessage =
									isConvertingDisabled
										? '영상 분석중'
										: isNoExistingWork
										? menu.disabledMessage || '영상 업로드 후 이용해주세요'
										: '';

								return (
								<RootS.SideMenuItem key={menu.key} $active={isActive} $disabled={isDisabled}>
									<RootS.SideMenuAction
										disabled={isDisabled}
										type="button"
										aria-disabled={isDisabled}
										data-tooltip={tooltipMessage || undefined}
										onClick={() => {
											if (isDisabled) {
												errorToast(tooltipMessage);
												return;
											}
									if (!targetPath) {
											errorToast(menu.disabledMessage || '현재 분석 중인 영상이 없습니다.');
											return;
										}
											handleMove(targetPath, menu.key);
										}}
									>
										{menu.iconType === 'inline' ? (
											menu.key === 'upload' ? (
												<UploadMenuIcon />
											) : (
												<MembersMenuIcon />
											)
										) : (
											<Image className="menu-icon-image" src={menu.icon!} alt={menu.label} width={18.5} height={18.5} />
										)}
										<span>{menu.label}</span>
									</RootS.SideMenuAction>
								</RootS.SideMenuItem>
							);
						})}
					</RootS.SideMenu>
				</div>

				<RootS.SideNavSpacer />

				<RootS.SideNavFooter>
					<RootS.SideNavUser>{user?.email}</RootS.SideNavUser>
					<RootS.SideNavButton onClick={handleLogout}>로그아웃</RootS.SideNavButton>
				</RootS.SideNavFooter>
			</RootS.SideNav>

			{!isNavigatingToUpload ? (
				<S.FixedHeader>
					<div className="page-title">{displayPageTitle}</div>
				</S.FixedHeader>
			) : null}

			<S.VideoWrapper>
				<S.RouteTransitionContent $isLoading={isRouteTransitioning}>
					{children}
				</S.RouteTransitionContent>
				<Loader isLoading={isBusy} isFetching={isBusy} withSidebar />
			</S.VideoWrapper>
		</>
	);
}
