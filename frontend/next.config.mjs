/** @type {import('next').NextConfig} */
const nextConfig = {
	// Standalone 모드 (Docker 최적화)
	output: 'standalone',

	// 프로덕션 빌드 시 console.log 제거
	compiler: {
		removeConsole: process.env.NODE_ENV === 'production' ? {
			exclude: ['error', 'warn'], // error, warn은 남김
		} : false,
	},

	// 이미지 최적화
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'storage.googleapis.com',
			},
		],
	},

	// 프로덕션 빌드 최적화
	swcMinify: true,
	reactStrictMode: true,
};

export default nextConfig;
