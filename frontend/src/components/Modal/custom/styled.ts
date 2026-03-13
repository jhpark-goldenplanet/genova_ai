import styled from '@emotion/styled';
import { munit, unit } from '@/shared/utils/base';
import { Colors, mobilePoint } from '@/styles/globalStyles';
import Image from 'next/image';

export const CommonAlert = styled.article`
	width: min(${unit(420)}, calc(100vw - ${unit(32)}));
	padding: ${unit(24)};
	display: flex;
	flex-direction: column;
	align-items: stretch;
	text-align: left;
	word-break: keep-all;
	background: white;
	border-radius: ${unit(16)};
	overflow: hidden;
	@media screen and (max-width: ${mobilePoint}) {
		padding: ${munit(24)};
	}
`;

// !FIXME <Image /> 태그 주의
export const ModalIcon = styled(Image)`
	width: ${unit(60)};
	height: ${unit(60)};
	margin-bottom: ${unit(30)};
	@media screen and (max-width: ${mobilePoint}) {
		width: ${munit(60)};
		height: ${munit(60)};
		margin-bottom: ${munit(10)};
	}
`;

export const ModalDescription = styled.p`
	color: rgba(86, 102, 128, 1);
	font-size: ${unit(14)};
	font-weight: 600;
	line-height: ${unit(22)};
	@media screen and (max-width: ${mobilePoint}) {
		font-size: ${munit(14)};
		font-weight: 500;
		line-height: 1.6;
		letter-spacing: -${munit(0.3)};
	}
`;

export const ModalButtonWrapper = styled.div<{ $isConfirm?: boolean }>`
	display: flex;
	flex-direction: row;
	gap: ${unit(10)};
	justify-content: flex-end;
	align-items: center;
	margin-top: ${unit(18)};
	@media screen and (max-width: ${mobilePoint}) {
		gap: ${munit(8)};
		margin-top: ${munit(18)};
	}

	button {
		min-width: ${unit(78)};
		padding: ${unit(10)} ${unit(16)};
		border-radius: ${unit(8)};
		border: none;

		font-size: ${unit(14)};
		line-height: ${unit(14)};
		letter-spacing: -0.4%;
		font-weight: 700;

		display: flex;
		justify-content: center;
		align-items: center;
		cursor: pointer;
		transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;

		@media screen and (max-width: ${mobilePoint}) {
			width: auto;
			min-width: ${munit(78)};
			height: ${munit(42)};
			border-radius: ${munit(8)};

			font-size: ${munit(14)};
			letter-spacing: ${munit(-0.3)};
		}

		&.secondary {
			border: 1px solid rgba(202, 215, 236, 1);
			background: rgba(246, 248, 252, 1);
			color: rgba(53, 74, 112, 1);

			&:hover {
				background: rgba(239, 244, 251, 1);
				border-color: rgba(186, 203, 232, 1);
				box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.22);
			}
		}

		&.primary {
			background: rgba(41, 85, 168, 1);
			color: white;

			&:hover {
				background: rgba(49, 95, 183, 1);
				box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.22);
			}
		}
	}
`;
