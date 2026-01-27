// styled.ts
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';

// 컨테이너(배경)의 너비/높이
const WRAPPER_WIDTH = 76;
const WRAPPER_HEIGHT = 28;

// 핸들의 너비/높이
const SLIDER_WIDTH = 35;
const SLIDER_HEIGHT = 22;

// 왼쪽/오른쪽으로 띄울 여백(픽셀 단위)
const SLIDER_MARGIN = 3;

export const ToggleWrapper = styled.div`
	position: relative;
	width: ${unit(WRAPPER_WIDTH)};
	height: ${unit(WRAPPER_HEIGHT)};
	background-color: rgba(96, 106, 135, 1);
	border-radius: ${unit(15)};
	cursor: pointer;
	overflow: hidden;
	user-select: none;
`;

export const Slider = styled.figure<{ isChecked: boolean }>`
	position: absolute;
	top: ${unit((WRAPPER_HEIGHT - SLIDER_HEIGHT) / 2)};
	/* isChecked에 따라 left를 고정 픽셀 단위로 바꿔서 정확히 맞춤 */
	left: ${({ isChecked }) =>
		isChecked
			? unit(WRAPPER_WIDTH - SLIDER_WIDTH - SLIDER_MARGIN) // 오른쪽 정렬
			: unit(SLIDER_MARGIN)}; // 왼쪽 정렬

	width: ${unit(SLIDER_WIDTH)};
	height: ${unit(SLIDER_HEIGHT)};
	background-color: #fff;
	border-radius: ${unit(15)};
	transition: left 0.2s ease;
	z-index: 2;

	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: bold;
	color: rgba(96, 106, 135, 1);
`;

export const TextLayer = styled.div<{ isChecked: boolean }>`
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;

	/* 좌/우 텍스트 각각 절반씩 차지하여 중앙 정렬 */
	display: flex;

	.left-text,
	.right-text {
		flex: 1; /* 컨테이너 너비를 좌/우 절반씩 */
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
	}

	/* KO 텍스트 색상 */
	.left-text {
		color: ${({ isChecked }) => (isChecked ? '#fff' : 'rgba(96, 106, 135, 1)')};
	}

	/* EN 텍스트 색상 */
	.right-text {
		color: ${({ isChecked }) => (!isChecked ? '#fff' : 'rgba(96, 106, 135, 1)')};
	}
`;
