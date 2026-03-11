'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManagementIndexPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace('/management/members');
	}, [router]);

	return null;
}
