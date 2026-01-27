import styled from '@emotion/styled';
import { unit, munit } from '@/shared/utils/base';
import { mobilePoint } from '@/styles/globalStyles';

export const ButtonWrapper = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	margin-bottom: ${unit(40)};

	@media screen and (max-width: ${mobilePoint}) {
		margin-bottom: ${munit(35)};
	}

	button {
		width: ${unit(150)};
		height: ${unit(50)};
		border-radius: ${unit(8)};

		display: flex;
		justify-content: center;
		align-items: center;

		font-size: ${unit(16)};
		color: white;
	}
`;

//

export const CloseWrapper = styled.div`
	position: absolute;
	top: 0;
	right: 0;

	background-color: white;
	width: 100%;
	height: ${unit(24 + 8)};

	display: flex;
	justify-content: flex-end;
	align-items: flex-end;
	padding-right: ${unit(8)};
	z-index: 999;
	border-radius: ${unit(8)};
	@media screen and (max-width: ${mobilePoint}) {
		height: ${munit(18 + 15)};
		padding-right: ${munit(15)};
		border-radius: ${munit(8)};
	}
	img {
		width: ${unit(24)};
		height: ${unit(24)};
		cursor: pointer;

		@media screen and (max-width: ${mobilePoint}) {
			width: ${munit(18)};
			height: ${munit(18)};
		}
	}
`;

export const ModalBlank = styled.figure`
	height: ${unit(24 + 8)};
	@media screen and (max-width: ${mobilePoint}) {
		height: ${munit(16)};
	}
`;
