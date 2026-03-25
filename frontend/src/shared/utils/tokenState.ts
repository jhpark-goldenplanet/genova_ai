/**
 * localStorage 기반 토큰 상태 통합 관리
 * 3개 페이지(구독 관리, 회원 관리, 분석 설정)에서 일관된 토큰 데이터를 표시한다.
 * 백엔드 API 준비 후 API 응답으로 교체 예정.
 */

const TOKEN_STATE_KEY = 'genova_token_state_v1';

type AnalysisTrack = 'STANDARD' | 'PREMIUM';

export interface TokenState {
	org: {
		monthlyLimit: number;
		resetDate: string;
		plan: string;
	};
	usage: {
		orgTotal: number;
		byMember: Record<string, number>;
	};
	history: {
		analysisId: string;
		track: AnalysisTrack;
		estimatedTokens: number;
		createdAt: string;
	}[];
}

const DEFAULT_TOKEN_STATE: TokenState = {
	org: {
		monthlyLimit: 6_000_000,
		resetDate: '2026-04-01',
		plan: 'Plus',
	},
	usage: {
		orgTotal: 1_720_000,
		byMember: {
			'gp_hklee': 1_200_000,
			'njw_admin': 520_000,
		},
	},
	history: [],
};

export const readTokenState = (): TokenState => {
	if (typeof window === 'undefined') return DEFAULT_TOKEN_STATE;
	try {
		const raw = window.localStorage.getItem(TOKEN_STATE_KEY);
		if (!raw) {
			window.localStorage.setItem(TOKEN_STATE_KEY, JSON.stringify(DEFAULT_TOKEN_STATE));
			return DEFAULT_TOKEN_STATE;
		}
		return JSON.parse(raw) as TokenState;
	} catch {
		return DEFAULT_TOKEN_STATE;
	}
};

export const writeTokenState = (state: TokenState): void => {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(TOKEN_STATE_KEY, JSON.stringify(state));
};

/** 조직 잔여 토큰 */
export const getRemaining = (state: TokenState): number =>
	Math.max(0, state.org.monthlyLimit - state.usage.orgTotal);

/** 특정 멤버 사용량 */
export const getMemberUsage = (state: TokenState, userId: string): number =>
	state.usage.byMember[userId] ?? 0;

/** 분석 시작 시 토큰 차감 + history 기록 */
export const deductTokens = (
	userId: string,
	analysisId: string,
	track: AnalysisTrack,
	estimatedTokens: number,
): TokenState => {
	const state = readTokenState();
	state.usage.orgTotal += estimatedTokens;
	state.usage.byMember[userId] = (state.usage.byMember[userId] ?? 0) + estimatedTokens;
	state.history.push({
		analysisId,
		track,
		estimatedTokens,
		createdAt: new Date().toISOString(),
	});
	writeTokenState(state);
	return state;
};
