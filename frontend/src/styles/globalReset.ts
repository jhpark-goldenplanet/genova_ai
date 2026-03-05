import { css } from '@emotion/react';
import { munit, unit } from '@/shared/utils/base';
import { Colors, mobilePoint } from './globalStyles';

const globalStyles = css`
	a,
	a:link,
	a:visited {
		text-decoration: none;
		color: #000;
	}
	html,
	body {
		overflow: initial !important;
		overflow-x: hidden;
		@media screen and (max-width: 1240px) {
			font-size: 0.85rem;
		}

		@media screen and (max-width: 1024px) {
			font-size: 0.82rem;
		}

		@media screen and (max-width: 1000px) {
			font-size: 0.75rem;
		}

		@media screen and (max-width: 920px) {
			font-size: 0.7rem;
		}

		@media screen and (max-width: 860px) {
			font-size: 0.65rem;
		}

		@media screen and (max-width: 800px) {
			font-size: 0.63rem;
		}

		/* @media screen and (max-width: ${mobilePoint}) {
			font-size: 1rem;
		} */

		.ReactModal__Body--open,
		.ReactModal__Html--open {
			/* 모달 열렸을 때 스크롤 되지 않도록 수정 */
			overflow: hidden !important;
		}
	}

	/* ReactModal에서 열렸을 때 body/html에 직접 붙는 클래스 */
	body.ReactModal__Body--open {
		overflow: hidden !important;
	}
	html.ReactModal__Html--open {
		overflow: hidden !important;
	}

	body {
		-ms-overflow-style: none;

		.Overlay {
			background-color: rgba(0, 0, 0, 0.5);
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			display: flex;
			justify-content: center;
			align-items: center;
			z-index: 1000;
		}

		.FreeOverlay {
			z-index: 900;
		}

		.Modal {
			background-color: white;
			min-width: ${unit(280)};
			min-height: ${unit(150)};
			border-radius: ${unit(8)};
			border: none;
			inset: 0;
			box-shadow: 0px ${unit(8)} ${unit(16)} 0px rgba(0, 0, 0, 0.1);
			border: 1px solid rgba(245, 245, 245, 1);

			position: relative;
			display: flex;
			flex-direction: column;

			padding: 0;
			white-space: pre-wrap;
			z-index: 1100;

			overflow: hidden;

			/* align-items: center; */
			/* text-align: center; */
			/* padding: ${unit(30)} ${unit(55)} ${unit(50)}; */

			@media screen and (max-width: ${mobilePoint}) {
				width: ${munit(320)};
				min-width: ${munit(320)};
				/* min-height: ${munit(240)}; */
				border-radius: ${munit(8)};
				box-shadow: 0 0 ${munit(30)} 0 rgba(0, 0, 0, 0.05);
			}
		}

		.FreeModal {
			z-index: 990;
		}
	}

	*::-webkit-scrollbar {
		display: none; /* Chrome, Safari, Opera*/
	}
	* {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
		box-sizing: border-box;
		font-family: 'Pretendard';
		white-space: pre-wrap;
		margin: 0;
		padding: 0;
		word-break: keep-all;
		user-select: none;
		-webkit-user-select: none;
		/* color: #111; */
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0);
	}
	li {
		list-style: none;
	}

	button {
		user-select: none;
		color: black;
		background: none;
		border: none;
		&:focus {
			outline: none;
		}
		&:hover {
			cursor: pointer;
		}
	}
	*:focus {
		outline: none;
	}

	input:not([type='radio']) {
		outline: none;
		-webkit-appearance: none;
		appearance: none;
		-webkit-border-radius: 0;
		border-radius: 0;
	}

	input:not([type='radio']),
	textarea {
		-webkit-appearance: none;
		appearance: none;
		-moz-user-select: auto !important;
		-webkit-user-select: auto !important;
		-ms-user-select: auto !important;
		user-select: auto !important;

		overflow-y: auto;
		resize: none;

		&::placeholder {
			color: #ccc;
		}
	}

	input[type='radio'] {
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		margin: 0;
		width: ${unit(22)};
		height: ${unit(22)};
		border: 1px solid rgb(223, 229, 239);
		border-radius: 50%;
		cursor: pointer;
		background-color: #ffffff;
		position: relative;

		&:checked {
			background-color: ${Colors.primary};
			border-color: ${Colors.primary};
		}

		&:checked::after {
			content: '';
			display: block;
			position: absolute;
			top: 50%;
			left: 50%;
			width: ${unit(8)};
			height: ${unit(8)};
			border-radius: 50%;
			margin-top: ${unit(-4)};
			margin-left: ${unit(-4)};
			background-color: white;
		}

		&:focus {
			outline: none !important;
		}

		&:focus::after {
			content: '';
			display: block;
			position: absolute;
			top: ${unit(3.5)};
			left: ${unit(3.5)};
			width: ${unit(8)};
			height: ${unit(8)};
			border-radius: 50%;
			border: ${unit(6.5)} solid ${Colors.primary};
		}
	}

	select {
		position: relative;
		background-image: url('/images/select_image.png') !important;
		background-position: right ${unit(14)} center;
		background-repeat: no-repeat;
		background-color: #fff;
		padding-right: ${unit(14)} !important;
		outline: none;
		-moz-appearance: none !important;
		appearance: none !important;
		-webkit-appearance: none !important;
		background-size: ${unit(11)} auto;

		/* select 플레이스홀더 적용 */
		&:required:invalid {
			color: #c3c7cc;
		}
		option[value=''][disabled] {
			display: none;
		}
		option {
			color: black;
		}

		@media screen and (max-width: ${mobilePoint}) {
			background-position: right ${munit(10)} center;
		}
	}
	button:disabled {
		&:hover {
			cursor: unset;
		}
	}
	button:not(:disabled):active {
		transform: scale(0.98);
	}

	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active {
		transition: background-color 5000s;
		-webkit-text-fill-color: #333;
	}

	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
	}
	/* 파이어폭스에서의 초기화 방법 */
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	input:read-only:focus {
		border-color: #e8e8e8;
	}
	input {
		transition: 0.2s;
	}

	.pcBlock {
		display: block !important;
		@media screen and (max-width: ${mobilePoint}) {
			display: none !important;
		}
	}
	.pcFlex {
		display: flex !important;
		@media screen and (max-width: ${mobilePoint}) {
			display: none !important;
		}
	}
	.mBlock {
		display: none !important;
		@media screen and (max-width: ${mobilePoint}) {
			display: block !important;
		}
	}
	.mFlex {
		display: none !important;
		@media screen and (max-width: ${mobilePoint}) {
			display: flex !important;
		}
	}
`;

export default globalStyles;
