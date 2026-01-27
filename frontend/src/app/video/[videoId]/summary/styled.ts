import { getColor, unit } from '@/shared/utils/base';
import { often } from '@/styles/globalStyles';
import styled from '@emotion/styled';

// const DASHBOARD_HEIGHT = unit(1066);
const DASHBOARD_HEIGHT = unit(884);

const DASHBOARD_GAP = unit(10);

export const SkeletonBlank = styled.figure`
	height: ${unit(12)};
`;

export const Main = styled.main``;

export const DashboardContainer = styled.section<{ isReady: boolean }>`
	display: flex;
	flex-direction: row;
	gap: ${DASHBOARD_GAP};

	min-height: ${({ isReady }) => (isReady ? DASHBOARD_HEIGHT : unit(880))};

	margin-bottom: ${DASHBOARD_GAP};
	/* background: red; */
`;

export const DashboardLeft = styled.section`
	display: flex;
	flex-direction: column;
	gap: ${DASHBOARD_GAP};
	width: calc((100% - ${DASHBOARD_GAP}) * 0.715);
`;

export const VideoWrapper = styled.article`
	width: 100%;
	aspect-ratio: 16 / 9;

	position: relative;
`;

export const LoaderContainer = styled.div`
	${often.centerXY};

	display: flex;
	flex-direction: column;

	align-items: center;

	.percentage {
		color: rgba(75, 137, 212, 1);

		font-size: ${unit(30)};
		font-weight: 700;
		line-height: ${unit(28.5)};

		margin-top: ${unit(30 - 8)};
		margin-bottom: ${unit(18)};

		/* margin-top: ${unit(-8)};
		margin-bottom: ${unit(0)}; */

		text-align: center;
		position: relative;
		left: ${unit(6)};
	}

	h3 {
		font-size: ${unit(20)};
		font-weight: 600;
		line-height: ${unit(25)};

		color: rgba(19, 19, 20, 1);

		margin-bottom: ${unit(2)};
	}

	p {
		font-size: ${unit(16)};
		font-weight: 400;
		line-height: ${unit(26)};

		color: rgba(19, 19, 20, 1);
		margin-bottom: ${unit(26)};
	}

	button {
		width: ${unit(130)};
		height: ${unit(40)};

		display: flex;
		justify-content: center;
		align-items: center;

		border-radius: ${unit(8)};
		background-color: rgba(26, 43, 89, 1);

		color: white;
		font-size: ${unit(15)};
		font-weight: 700;
		letter-spacing: -0.4%;
	}
`;

//

export const TimelineTopicWrapper = styled.article`
	width: 100%;
	height: 100%;

	border-radius: ${unit(8)};
	padding: ${unit(24)};

	border: solid 1px rgba(185, 194, 205, 1);

	h1 {
		font-size: ${unit(20)};
		font-weight: 700;
		color: rgba(19, 19, 20, 1);

		line-height: ${unit(30)};
		margin-bottom: ${unit(16)};
	}

	ul {
		width: 100%;
		position: relative;

		li {
			display: flex;
			flex-direction: row;
			align-items: center;
			padding: ${unit(17)} ${unit(28)};
			background-color: white;

			cursor: pointer;

			&:nth-of-type(odd) {
				background-color: rgba(249, 250, 251, 1);
			}

			&:hover {
				background: rgba(75, 137, 212, 0.1);
			}
		}

		li.normal {
			div.timebox {
				color: rgba(114, 115, 126, 1);
				font-size: ${unit(16)};
				font-weight: 400;

				width: ${unit(140)};

				display: flex;
				flex-direction: row;
				align-items: center;
				gap: ${unit(6)};
			}

			span {
				&.time-text {
					width: ${unit(59)};
				}
				&.time-wave {
					width: ${unit(10)};
					text-align: center;
				}
			}

			h3 {
				font-size: ${unit(18)};
				font-weight: 600;
				color: rgba(19, 19, 20, 1);
				margin-left: ${unit(40)};
				flex: 1;
				word-break: break-all;
				overflow-wrap: anywhere;
				white-space: normal;
				max-width: 100%;
				/* text-decoration: underline; */
			}
		}

		/*  */
		/*  */
		/*  */

		li.skeleton {
			gap: ${unit(24)};

			p {
				color: rgba(19, 19, 20, 1);
				font-size: ${unit(16)};
				font-weight: 600;
				line-height: ${unit(30)};
			}
		}
	}
`;

export const TimelineLine = styled.figure<{ index: number; total: number }>`
	position: absolute;
	left: 0;
	width: 1px;
	height: calc(100% / ${(props) => props.total});
	top: calc((100% / ${(props) => props.total}) * ${(props) => props.index});
	background: ${(props) => getColor(props.index)};
`;

//

export const TimelineSummaryWrapper = styled.article<{ isReady: boolean; selectedIndex: number; maxIndex: number }>`
	width: calc((100% - ${DASHBOARD_GAP}) * 0.285);
	min-height: ${({ isReady }) => (isReady ? DASHBOARD_HEIGHT : unit(880))};
	height: 100%;
	border-radius: ${unit(8)};

	background-color: rgba(249, 250, 251, 1);

	padding: ${unit(24)};
	padding-bottom: ${unit(42)};

	border: solid 1px rgba(185, 194, 205, 1);

	.header-section {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;

		margin-bottom: ${unit(22)};

		.page-button {
			display: flex;
			flex-direction: row;

			img {
				cursor: pointer;
				width: ${unit(22)};
				height: ${unit(22)};
				&:nth-of-type(1) {
					opacity: ${(props) => (props.selectedIndex === 0 ? 0.3 : 1)};
				}
				&:nth-of-type(2) {
					opacity: ${(props) => (props.selectedIndex === props.maxIndex ? 0.3 : 1)};
				}
			}
		}
	}

	h1 {
		font-size: ${unit(20)};
		font-weight: 700;
		color: rgba(19, 19, 20, 1);
	}
`;

export const TimelineSummaryBox = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
	font-size: ${unit(16)};
	line-height: ${unit(24)};
	font-weight: 400;

	/*  */

	span {
		color: rgba(114, 115, 126, 1);
		word-break: break-all;
		overflow-wrap: anywhere;
	}

	p {
		color: rgba(19, 19, 20, 1);
		word-break: break-all;
		overflow-wrap: anywhere;
		white-space: normal;
		/* margin-top: ${unit(2)}; */
	}
`;

export const TimelineSummaryH3 = styled.h3`
	color: rgba(19, 19, 20, 1);
	font-size: ${unit(18)};
	font-weight: 600;
	line-height: ${unit(28)};
	word-break: break-all;
	overflow-wrap: anywhere;
	white-space: normal;
`;

export const Divider = styled.figure`
	width: 100%;
	height: 1px;
	background: rgba(222, 229, 237, 1);

	margin: ${unit(20)} 0;
`;

export const TimelineSummaryKeyword = styled.div`
	color: rgba(26, 43, 89, 1);
	font-size: ${unit(16)};
	font-weight: 600;
	line-height: ${unit(24)};

	margin-top: ${unit(10)};

	display: flex;
	flex-wrap: wrap;
	width: 100%;
	gap: ${unit(2)} ${unit(3)};

	span {
		white-space: normal;
		word-break: keep-all;
	}
`;

//
//
//
//

export const TotalSummaryWrapper = styled.article`
	width: 100%;
	padding: ${unit(30)};
	border-radius: ${unit(8)};
	background-color: rgba(222, 229, 237, 0.5);

	border: solid 1px rgba(185, 194, 205, 1);
	margin-bottom: ${DASHBOARD_GAP};

	.header-section {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: ${unit(10)};
		margin-bottom: ${unit(16)};

		h1 {
			font-size: ${unit(20)};
			font-weight: 700;
			color: rgba(19, 19, 20, 1);
		}

		img {
			cursor: pointer;
			width: ${unit(22)};
			height: ${unit(22)};
		}
	}

	p {
		font-size: ${unit(16)};
		font-weight: 400;
		line-height: ${unit(26)};
		color: rgba(19, 19, 20, 1);

		margin-bottom: ${unit(40)};
	}

	h3 {
		font-size: ${unit(18)};
		font-weight: 600;
		color: rgba(19, 19, 20, 1);
	}

	h5 {
		font-size: ${unit(16)};
		font-weight: 600;
		line-height: ${unit(26)};
		color: rgba(26, 43, 89, 1);
	}
`;

export const TotalTimelineSummaryWrapper = styled.article`
	width: 100%;
	padding: ${unit(30)};

	border-radius: ${unit(8)};

	background-color: white;
	border: solid 1px rgba(185, 194, 205, 1);

	.header-section {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: ${unit(10)};
		margin-bottom: ${unit(20)};

		h1 {
			font-size: ${unit(20)};
			font-weight: 700;
			color: rgba(19, 19, 20, 1);
		}

		img {
			cursor: pointer;
			width: ${unit(22)};
			height: ${unit(22)};
		}
	}
`;

export const TotalTimelineSummaryUL = styled.ul`
	width: 100%;
	position: relative;

	li {
		display: flex;
		flex-direction: row;
		gap: ${unit(30)};

		padding: ${unit(22)} ${unit(20)} ${unit(22)} ${unit(30)};
		background-color: white;
		min-height: ${unit(140)};

		&:nth-of-type(odd) {
			background-color: rgba(249, 250, 251, 1);
		}

		/*  */
		/*  */

		div.left-section {
			display: flex;
			flex-direction: column;

			flex: 1;

			h3 {
				font-size: ${unit(18)};
				line-height: ${unit(24)};
				font-weight: 600;
				color: rgba(19, 19, 20, 1);
				word-break: break-all;
				overflow-wrap: anywhere;
				white-space: normal;
			}

			span {
				font-size: ${unit(16)};
				font-weight: 400;
				line-height: ${unit(22)};
				color: rgba(114, 115, 126, 1);
				margin-bottom: ${unit(4)};
				word-break: break-all;
				overflow-wrap: anywhere;
			}
		}

		p {
			font-size: ${unit(16)};
			font-weight: 400;
			line-height: ${unit(24)};
			color: rgba(19, 19, 20, 1);

			flex: 1;
			word-break: break-all;
			overflow-wrap: anywhere;
			white-space: normal;
		}
	}
`;
