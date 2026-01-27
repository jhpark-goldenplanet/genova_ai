import styled from '@emotion/styled';
import { munit, unit } from '@/shared/utils/base';
import { Colors, mobilePoint } from '@/styles/globalStyles';
import Image from 'next/image';

export const CommonAlert = styled.article`
	padding: ${unit(40)};
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	word-break: keep-all;
	@media screen and (max-width: ${mobilePoint}) {
		padding: ${munit(30)} ${munit(20)} ${munit(30)};
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
	color: rgba(19, 19, 20, 1);
	font-size: ${unit(18)};
	font-weight: 600;
	line-height: ${unit(28)};
	@media screen and (max-width: ${mobilePoint}) {
		font-size: ${munit(15)};
		font-weight: 500;
		line-height: 1.6;
		letter-spacing: -${munit(0.3)};
	}
`;

export const ModalButtonWrapper = styled.div<{ $isConfirm?: boolean }>`
	display: flex;
	flex-direction: row;
	gap: ${unit(10)};

	justify-content: center;
	align-items: center;
	margin-top: ${unit(30)};
	@media screen and (max-width: ${mobilePoint}) {
		gap: ${munit(8)};
		margin-top: ${munit(30)};
	}

	button {
		padding: ${unit(12)} ${unit(30)};
		border-radius: ${unit(8)};
		border: none;

		font-size: ${unit(16)};
		line-height: ${unit(16)};
		letter-spacing: -0.4%;
		font-weight: 600;
		color: white;

		display: flex;
		justify-content: center;
		align-items: center;

		@media screen and (max-width: ${mobilePoint}) {
			width: ${({ $isConfirm }) => ($isConfirm ? munit(136) : munit(280))};
			height: ${munit(50)};
			border-radius: ${munit(8)};

			font-size: ${munit(15)};
			letter-spacing: ${munit(-0.3)};
		}
	}
`;
