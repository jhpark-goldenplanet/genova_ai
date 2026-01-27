'use client';

import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/components/auth/LoginPage';
import Loader from '@/components/Loader';
import UploadContent from './components/UploadContent';

export default function Upload() {
	const { user, loading } = useAuth();

	// 로딩 중이면 로딩 화면 표시
	if (loading) {
		return <Loader isLoading={true} isFetching={true} />;
	}

	// 로그인하지 않았으면 로그인 페이지 표시
	if (!user) {
		return <LoginPage />;
	}

	// 로그인한 경우 업로드 페이지 표시
	return <UploadContent />;
}
