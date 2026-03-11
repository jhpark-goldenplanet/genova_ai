'use client';

import { useParams } from 'next/navigation';
import VideoDetailLayout from '../detail-layout';
import MockDetailContent from '../components/MockDetailContent';

export default function SummaryPage() {
	const params = useParams<{ videoId: string }>();
	const videoId = params?.videoId ?? '';

	return (
		<VideoDetailLayout title="작업 상세 - 요약">
			<MockDetailContent videoId={videoId} tab="summary" />
		</VideoDetailLayout>
	);
}
