'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
	User,
	signInWithPopup,
	GoogleAuthProvider,
	signOut as firebaseSignOut,
	onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/config/firebase';

type MockUser = {
	uid: string;
	email: string;
	displayName: string | null;
	isMockUser: true;
};

type AppUser = (User & { isMockUser?: false }) | (MockUser & { isMockUser: true });

interface AuthContextType {
	user: AppUser | null;
	loading: boolean;
	nickname: string;
	signInWithGoogle: () => Promise<void>;
	signInWithIdPassword: (id: string, password: string) => Promise<void>;
	updateNickname: (nickname: string) => void;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const NICKNAME_STORAGE_PREFIX = 'genova_user_nickname';
const DEV_AUTH_STORAGE_KEY = 'genova_dev_auth_user';

const getNicknameStorageKey = (uid: string) => `${NICKNAME_STORAGE_PREFIX}:${uid}`;

const getDefaultNickname = (user: AppUser | null) => {
	if (!user) return '';
	return user.displayName || user.email || '';
};

const createDevMockUser = (): MockUser => ({
	uid: 'dev-workspace-user',
	email: 'dev@goldenplanet.co.kr',
	displayName: '개발 사용자',
	isMockUser: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname() ?? '';
	const [user, setUser] = useState<AppUser | null>(null);
	const [nickname, setNickname] = useState('');
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user) {
				setUser(user);
				setLoading(false);
				return;
			}

			const savedDevUser = window.localStorage.getItem(DEV_AUTH_STORAGE_KEY);
			if (savedDevUser) {
				try {
					setUser(JSON.parse(savedDevUser) as MockUser);
					setLoading(false);
					return;
				} catch (error) {
					window.localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
				}
			}

			if (pathname !== '/') {
				const devUser = createDevMockUser();
				window.localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify(devUser));
				setUser(devUser);
				setLoading(false);
				return;
			}

			setUser(null);
			setLoading(false);
		});

		return unsubscribe;
	}, [pathname]);

	useEffect(() => {
		if (!user) {
			setNickname('');
			return;
		}

		const savedNickname = window.localStorage.getItem(getNicknameStorageKey(user.uid));
		setNickname(savedNickname || getDefaultNickname(user));
	}, [user]);

	const signInWithGoogle = async () => {
		try {
			const provider = new GoogleAuthProvider();
			const result = await signInWithPopup(auth, provider);

			// goldenplanet 도메인 검증
			const email = result.user.email;
			if (!email || !email.endsWith('@goldenplanet.co.kr')) {
				await firebaseSignOut(auth);
				throw new Error('goldenplanet.co.kr 도메인 계정만 사용할 수 있습니다.');
			}

			setUser(result.user);
		} catch (error) {
			console.error('Google sign in error:', error);
			throw error;
		}
	};

	const signInWithIdPassword = async (id: string, password: string) => {
		if (!id.trim() || !password.trim()) {
			throw new Error('ID와 비밀번호를 모두 입력해주세요.');
		}

		// MVP 데모용 로그인: 실제 인증은 생략하고 로그인 상태만 흉내냄
		const mockUser = {
			uid: `demo-${id}`,
			email: id,
			displayName: id,
			isMockUser: true,
		} satisfies MockUser;
		window.localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify(mockUser));
		setUser(mockUser);
	};

	const updateNickname = (nextNickname: string) => {
		if (!user) return;
		const trimmedNickname = nextNickname.trim();
		const resolvedNickname = trimmedNickname || getDefaultNickname(user);
		window.localStorage.setItem(getNicknameStorageKey(user.uid), resolvedNickname);
		setNickname(resolvedNickname);
	};

	const signOut = async () => {
		try {
			await firebaseSignOut(auth);
			window.localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
			setUser(null);
			setNickname('');
		} catch (error) {
			console.error('Sign out error:', error);
			throw error;
		}
	};

	return (
		<AuthContext.Provider value={{ user, loading, nickname, signInWithGoogle, signInWithIdPassword, updateNickname, signOut }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
