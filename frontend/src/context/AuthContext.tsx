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

interface AuthContextType {
	user: User | null;
	loading: boolean;
	signInWithGoogle: () => Promise<void>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
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
		} catch (error) {
			console.error('Google sign in error:', error);
			throw error;
		}
	};

	const signOut = async () => {
		try {
			await firebaseSignOut(auth);
		} catch (error) {
			console.error('Sign out error:', error);
			throw error;
		}
	};

	return (
		<AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
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
