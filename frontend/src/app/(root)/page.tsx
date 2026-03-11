'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/components/auth/LoginPage';
import Loader from '@/components/Loader';

export default function RootEntryPage() {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (loading || !user) return;
		router.replace('/workspace');
	}, [loading, user, router]);

	if (loading) {
		return <Loader isLoading={true} isFetching={true} />;
	}

	if (!user) {
		return <LoginPage />;
	}

	return <Loader isLoading={true} isFetching={true} />;
}
