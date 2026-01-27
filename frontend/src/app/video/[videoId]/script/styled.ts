import { unit } from '@/shared/utils/base';
import { often } from '@/styles/globalStyles';
import styled from '@emotion/styled';

export const Main = styled.main``;

export const TotalTimelineSummaryWrapper = styled.article`
	width: 100%;
	padding: ${unit(30)};

	border-radius: ${unit(8)};

	background-color: white;
	border: solid 1px rgba(185, 194, 205, 1);

	margin-bottom: ${unit(18)};
	position: relative;

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
				line-height: ${unit(26)};
				font-weight: 600;
				color: rgba(19, 19, 20, 1);
			}

			span {
				font-size: ${unit(16)};
				font-weight: 400;
				line-height: ${unit(24)};
				color: rgba(114, 115, 126, 1);
				margin-bottom: ${unit(4)};
			}
		}

		p {
			font-size: ${unit(16)};
			font-weight: 400;
			line-height: ${unit(26)};
			color: rgba(19, 19, 20, 1);

			width: ${unit(800)};
		}
	}
`;

export const DownloadButton = styled.button`
	width: ${unit(128)};
	height: ${unit(45)};
	border-radius: ${unit(8)};
	background-color: rgba(26, 43, 89, 1);

	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	gap: ${unit(8)};

	font-size: ${unit(17)};
	font-weight: 700;
	color: white;

	margin-left: auto;

	img {
		width: ${unit(21)};
		height: ${unit(21)};
	}
`;

export const LoaderContainer = styled.div`
	${often.centerXY};

	/* background-color: red; */

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
