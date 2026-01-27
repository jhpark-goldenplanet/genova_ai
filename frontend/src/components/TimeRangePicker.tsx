import React, { FC } from 'react';

import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import TimePicker from 'react-time-picker';

interface Props {
	value: string;
	onChange: (value: string | null) => void;
	onBlur?: (value: string | null) => void;

	minTime?: string;
	maxTime?: string;

	required?: boolean;
}

const TimeRangePicker: FC<Props> = ({ value, onChange, onBlur, minTime = '00:00:00', maxTime, required = true }) => {
	return (
		<CustomTimePicker
			value={value}
			onChange={onChange}
			onBlur={onBlur}
			format="HH:mm:ss"
			disableClock={false}
			clearIcon={null}
			minTime={minTime}
			maxTime={maxTime}
			required={required}
			disabled={false}
			maxDetail="second" // 최대 상세 수준을 초 단위로 설정
		/>
	);
};

export default TimeRangePicker;

const CustomTimePicker = styled(TimePicker)`
	.react-time-picker__wrapper {
		width: ${unit(112)};
		border-radius: ${unit(8)};
		padding: ${unit(5)} ${unit(14)};

		border: 1px solid rgba(114, 115, 126, 1);
		background: white;
	}

	.react-time-picker__inputGroup {
		display: flex;
		align-items: center;
	}

	.react-time-picker__inputGroup__input {
		font-size: ${unit(15.5)} !important;
		font-weight: 400 !important;
		color: rgba(19, 19, 20, 1) !important;

		height: ${unit(24)};
		min-width: 0;
		position: relative;

		outline: none;
		border: none;
		&:focus {
			outline: none;
		}
	}

	.react-time-picker__inputGroup__divider {
		padding: 0 ${unit(3)};
	}

	/*  */
	/*  */

	.react-time-picker__clock {
		display: none;
	}
	.react-time-picker__clear-button {
		display: none;
	}
	.react-time-picker__button {
		display: none;
	}
`;
