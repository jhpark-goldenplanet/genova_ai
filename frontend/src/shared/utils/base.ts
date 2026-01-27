// import { requestPreSignedUrl } from '../apis/s3';
import * as XLSX from 'xlsx';
import ico_pin1 from '@images/ico_pin1.png';
import ico_pin2 from '@images/ico_pin2.png';
import ico_pin3 from '@images/ico_pin3.png';
import ico_pin4 from '@images/ico_pin4.png';
import ico_pin5 from '@images/ico_pin5.png';
import { errorToast } from './toastUtils';
import { ISegmentsSchema } from '@/typings/schema';

const mobileFullWidth = 360;

// const defaultFontPixel = parseInt(getComputedStyle(document.documentElement).fontSize);
const defaultFontPixel = 16;

// px to rem
export const unit = (pxSize: number, float = 2): string => {
	const pxToRem = pxSize / defaultFontPixel;
	return `${pxToRem}rem`;
};

export const pxToRem = (pxSize: number) => {
	const pxToRem = pxSize / defaultFontPixel;
	return pxToRem;
};

export const remToPx = (remSize: number) => {
	return remSize * defaultFontPixel;
};

export const munit = (size: number, float = 2): string => {
	const ratio = ((size / mobileFullWidth) * 100).toFixed(float);
	return `${ratio}vw`;
};

export const REGEX = {
	url: /^https?:\/\/[\w.-]+\.[a-zA-Z]{2,}[^\s]*$/,
	youtube: /^https?:\/\/(www\.|m\.)?youtube\.com\/watch\?v=[\w-]+|^https?:\/\/youtu\.be\/[\w-]+|^https?:\/\/(www\.|m\.)?youtube\.com\/embed\/[\w-]+/,
};

/**
 * YouTube URL 검증 및 Video ID 추출
 * @param url - 검증할 URL
 * @returns { isValid: boolean, videoId: string | null, cleanUrl: string | null }
 *
 * 지원하는 URL 형식:
 * - 표준: https://www.youtube.com/watch?v=VIDEO_ID
 * - 모바일: https://m.youtube.com/watch?v=VIDEO_ID
 * - 단축: https://youtu.be/VIDEO_ID
 * - 임베드: https://www.youtube.com/embed/VIDEO_ID
 * - Shorts: https://www.youtube.com/shorts/VIDEO_ID
 * - Live: https://www.youtube.com/live/VIDEO_ID
 * - v 형식: https://www.youtube.com/v/VIDEO_ID
 * - nocookie: https://www.youtube-nocookie.com/embed/VIDEO_ID
 */
export const validateYouTubeUrl = (url: string): { isValid: boolean; videoId: string | null; cleanUrl: string | null } => {
	try {
		const trimmedUrl = url.trim();

		// YouTube URL 패턴들 (각 패턴의 videoId 위치가 다를 수 있음)
		const patterns: { regex: RegExp; videoIdIndex: number }[] = [
			// 1. 표준 watch 형식: https://www.youtube.com/watch?v=VIDEO_ID
			// 모바일(m.), www 있음/없음, 쿼리 파라미터 포함
			{
				regex: /^https?:\/\/(www\.|m\.)?youtube\.com\/watch\?.*v=([\w-]{11}).*$/,
				videoIdIndex: 2
			},

			// 2. 단축 형식: https://youtu.be/VIDEO_ID
			// 타임스탬프 등 쿼리 파라미터 포함 가능
			{
				regex: /^https?:\/\/youtu\.be\/([\w-]{11})(\?.*)?$/,
				videoIdIndex: 1
			},

			// 3. 임베드 형식: https://www.youtube.com/embed/VIDEO_ID
			// nocookie 도메인 포함
			{
				regex: /^https?:\/\/(www\.)?(youtube(-nocookie)?\.com)\/embed\/([\w-]{11})(\?.*)?$/,
				videoIdIndex: 4
			},

			// 4. Shorts 형식: https://www.youtube.com/shorts/VIDEO_ID
			{
				regex: /^https?:\/\/(www\.)?youtube\.com\/shorts\/([\w-]{11})(\?.*)?$/,
				videoIdIndex: 2
			},

			// 5. Live 형식: https://www.youtube.com/live/VIDEO_ID
			{
				regex: /^https?:\/\/(www\.)?youtube\.com\/live\/([\w-]{11})(\?.*)?$/,
				videoIdIndex: 2
			},

			// 6. v/ 형식: https://www.youtube.com/v/VIDEO_ID
			{
				regex: /^https?:\/\/(www\.)?youtube\.com\/v\/([\w-]{11})(\?.*)?$/,
				videoIdIndex: 2
			},

			// 7. vi/ 형식: https://www.youtube.com/vi/VIDEO_ID
			{
				regex: /^https?:\/\/(www\.)?youtube\.com\/vi\/([\w-]{11})(\?.*)?$/,
				videoIdIndex: 2
			},

			// 8. 쿼리 중간에 v= 파라미터가 있는 경우
			{
				regex: /^https?:\/\/(www\.|m\.)?youtube\.com\/.*[\?&]v=([\w-]{11}).*$/,
				videoIdIndex: 2
			},
		];

		for (const { regex, videoIdIndex } of patterns) {
			const match = trimmedUrl.match(regex);
			if (match) {
				const videoId = match[videoIdIndex];
				const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
				return {
					isValid: true,
					videoId,
					cleanUrl,
				};
			}
		}

		return {
			isValid: false,
			videoId: null,
			cleanUrl: null,
		};
	} catch (error) {
		console.error('YouTube URL 검증 중 오류:', error);
		return {
			isValid: false,
			videoId: null,
			cleanUrl: null,
		};
	}
};

export const yieldFor = (ms: number): Promise<string> => {
	return new Promise((resolve) => setTimeout(() => resolve('ok'), ms));
};

export const comma = (num: number | string): string => {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const autoHypenPhone = (text: string): string => {
	const str = text.replace(/[^0-9]/g, '');
	return str ? `${str.substring(0, 3)}-${str.substring(3, 7)}-${str.substring(7)}` : '-';
};

export const autoHypenTel = (text: string): string => {
	const str = text.replace(/[^0-9]/g, '');
	if (!str || str.length < 9) return '-';
	if (str.substring(0, 2) === '02') {
		return str.length === 9
			? `${str.substring(0, 2)}-${str.substring(2, 5)}-${str.substring(5)}`
			: `${str.substring(0, 2)}-${str.substring(2, 6)}-${str.substring(6)}`;
	}
	return str.length === 10
		? `${str.substring(0, 3)}-${str.substring(3, 6)}-${str.substring(6)}`
		: `${str.substring(0, 3)}-${str.substring(3, 7)}-${str.substring(7)}`;
};

export const validateFileTypes = (files: File[]): boolean => {
	const allowedExtensions = ['pdf', 'md'];
	// const allowedExtensions = ['pdf', 'csv', 'xls', 'xlsx'];

	for (const file of files) {
		const extension = file.name.split('.').pop()?.toLowerCase();

		if (!allowedExtensions.includes(extension || '')) {
			return false;
		}
	}

	return true;
};
// const requestPreSignedUrls = async (files: File[]) => {
// 	return Promise.all(
// 		files.map((file) => {
// 			return requestPreSignedUrl({ fileName: file.name, fileType: file.type }).then((response) => response);
// 		}),
// 	);
// };

// // Function to upload files to S3 using the PreSigned URLs

// export const uploadToS3Request = async (files: File[]): Promise<any[]> => {
// 	try {
// 		const preSignedUrls = await requestPreSignedUrls(files);

// 		const uploadPromises = preSignedUrls.map((preSignedUrl, index) => {
// 			return fetch(preSignedUrl.url, {
// 				method: 'PUT',
// 				headers: {
// 					'Content-Type': files[index].type,
// 				},
// 				body: files[index],
// 			}).then((response) => {
// 				if (!response.ok) {
// 					const errorText = response.text();
// 					throw new Error(`File upload failed for ${files[index].name}: ${errorText}`);
// 				}
// 				return response;
// 			});
// 		});

// 		//

// 		return Promise.all(uploadPromises);
// 	} catch (error) {
// 		throw error;
// 	}
// };

export const convertTimeToSeconds = (timeString: string) => {
	const [hours, minutes, seconds] = timeString.split(':').map(Number);
	return hours * 3600 + minutes * 60 + seconds;
};

export const getColor = (index: number) => {
	const colors = [
		'rgba(104, 172, 255, 1)',     // 1
		'rgba(87, 215, 238, 1)',      // 2
		'rgba(99, 242, 163, 1)',      // 3
		'rgba(210, 97, 255, 1)',      // 4
		'rgba(115, 111, 255, 1)',     // 5
		'rgba(247, 220, 111, 1)',     // 6 - yellow
		'rgba(187, 143, 206, 1)',     // 7 - purple
		'rgba(133, 193, 226, 1)',     // 8 - sky blue
		'rgba(248, 184, 139, 1)',     // 9 - light orange
		'rgba(171, 235, 198, 1)',     // 10 - light green
	];
	return colors[index] || 'red';
};

export const getPinImage = (index: number) => {
	const images = [
		ico_pin1, ico_pin2, ico_pin3, ico_pin4, ico_pin5,
		ico_pin1, ico_pin2, ico_pin3, ico_pin4, ico_pin5  // 6-10은 1-5 재사용
	];
	return images[index] || ico_pin1;
};

/**
 * GCS에서 파일을 다운로드합니다 (fetch를 사용하여 실제 파일 다운로드)
 * @param items - URL만 전달하거나, {url, filename} 객체 배열 전달 가능
 */
export const downloadFromGCP = async (items: string[] | { url: string; filename: string }[]) => {
	for (const item of items) {
		try {
			const url = typeof item === 'string' ? item : item.url;
			let filename: string;

			if (typeof item === 'string') {
				// 기존 방식: URL에서 파일명 추출
				const decodedUrl = decodeURIComponent(url);
				const urlPath = decodedUrl.split('?')[0]; // 쿼리 파라미터 제거
				filename = urlPath.substring(urlPath.lastIndexOf('/') + 1);
			} else {
				// 새 방식: 명시적으로 전달받은 파일명 사용
				filename = item.filename;
			}

			console.log('Downloading:', filename);

			// fetch를 사용하여 실제 파일 다운로드
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
			}

			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);

			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = filename;

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			// Blob URL 메모리 해제
			URL.revokeObjectURL(blobUrl);

			await yieldFor(1000); // 다음 다운로드 전 1초 대기
		} catch (error) {
			console.error(`Failed to download:`, error);
		}
	}
};

export function escapeCSVField(field: any) {
	// 문자열로 변환 (null이나 undefined 방어)
	field = String(field);

	// 큰따옴표가 있으면 이스케이프 처리
	if (field.includes('"')) {
		field = field.replace(/"/g, '""');
	}

	// 쉼표, 개행, 혹은 큰따옴표가 포함되어 있으면 큰따옴표로 감싼다.
	if (field.includes(',') || field.includes('\n') || field.includes('\r') || field.includes('"')) {
		field = `"${field}"`;
	}
	return field;
}

export function convertToCSV(target: any, type = 'summary') {
	return target
		.map((item: any) => {
			const summary = escapeCSVField(item.summary);
			return `${item.start_time} ~ ${item.end_time}, ${item.title}, ${summary}`;
		})
		.join('\n');
}

export function downloadAsCSV(data: any, filename: string = 'timeline.csv') {
	const csvContent = convertToCSV(data, 'scripts');
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();

	// 클린업
	document.body.removeChild(link);
	URL.revokeObjectURL(url); // 메모리 누수 방지
}

export function downloadAsXLSX(data: any, filename: string) {
	const wb = XLSX.utils.book_new();

	const excelData = data.map((item: any) => ({
		타임라인: `${item.start_time} ~ ${item.end_time}`,
		'타임라인 별 제목': escapeCSVField(item.title),
		'타임라인 별 스크립트': escapeCSVField(item.scripts),
	}));

	const ws = XLSX.utils.json_to_sheet(excelData);

	// 컬럼 너비 설정
	const colWidths = {
		A: 15, // Time Range
		B: 40, // Title
		C: 90, // Summary
	};

	ws['!cols'] = Object.keys(colWidths).map((key) => ({
		wch: colWidths[key as keyof typeof colWidths],
	}));

	XLSX.utils.book_append_sheet(wb, ws, '타임라인 별 스크립트');
	XLSX.writeFile(wb, filename);
}

//
//

export function validateTimeRanges(timestamp: ISegmentsSchema[], duration: number) {
	const timeRanges = timestamp.map(({ start_time, end_time }) => {
		return {
			start_time: convertTimeToSeconds(start_time),
			end_time: convertTimeToSeconds(end_time),
		};
	});

	for (let i = 0; i < timeRanges.length; i++) {
		const { start_time: original_start_time, end_time: original_end_time } = timestamp[i];
		const { start_time, end_time } = timeRanges[i];

		// 조건 1: start_time은 end_time보다 작아야 함
		if (start_time >= end_time) {
			errorToast(`[${original_start_time} ~ ${original_end_time}]: 시작 시간은 종료 시간보다 작아야 합니다.`);
			return false;
		}

		// 조건 2: 모든 값은 duration보다 작거나 같아야 함
		if (start_time > duration || end_time > duration) {
			errorToast(
				`[${original_start_time} ~ ${original_end_time}]: 시작 시간과 종료 시간은 영상의 길이보다 클 수 없습니다.`,
			);
			return false;
		}

		// 조건 3: 현재 index의 start_time은 이전 index의 end_time보다 크거나 같아야 함 (첫번째 요소 제외)
		if (i > 0 && start_time < timeRanges[i - 1].end_time) {
			errorToast(`[${original_start_time} ~ ${original_end_time}]: 시작 시간은 이전 종료 시간과 같거나 커야 합니다.`);
			return false;
		}
	}

	// 모든 검증을 통과하면 true 리턴
	return true;
}

//
//

// 총 구간(totalSteps) 동안 증가량이 99가 되도록 무작위 가중치를 생성하는 함수
export const generateIncrements = (totalSteps: number, totalIncrement: number) => {
	// 0~1 사이의 난수를 totalSteps개 생성
	const randoms = Array.from({ length: totalSteps }, () => Math.random());
	const total = randoms.reduce((acc, val) => acc + val, 0);

	// 난수의 비율에 따라 99를 분배 (소수점 버림)
	const increments = randoms.map((val) => (val / total) * totalIncrement);
	const floorIncrements = increments.map((val) => Math.floor(val));
	const sumFloors = floorIncrements.reduce((acc, val) => acc + val, 0);

	// 소수점 버림 때문에 부족한 합계를 나머지로 보정
	let remainder = totalIncrement - sumFloors;
	// 증가시킬 구간 인덱스들을 무작위로 섞은 후 앞에서부터 1씩 더함
	const indices = Array.from({ length: totalSteps }, (_, i) => i);
	indices.sort(() => Math.random() - 0.5);
	for (let i = 0; i < remainder; i++) {
		floorIncrements[indices[i]] += 1;
	}

	return floorIncrements;
};

//
//

/**
 * File 객체를 Base64 문자열로 변환합니다
 * @param file - 변환할 File 객체
 * @returns Base64 인코딩된 문자열 (Promise)
 */
export const fileToBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			// data:image/png;base64,iVBORw0KGgoAAAANSUhEUg... 형태에서
			// base64 부분만 추출 (data:image/png;base64, 제거)
			const base64String = reader.result as string;
			const base64Data = base64String.split(',')[1];
			resolve(base64Data);
		};
		reader.onerror = (error) => reject(error);
	});
};

// HTML 엔티티 디코딩 함수
export const decodeHtmlEntities = (text: string): string => {
	if (typeof window === 'undefined') return text;

	const textArea = document.createElement('textarea');
	textArea.innerHTML = text;
	return textArea.value;
};
