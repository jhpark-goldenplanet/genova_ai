class SessionAuth {
	private sessionToken: string | null = null;

	constructor() {
		this.sessionToken = this.getStoredToken();
	}

	private getStoredToken(): string | null {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('sessionToken');
		}
		return null;
	}

	private storeToken(token: string): void {
		if (typeof window !== 'undefined') {
			this.sessionToken = token;
			localStorage.setItem('sessionToken', token);
		}
	}

	private clearToken(): void {
		if (typeof window !== 'undefined') {
			this.sessionToken = null;
			localStorage.removeItem('sessionToken');
		}
	}

	public getAuthHeaders(): HeadersInit {
		const headers: HeadersInit = {
			'Content-Type': 'application/json;charset=UTF-8',
		};

		if (this.sessionToken) {
			headers['Authorization'] = `Bearer ${this.sessionToken}`;
		}

		return headers;
	}

	public getFormAuthHeaders(): HeadersInit {
		const headers: HeadersInit = {};

		if (this.sessionToken) {
			headers['Authorization'] = `Bearer ${this.sessionToken}`;
		}

		return headers;
	}

	public async extractAndStoreSessionToken(response: Response): Promise<any> {
		const data = await response.json();

		if (data?.sessionToken) {
			this.storeToken(data.sessionToken);
		} else if (data?.token) {
			this.storeToken(data.token);
		} else if (data?.session_token) {
			this.storeToken(data.session_token);
		} else if (data?.accessToken) {
			this.storeToken(data.accessToken);
		}

		return data;
	}

	public handleAuthError(): void {
		this.clearToken();
		throw new Error('Session expired');
	}

	public hasToken(): boolean {
		return !!this.sessionToken;
	}
}

export const sessionAuth = new SessionAuth();