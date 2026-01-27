import { ISegmentsSchema } from '@/typings/schema';

export interface Marker {
	time: number;
	text: string;
	color?: string; // 각 마커의 색상을 지정할 수 있는 속성
	class?: string;
}

export interface VideoPlayerProps {
	src: string;
	width?: number;
	height?: number;
	className?: string;
	chapters?: ISegmentsSchema[];
	isInfinityControl?: boolean;
	onDurationChange?: (duration: number) => void;
}

export const videoControlBar = {
	children: [
		'playToggle', // 재생/일시정지 토글 버튼
		'timeDivider', // 시간 구분자 (/)
		'durationDisplay', // 전체 재생 시간
		'progressControl', // 재생 진행바
		'remainingTimeDisplay', // 남은 재생 시간
		// 'currentTimeDisplay', // 현재 재생 시간

		// 'volumePanel', // 볼륨 조절 패널

		// 'pictureInPictureToggle', // PIP(Picture in Picture) 모드
		'playbackRateMenuButton', // 재생 속도 조절 메뉴
		// 'qualitySelector', // 화질 선택 메뉴 (source가 여러 개일 때)
		// 'captionsButton', // 자막 켜기/끄기
		// 'descriptionsButton', // 자막 선택 버튼 (설정된 경우)
		'chaptersButton', // 챕터 선택 버튼 (설정된 경우)
		'fullscreenToggle', // 전체화면 토글 버튼
	],
};
