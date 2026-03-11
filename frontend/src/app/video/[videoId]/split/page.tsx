'use client';

import { useParams } from 'next/navigation';
import VideoDetailLayout from '../detail-layout';
import MockDetailContent from '../components/MockDetailContent';

export default function SplitPage() {
	const params = useParams<{ videoId: string }>();
	const videoId = params?.videoId ?? '';

	return (
		<VideoDetailLayout title="작업 상세 - 분할">
			<MockDetailContent videoId={videoId} tab="split" />
		</VideoDetailLayout>
	);
}
