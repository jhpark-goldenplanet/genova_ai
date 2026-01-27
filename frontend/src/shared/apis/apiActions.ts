import { forEach, isEmpty, isNil } from 'lodash-es';

const baseURL = process.env.NEXT_PUBLIC_API_URL;

//
//

export const getRequest = async (url: string, params?: any): Promise<any> => {
	try {
		const apiUrl = `${baseURL}/${url}`;
		const queryParams = params ? `?${new URLSearchParams(params).toString()}` : '';
		const response = await fetch(`${apiUrl}${queryParams}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
			},
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error(`[GET Error] ${url}`, errorData);
			throw new Error(errorData.error || `Status code: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error(`[GET Exception] ${url}`, error);
		throw error;
	}
};

//
//

export const postRequest = async (url: string, params?: any): Promise<any> => {
	try {
		const response = await fetch(`${baseURL}/${url}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
				'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
			},
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error(`[POST Error] ${url}`, errorData);
			throw errorData; // 전체 에러 데이터를 throw (error_code 포함)
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error(`[POST Exception] ${url}`, error);
		throw error;
	}
};

//

export const postFormRequest = async (url: string, payload?: any): Promise<any> => {
	const formData = new FormData();

	forEach(payload, (value, key) => {
		if (isNil(value)) {
			return;
		}

		if (value instanceof File) {
			//! 멀티 파일은 적용이 안된다!!!
			formData.append(key, value);
			return;
		}

		if (typeof value === 'object') {
			formData.append(key, JSON.stringify(value));
			return;
		}

		formData.append(key, value.toString());

		//! Array는 처리하지 않음 추후 추가하자!
	});

	try {
		const response = await fetch(`${baseURL}/${url}`, {
			method: 'POST',
			headers: {
				'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
			},
			body: formData,
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error(`[POST FormData Error] ${url}`, errorData);
			throw errorData; // 전체 에러 데이터를 throw (error_code 포함)
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error(`[POST FormData Exception] ${url}`, error);
		throw error;
	}
};

//
//
//

export const putRequest = async (url: string, params?: any): Promise<any> => {
	try {
		const response = await fetch(`${baseURL}/${url}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
				'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
			},
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || `Status code: ${response.status}`);
		}
		return response.json();
	} catch (error) {
		throw error;
	}
};

export const deleteRequest = async (url: string, params?: any): Promise<any> => {
	try {
		const queryParams = params ? `?${new URLSearchParams(params).toString()}` : '';
		const response = await fetch(`${baseURL}/${url}${queryParams}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
				'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
			},
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || `Status code: ${response.status}`);
		}
		return response.json();
	} catch (error) {
		throw error;
	}
};

//
//
//
//
