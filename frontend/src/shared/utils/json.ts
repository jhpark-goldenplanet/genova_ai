import { isEmpty } from 'lodash-es';

export const safeJsonParse = (str: string, defaultValue = {}, context = 'json'): any => {
	try {
		if (isEmpty(str)) return defaultValue;
		return JSON.parse(str);
	} catch (e) {
		console.warn(`Json Parsing Error: ${context}`, e);
		return defaultValue;
	}
};
