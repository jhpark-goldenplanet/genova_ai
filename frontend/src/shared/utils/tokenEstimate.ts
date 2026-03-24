/**
 * 영상 길이 기반 토큰 추정 계산
 *
 * Standard (STT 경로):
 *   - Google STT API 처리: 영상길이(초) × 15 토큰 환산
 *     (Google Cloud STT ~$0.006/15초, Gemini 토큰 단가 기준 환산)
 *   - Gemini 텍스트 분석: 영상길이(분) × 200 (STT 텍스트 평균 토큰/분)
 *   - 고정 프롬프트 오버헤드: 500
 *
 * Premium (영상 전체 분석):
 *   - Gemini 영상 입력: 영상길이(초) × 258 (Gemini 영상 토큰 ~258/초)
 *   - 고정 프롬프트 오버헤드: 500
 *
 * ※ 초기 추정용. 백엔드 토큰 카운트 API 준비 시 교체 예정.
 */

const PROMPT_OVERHEAD = 500;
const STT_API_TOKENS_PER_SECOND = 15; // Google STT API 비용 → 토큰 환산
const STT_TEXT_TOKENS_PER_MINUTE = 200; // STT 결과 텍스트 → Gemini 입력 토큰
const VIDEO_TOKENS_PER_SECOND = 258;

export interface TokenEstimate {
	standard: number;
	standardSttCost: number;
	standardGeminiCost: number;
	premium: number;
}

/**
 * durationLabel (예: "12:34") 파싱 → 총 초
 */
export const parseDurationToSeconds = (durationLabel: string): number => {
	if (!durationLabel || durationLabel === '-') return 0;
	const parts = durationLabel.split(':').map(Number);
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	return 0;
};

/**
 * 영상 길이(초) 기반 두 모드의 토큰 추정량 반환
 */
export const estimateTokens = (durationSeconds: number): TokenEstimate => {
	if (durationSeconds <= 0) return { standard: 0, standardSttCost: 0, standardGeminiCost: 0, premium: 0 };
	const durationMinutes = durationSeconds / 60;
	const sttApiCost = Math.round(durationSeconds * STT_API_TOKENS_PER_SECOND);
	const sttGeminiCost = Math.round(durationMinutes * STT_TEXT_TOKENS_PER_MINUTE + PROMPT_OVERHEAD);
	return {
		standardSttCost: sttApiCost,
		standardGeminiCost: sttGeminiCost,
		standard: sttApiCost + sttGeminiCost,
		premium: Math.round(durationSeconds * VIDEO_TOKENS_PER_SECOND + PROMPT_OVERHEAD),
	};
};
