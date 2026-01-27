import { Inter } from 'next/font/google';
import RootLayoutClient from './RootLayout.client';
import 'react-toastify/dist/ReactToastify.css';
import 'react-loading-skeleton/dist/skeleton.css';
import './custom_video_marker.css';
import { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const viewport = {
	width: 'device-width',
	initialScale: 1,
};

export const metadata: Metadata = {
	title: 'Genova AI',
	description: 'Genvoa AI',
	icons: {
		icon: '/favicon.ico',
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ko">
			<head>
				<link
					rel="stylesheet"
					as="style"
					crossOrigin="anonymous"
					href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.6/dist/web/static/pretendard-dynamic-subset.css"
				/>
			</head>

			<body className={inter.className} suppressHydrationWarning>
				<RootLayoutClient>{children}</RootLayoutClient>
			</body>
		</html>
	);
}
