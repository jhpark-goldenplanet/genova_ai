# Analysis Mode Dual Track - Frontend

- 상태: done
- 담당 역할: 화면개발
- 관련 경로: `frontend/src/app/(root)/components/UploadContent.tsx`, `frontend/src/shared/utils/tokenEstimate.ts`, `frontend/src/shared/utils/tokenState.ts`
- 목적: CONFIGURE 단계에 Standard/Premium 분석 모드 선택 UI와 예상 토큰 사용량 표시 추가
- 작업 범위: 프론트엔드 UI만 (백엔드 API 변경 없음)
- 제외 범위: 백엔드 STT 구현, 실제 토큰 카운트 API 연동, 과금/토큰 잔량 대시보드
- 선행 문서: `docs/plan/analysis-mode-dual-track.md`

## 작업 목록

### Phase 1 (완료)
- [x] 1. `AnalysisTrack` 타입 및 상태 추가
- [x] 2. 토큰 추정 계산 유틸 함수 작성 (`tokenEstimate.ts`)
- [x] 3. 분석 모드 선택 카드 UI (Standard / Premium)
- [x] 4. 예상 토큰 사용량 비교 바 그래프 UI
- [x] 5. draft localStorage에 `analysisTrack` 반영
- [x] 6. `executeAnalysisStart`에 `track` 포함
- [x] 7. `WorkspaceAnalysisItem`에 `track` 필드 추가

### Phase 2 (완료)
- [x] 8. 토큰 상태 localStorage 통합 (`tokenState.ts`)
- [x] 9. 조직 토큰 현황 컴포넌트 (잔여/한도 바, 내 사용량, 갱신일, 플랜)
- [x] 10. 분석 시 토큰 차감 + history 기록
- [x] 11. 모드 전환 시 예상 소모/분석 후 잔여 실시간 계산
- [x] 12. 잔여 토큰 부족 시 경고 UI
- [x] 13. 구독 관리 페이지: localStorage 토큰 상태 연동
- [x] 14. 회원 관리 페이지: localStorage 토큰 상태 연동

## 최근 업데이트

- 2026-03-25: STT 토큰 상세 툴팁을 공통 Tooltip 컴포넌트(`components/Tooltip`)로 전환
- 2026-03-24: Phase 2 완료 (tokenState 유틸, 조직 토큰 현황, 토큰 차감, 3페이지 연동)
- 2026-03-24: Phase 1 완료 (UI, 상태, localStorage, 분석 시작 로직)
- 2026-03-24: 기획 문서 작성 완료, 프론트 작업 문서 생성

## 다음 액션

- 백엔드 API에 `track` 파라미터 추가 후 연동
- localStorage → API 응답으로 토큰 데이터 교체
