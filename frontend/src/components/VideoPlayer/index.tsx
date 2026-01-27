'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type Player from 'video.js/dist/types/player';
import { videoControlBar } from './constants';
import { VideoPlayerProps } from './constants';
import { ISegmentsSchema } from '@/typings/schema';

export interface VideoPlayerHandle {
	seekTo: (time: number) => void;
	play: () => void;
	pause: () => void;
	getCurrentTime: () => number;
}

const videoJsDefaultOptions = {
	controls: true,
	autoplay: false,
	fluid: true,
	preload: 'auto',
	responsive: true,
	playbackRates: [0.5, 1, 1.5, 2],
};

const getPinColors = (index: number) => {
	const colors = [
		'rgba(104, 172, 255, 1)', // 1 - 파랑
		'rgba(87, 215, 238, 1)', // 2 - 하늘색
		'rgba(99, 242, 163, 1)', // 3 - 연두색
		'rgba(210, 97, 255, 1)', // 4 - 보라색
		'rgba(115, 111, 255, 1)', // 5 - 진한 보라색
		'rgba(247, 220, 111, 1)', // 6 - 노랑
		'rgba(187, 143, 206, 1)', // 7 - 연보라
		'rgba(133, 193, 226, 1)', // 8 - 스카이블루
		'rgba(248, 184, 139, 1)', // 9 - 연주황
		'rgba(171, 235, 198, 1)', // 10 - 연녹색
	];
	return colors[index] || 'rgba(104, 172, 255, 1)';
};

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
	({ src, width, height, className, chapters = [], isInfinityControl = false, onDurationChange }, ref) => {
		const videoRef = useRef<HTMLVideoElement | null>(null);
		const playerRef = useRef<Player | null>(null);
		const [isClient, setIsClient] = useState(false);

		useImperativeHandle(
			ref,
			() => ({
				seekTo: (time: number) => {
					if (playerRef.current) {
						playerRef.current.currentTime(time);
						playerRef.current.play();
					}
				},
				play: () => {
					playerRef.current?.play();
				},
				pause: () => {
					playerRef.current?.pause();
				},
				getCurrentTime: () => {
					return playerRef.current?.currentTime() ?? 0;
				},
			}),
			[],
		);

		const videoJsOptions = {
			...videoJsDefaultOptions,
			sources: [
				{
					src,
					type: 'video/mp4',
				},
			],
			inactivityTimeout: isInfinityControl ? 0 : 2000,
			width,
			height,
			controlBar: videoControlBar,
		};

		useEffect(() => {
			setIsClient(true);
		}, []);

		// Player 초기화
		useEffect(() => {
			if (!isClient || !videoRef.current) return;

			// 기존 플레이어 정리
			if (playerRef.current) {
				try {
					playerRef.current.dispose();
				} catch (e) {
					console.warn('Player dispose error:', e);
				}
				playerRef.current = null;
			}

			const initialize = async () => {
				// videoRef가 여전히 유효한지 재확인
				if (!videoRef.current || !document.contains(videoRef.current)) {
					return;
				}

				const videojs = (await import('video.js')).default;
				await import('./videojs-marker/videojs-markers-plugin');
				await import('video.js/dist/video-js.css');
				await import('videojs-markers-plugin/dist/videojs.markers.plugin.css');

				// videojs 초기화 전 한 번 더 확인
				if (!videoRef.current || !document.contains(videoRef.current)) {
					return;
				}

				const player = videojs(videoRef.current, videoJsOptions, function () {
					this.on('loadedmetadata', () => {
						const duration = this.duration();
						onDurationChange?.(duration ?? 0);
					});

					this.on('error', () => {
						const error = this.error();
						const errorCode = error?.code ?? 'default';
						const ERROR_MESSAGES: any = {
							2: '네트워크 오류: 영상 로딩이 중단되었거나 서버에 연결할 수 없습니다.',
							4: '형식 오류: 지원되지 않는 영상 형식이거나 파일이 손상되었습니다.',
							default: '비디오 플레이어 오류가 발생했습니다.',
						};
						console.error(ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default);
					});
				});

				playerRef.current = player;

				// 플레이어가 ready 상태가 되면 마커 초기화
				player.ready(function (this: any) {
					const playerAsAny = this as any;

					// 챕터에 인덱스별 색상 추가
					const markersWithColors = chapters.map((chapter, index) => ({
						...chapter,
						class: `chapter-${index + 1}`,
					}));

					playerAsAny.markers({
						markerTip: {
							display: true,
							text: function (marker: ISegmentsSchema) {
								return marker.title || '';
							},
						},
						markerStyle: {
							'width': '8px',
							'height': '8px',
							'border-radius': '50%',
							'margin-top': '-3px',
						},
						markers: markersWithColors,
					});
				});
			};

			initialize();

			return () => {
				if (playerRef.current) {
					playerRef.current.dispose();
					playerRef.current = null;
				}
			};
		}, [isClient, src]);

		// 챕터가 변경될 때 마커 업데이트
		useEffect(() => {
			if (!playerRef.current || !isClient || chapters.length === 0) return;

			const player = playerRef.current;
			const playerAsAny = player as any;

			// 플레이어가 준비되고 마커 플러그인이 로드된 후에만 실행
			if (player.readyState() >= 1) {
				if (playerAsAny?.markers && typeof playerAsAny.markers.reset === 'function') {
					const markersWithColors = chapters.map((chapter, index) => ({
						...chapter,
						class: `chapter-${index + 1}`,
					}));
					playerAsAny.markers.reset(markersWithColors);
				}
			} else {
				// 플레이어가 아직 준비되지 않은 경우 ready 이벤트를 기다림
				const onReady = () => {
					const playerAsAny = player as any;
					if (playerAsAny?.markers && typeof playerAsAny.markers.reset === 'function') {
						const markersWithColors = chapters.map((chapter, index) => ({
							...chapter,
							class: `chapter-${index + 1}`,
						}));
						playerAsAny.markers.reset(markersWithColors);
					}
				};
				player.one('loadedmetadata', onReady);
			}
		}, [chapters, isClient]);

		if (!isClient) {
			return null;
		}

		return (
			<div data-vjs-player>
				<video ref={videoRef} className={`video-js vjs-big-play-centered ${className || ''}`}>
					<p className="vjs-no-js">
						이 동영상을 보려면 JavaScript를 활성화하고, HTML5 비디오를 지원하는 웹 브라우저로 업그레이드하는 것을 고려하세요.
					</p>
				</video>
				<style jsx global>{`
					.vjs-marker.chapter-1 {
						background-color: rgba(104, 172, 255, 1) !important;
					}
					.vjs-marker.chapter-2 {
						background-color: rgba(87, 215, 238, 1) !important;
					}
					.vjs-marker.chapter-3 {
						background-color: rgba(99, 242, 163, 1) !important;
					}
					.vjs-marker.chapter-4 {
						background-color: rgba(210, 97, 255, 1) !important;
					}
					.vjs-marker.chapter-5 {
						background-color: rgba(115, 111, 255, 1) !important;
					}
					.vjs-marker.chapter-6 {
						background-color: rgba(247, 220, 111, 1) !important;
					}
					.vjs-marker.chapter-7 {
						background-color: rgba(187, 143, 206, 1) !important;
					}
					.vjs-marker.chapter-8 {
						background-color: rgba(133, 193, 226, 1) !important;
					}
					.vjs-marker.chapter-9 {
						background-color: rgba(248, 184, 139, 1) !important;
					}
					.vjs-marker.chapter-10 {
						background-color: rgba(171, 235, 198, 1) !important;
					}
				`}</style>
			</div>
		);
	},
);

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
