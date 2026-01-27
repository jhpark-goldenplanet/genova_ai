import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import { isNil } from 'lodash-es';

dayjs.extend(utc);

export const getYmd = (target?: Date | string | null, format?: string): string => {
	if (isNil(target) || target === '') return dayjs(new Date()).format('YYYY-MM-DD');
	return dayjs(target).format(format ?? 'YYYY-MM-DD');
};

export const getYmdUTC9 = (target?: Date | string | null, format?: string): string => {
	if (isNil(target) || target === '') return '';
	return dayjs(target)
		.utcOffset(9)
		.format(format ?? 'YYYY-MM-DD');
};

const days = ['일', '월', '화', '수', '목', '금', '토'];
export const getYoil = (target?: Date) => {
	return days[dayjs(target).day()];
};

export const converToMinSec = (target: number) => {
	return dayjs.utc(target * 1000).format('mm:ss');
};

export const converToTimerFormat = (target: number) => {
	return dayjs.utc(target * 1000).format('mm:ss');
};
