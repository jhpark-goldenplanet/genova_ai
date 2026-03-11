'use client';

import { useParams } from 'next/navigation';
import VideoDetailLayout from '../detail-layout';
import MockDetailContent from '../components/MockDetailContent';

export default function ScriptPage() {
	const params = useParams<{ videoId: string }>();
	const videoId = params?.videoId ?? '';

	return (
		<VideoDetailLayout title="작업 상세 - 스크립트">
			<MockDetailContent videoId={videoId} tab="script" />
		</VideoDetailLayout>
	);
}
