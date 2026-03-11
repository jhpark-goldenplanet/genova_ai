'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Image, { StaticImageData } from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { errorToast, successToast } from '@/shared/utils/toastUtils';
import Loader from '@/components/Loader';
import ico_summary from '@images/ico_summary.png';
import ico_script from '@images/ico_script.png';
import ico_split from '@images/ico_split.png';
import logo_navy from '@images/logo_navy.png';
import * as S from './styled';
import { useGetStatusProgressSummary } from '@/shared/hooks/queries/video';
import { EStatus } from '@/typings/schema';

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

export default function RootLayout({ children }: { children: ReactNode }) {
	const { user, loading, signOut } = useAuth();
	const router = useRouter();
	const pathname = usePathname() ?? '';
	const [storedVideoId, setStoredVideoId] = useState<string | null>(() => {
		if (typeof window === 'undefined') {
			return null;
		}
		return window.localStorage.getItem(LAST_VIDEO_ID_KEY);
	});
	const [pendingMenuKey, setPendingMenuKey] = useState<string | null>(null);
	const [pendingPath, setPendingPath] = useState<string | null>(null);
	const [isNavigationPending, setIsNavigationPending] = useState(false);
	const [isConverting, setIsConverting] = useState(false);
	const [isRouteTransitioning, setIsRouteTransitioning] = useState<boolean>(() => {
		if (typeof window === 'undefined') {
			return false;
		}

		return window.sessionStorage.getItem(ROUTE_TRANSITION_STORAGE_KEY) === '1';
	});
	const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const pathParts = pathname.split('/').filter(Boolean);
	const activeVideoId = pathParts[0] === 'video' && pathParts[1] ? pathParts[1] : null;
	const effectiveVideoId = activeVideoId || storedVideoId;
	const hasExistingWork = !!effectiveVideoId;
	const { data: videoStatus } = useGetStatusProgressSummary(effectiveVideoId || undefined);
	const conversionStatus = videoStatus?.status as EStatus | undefined;
	const isConvertingNow = conversionStatus === 'PENDING' || conversionStatus === 'IN_PROGRESS';
	const conversionToCompleteRef = useRef(false);
	const hasCompletionNotifiedRef = useRef(false);

	const activeMenu = (() => {
		if (pathname === '/') return 'upload';
		if (pathname.startsWith('/members')) return 'members';
		if (pathname.includes('/summary')) return 'summary';
		if (pathname.includes('/script')) return 'script';
		if (pathname.includes('/split')) return 'split';
		return '';
	})();
	const activeMenuKey = pendingMenuKey || activeMenu;
	const showFixedHeader = pathname.startsWith('/members');
	const fixedHeaderTitle = pathname.startsWith('/members') ? '회원 관리' : '';

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
		const prefetchTargets = ROOT_MENUS.map((menu) => {
			const targetPath = typeof menu.path === 'function' ? menu.path(effectiveVideoId) : menu.path;
			return targetPath || null;
		}).filter((value): value is string => Boolean(value));

		prefetchTargets.forEach((targetPath) => {
			router.prefetch(targetPath);
		});
	}, [router, effectiveVideoId]);

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
		if (!effectiveVideoId) {
			setIsConverting(false);
			return;
		}

		setIsConverting(isConvertingNow);

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

	if (loading) {
		return <Loader isLoading={true} isFetching={true} />;
	}

	if (!user) {
		return <>{children}</>;
	}

	return (
		<S.RootShell>
			<S.SideNav>
				<div>
					<S.SideNavBrand>
						<Image src={logo_navy} alt="genova-logo" width={24} height={24} />
						<span>Genova AI</span>
					</S.SideNavBrand>

					<S.SideMenu>
								{ROOT_MENUS.map((menu) => {
									const isActive = activeMenuKey === menu.key;
									const isConvertingDisabled = (menu.key === 'script' || menu.key === 'split') && isConverting;
									const isNoExistingWork = !!menu.requiresVideo && !hasExistingWork;
									const isDisabled = !!menu.requiresVideo && (isNoExistingWork || isConvertingDisabled);
									const targetPath = typeof menu.path === 'function' ? menu.path(effectiveVideoId) : menu.path;
									const tooltipMessage =
										isConvertingDisabled ? '영상 분석중' : isNoExistingWork ? menu.disabledMessage || '영상 업로드 후 이용해주세요' : '';

									return (
								<S.SideMenuItem key={menu.key} $active={isActive} $disabled={isDisabled}>
									<S.SideMenuAction
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
									</S.SideMenuAction>
								</S.SideMenuItem>
							);
						})}
					</S.SideMenu>
				</div>

				<S.SideNavSpacer />

				<S.SideNavFooter>
					<S.SideNavUser>{user.email}</S.SideNavUser>
					<S.SideNavButton onClick={handleLogout}>로그아웃</S.SideNavButton>
				</S.SideNavFooter>
			</S.SideNav>

			{showFixedHeader ? (
				<S.FixedHeader>
					<div className="page-title">{fixedHeaderTitle}</div>
				</S.FixedHeader>
			) : null}

			<S.RootContent $withHeader={showFixedHeader}>
				<S.RouteTransitionContent $isLoading={isRouteTransitioning}>
					{children}
				</S.RouteTransitionContent>
			</S.RootContent>
		</S.RootShell>
	);
}
