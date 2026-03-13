import { Noto_Sans_KR } from 'next/font/google';
import RootLayoutClient from './RootLayout.client';
import 'react-toastify/dist/ReactToastify.css';
import 'react-loading-skeleton/dist/skeleton.css';
import './custom_video_marker.css';
import { Metadata } from 'next';

const notoSansKr = Noto_Sans_KR({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700', '800'],
	display: 'swap',
});

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
			<body className={notoSansKr.className} suppressHydrationWarning>
				<RootLayoutClient>{children}</RootLayoutClient>
			</body>
		</html>
	);
}
