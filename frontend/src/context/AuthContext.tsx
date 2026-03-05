'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
	signInWithGoogle: () => Promise<void>;
	signInWithIdPassword: (id: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AppUser | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			setUser(user);
			setLoading(false);
		});

		return unsubscribe;
	}, []);

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
		setUser({
			uid: `demo-${id}`,
			email: id,
			displayName: id,
			isMockUser: true,
		});
	};

	const signOut = async () => {
		try {
			await firebaseSignOut(auth);
			setUser(null);
		} catch (error) {
			console.error('Sign out error:', error);
			throw error;
		}
	};

	return (
		<AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithIdPassword, signOut }}>
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
