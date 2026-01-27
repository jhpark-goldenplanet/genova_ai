import { css, SerializedStyles } from '@emotion/react';
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { StringKeyAndVal } from '@/typings/base';

// 웹 색상표
export const Colors: StringKeyAndVal = {
	blue: '#4477b2',
	green: '#3b8d6e',
	grayButton: '#888f9a',
	fail: '#FF6C6C', //! FIXME 임시값

	navyBlack: 'rgb(42, 53, 71)',

	//
	//

	primary: 'rgba(26, 43, 89, 1)',
	secondary: 'rgb(73, 190, 255)',
	third: '#243461',
	success: 'rgb(17, 223, 185)',
	warning: 'rgb(255, 175, 32)',

	danger: '#ff0000',
	disabled: 'rgb(236, 242, 255)',
};

const bttonStatusCSS: any = {
	primary: css`
		background-color: ${Colors.primary};
		border: 1px solid transparent;
		color: #fff;
	`,

	primary_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.primary};
		color: ${Colors.primary};
	`,

	secondary: css`
		background-color: ${Colors.secondary};
		border: 1px solid transparent;
		color: #fff;
	`,

	secondary_outlined: css`
		background-color: transparent;
		border: 1px solid ${Colors.secondary};
		color: ${Colors.secondary};
	`,

	disabled: css`
		background-color: ${Colors.disabled};
		border: 1px solid transparent;
		color: #c3c7cc;

		&:hover {
			cursor: default;
		}
	`,
};

export const point = 1025;
export const mobilePoint = `${point}px`;

export const onlyPC = (query: string): any => {
	const spot = Number(mobilePoint.replace('px', '')) + 1;
	return css`
		@media screen and (min-width: ${spot}px) {
			${query}
		}
	`;
};

// 중복, 자주 사용
export const often = {
	centerX: css`
		position: absolute;
		transform: translateX(-50%);
		left: 50%;
	`,
	centerY: css`
		position: absolute;
		transform: translateY(-50%);
		top: 50%;
	`,
	centerXY: css`
		position: absolute;
		transform: translate(-50%, -50%);
		top: 50%;
		left: 50%;
	`,
};

export const backgroundImageCover = css`
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
`;

export const numberOfLines = (lineLength: number): SerializedStyles => css`
	overflow: hidden;
	text-overflow: ellipsis;
	line-clamp: ${lineLength};
	-webkit-line-clamp: ${lineLength};
	display: -webkit-box;
	-webkit-box-orient: vertical;
`;

export const LeftIcon = css`
	content: '';
	${backgroundImageCover}
	${often.centerY}
	left: 0;
`;

export const flexRow = css`
	display: flex;
	flex-direction: row;
	align-items: center;
`;

export const flexRowCenter = css`
	${flexRow}
	justify-content: center;
`;

export const flexRowBetween = css`
	${flexRow}
	justify-content: space-between;
`;

//
//
//

export const MarkdownP = styled.p`
	font-weight: 500;
`;

export const MarkdownPre = styled.pre`
	background-color: rgb(40, 44, 52);
	color: rgb(171, 178, 191);
	font-weight: 400;
	padding: ${unit(12)};
	border-radius: ${unit(7)};

	position: relative;
	bottom: ${unit(16)};

	white-space: pre-wrap; /* 줄바꿈 허용 */
	word-wrap: break-word; /* 긴 단어 줄바꿈 */
	overflow-wrap: break-word; /* 모던 브라우저용 줄바꿈 */
	max-width: 100%; /* 부모 요소 너비를 넘지 않도록 설정 */
	overflow-x: auto; /* 가로 스크롤이 필요한 경우에만 표시 */

	code {
		white-space: pre-wrap; /* code 태그에도 동일하게 적용 */
		word-wrap: break-word;
		overflow-wrap: break-word;
		display: block; /* 블록 레벨 요소로 변경 */
		width: 100%; /* 부모 너비에 맞춤 */
	}
`;

export const MarkdownSingleBacktick = styled.code`
	background: rgb(233, 229, 216);
	color: rgb(27, 108, 187);
	padding: ${unit(2)} ${unit(4)};
	border-radius: ${unit(5)};
`;

export const MarkdownOl = styled.ol<{ $start: number }>`
	line-height: 1.2;
`;

export const MarkdownUl = styled.ul`
	line-height: 1.2;
`;

export const MarkdownLi = styled.li`
	line-height: 1.2;
`;

export const MarkdownCodeCustomStyle = {
	paddingTop: unit(20),
	paddingRight: unit(18),
	paddingBottom: unit(24),
	paddingLeft: unit(18),

	borderRadius: unit(7),
};

export const CustomAnchor = styled.span`
	color: #5272f2;
	cursor: pointer;

	&:hover {
		text-decoration: underline;
	}

	&:after {
		content: ' 🔗';
	}
`;
