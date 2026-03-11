'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/shared/hooks';
import { errorToast } from '@/shared/utils/toastUtils';
import Loader from '@/components/Loader';
import logo_navy from '@images/logo_navy.png';
import NicknameModal from './components/NicknameModal';
import * as S from './styled';

const ROUTE_TRANSITION_STORAGE_KEY = 'genova_route_transition_active';
const ROUTE_TRANSITION_MS = 220;

interface MenuItem {
	key: string;
	label: string;
	path: string;
}

const ROOT_MENUS: MenuItem[] = [
	{ key: 'workspace', label: '워크스페이스', path: '/workspace' },
	{ key: 'management', label: '관리', path: '/management/members' },
	{ key: 'notices', label: '공지사항', path: '/notices' },
];

const WorkspaceMenuIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<rect x="3" y="4" width="18" height="16" rx="2.5" />
		<path d="M3 10h18" />
		<path d="M8 4v6" />
	</svg>
);

const ManageMenuIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M10 3h4l.9 2.2a7.6 7.6 0 0 1 1.6.9L18.7 5l2.8 2.8-1.1 2.2c.35.5.65 1.02.9 1.57L23 12v4l-2.2.9c-.25.55-.55 1.08-.9 1.57l1.1 2.2-2.8 2.8-2.2-1.1a7.6 7.6 0 0 1-1.6.9L14 25h-4l-.9-2.2a7.6 7.6 0 0 1-1.57-.9L5.3 23.1l-2.8-2.8 1.1-2.2a7.6 7.6 0 0 1-.9-1.57L0 16v-4l2.2-.9c.25-.55.55-1.08.9-1.57L2 7.2 4.8 4.4 7 5.5c.5-.35 1.02-.65 1.57-.9z" />
		<circle cx="12" cy="14" r="3.2" />
	</svg>
);

const NoticeMenuIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
		<path d="M10 20a2 2 0 0 0 4 0" />
	</svg>
);

const SettingsMenuIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="12" r="3.2" />
		<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
	</svg>
);

const LogoutMenuIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
		<path d="M10 17l5-5-5-5" />
		<path d="M15 12H4" />
	</svg>
);

const menuIconByKey = (key: string) => {
	if (key === 'workspace') return <WorkspaceMenuIcon />;
	if (key === 'management') return <ManageMenuIcon />;
	return <NoticeMenuIcon />;
};

export default function RootLayout({ children }: { children: ReactNode }) {
	const { user, loading, nickname, signOut } = useAuth();
	const { custom } = useModal();
	const router = useRouter();
	const pathname = usePathname() ?? '';
	const [pendingMenuKey, setPendingMenuKey] = useState<string | null>(null);
	const [pendingPath, setPendingPath] = useState<string | null>(null);
	const [isNavigationPending, setIsNavigationPending] = useState(false);
	const [isRouteTransitioning, setIsRouteTransitioning] = useState<boolean>(() => {
		if (typeof window === 'undefined') return false;
		return window.sessionStorage.getItem(ROUTE_TRANSITION_STORAGE_KEY) === '1';
	});
	const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const activeMenu = (() => {
		if (pathname.startsWith('/workspace') || pathname.startsWith('/video') || pathname === '/') return 'workspace';
		if (pathname.startsWith('/management') || pathname.startsWith('/members')) return 'management';
		if (pathname.startsWith('/notices')) return 'notices';
		return '';
	})();

	const activeMenuKey = pendingMenuKey || activeMenu;
	const userLabel = nickname || user?.displayName || user?.email || '사용자';
	const currentPlanLabel = 'Plus';

	const handleMove = (path: string, menuKey: string) => {
		if (pathname === path) return;

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
		ROOT_MENUS.forEach((menu) => router.prefetch(menu.path));
	}, [router]);

	useEffect(() => {
		if (!isRouteTransitioning) return;
		if (pendingPath && pathname !== pendingPath) return;

		if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
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
			if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
		};
	}, [isRouteTransitioning, pathname, pendingPath]);

	const handleLogout = async () => {
		try {
			await signOut();
			router.replace('/');
		} catch (error) {
			errorToast('로그아웃에 실패했습니다.');
		}
	};

	const handleOpenNicknameModal = () => {
		custom({
			children: <NicknameModal />,
		});
	};

	if (loading) return <Loader isLoading={true} isFetching={true} />;
	if (!user) return <>{children}</>;

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
							return (
								<S.SideMenuItem key={menu.key} $active={isActive}>
									<S.SideMenuAction type="button" onClick={() => handleMove(menu.path, menu.key)}>
										{menuIconByKey(menu.key)}
										<span>{menu.label}</span>
									</S.SideMenuAction>
								</S.SideMenuItem>
							);
						})}
					</S.SideMenu>
				</div>

				<S.SideNavSpacer />

				<S.SideNavFooter>
					<S.SideNavUser>
						<S.SideNavUserName title={userLabel}>{userLabel}</S.SideNavUserName>
						<S.SideNavUserPlan>{currentPlanLabel} Plan</S.SideNavUserPlan>
					</S.SideNavUser>
					<S.SideNavIconButton type="button" onClick={handleOpenNicknameModal} aria-label="닉네임 설정">
						<SettingsMenuIcon />
					</S.SideNavIconButton>
					<S.SideNavIconButton type="button" onClick={handleLogout} aria-label="로그아웃">
						<LogoutMenuIcon />
					</S.SideNavIconButton>
				</S.SideNavFooter>
			</S.SideNav>

			<S.RootContent>
				<S.RouteTransitionContent $isLoading={isRouteTransitioning || isNavigationPending}>
					{children}
				</S.RouteTransitionContent>
			</S.RootContent>
		</S.RootShell>
	);
}
