# Plan Index

## 목적

- 현재 큰 방향과 우선순위를 한 곳에서 본다.
- 기능 단위 로드맵 문서의 진입점 역할을 한다.

## 현재 운영 원칙

- 기능 구현, UI 수정, 리팩터링, 질답 세션을 병렬로 운영할 수 있다.
- 병렬 세션은 역할 문서를 기준으로 역할을 분리한다.
- 현재 진행 중인 작업은 `docs/workflow/progress/`에서 관리한다.
- 완료 후 필요한 후속 작업은 다시 이 문서에 반영한다.
- 완료 상세 설명은 `docs/workflow/done/`에서 관리한다.

## 로드맵 문서

- [Service Roadmap](./service-roadmap.md) — 기능별 구현 상태와 미구현 항목
- [Service Status Report](./service-status-report.md) — 서비스 관점 현황과 SaaS 전환 과제
- [Analysis Mode Dual Track](./analysis-mode-dual-track.md) — Standard/Premium 분석 모드 기획

## 우선순위 (2026-03-25 갱신)

### P1 — 프론트/백엔드 병행 진행

- 프리셋 → 프롬프트 연동: 프론트 4차원 프리셋 구조 완료, 백엔드 프롬프트 매핑 필요
- 영상 재분석 API: 프론트 선행 완료 (console.log), 백엔드 API 구현 필요
- 분석 모드 이중화 (Standard/Premium): 프론트 Phase 1 완료, 백엔드 파이프라인 분기 필요
- Gemini 모델 변경 (3.0 Flash): 백엔드 작업

### P2 — 프론트 mock → 실데이터 전환

- 워크스페이스/분석 흐름 백엔드 연동
- 관리 화면 실데이터 연동
- 토큰 통합 관리 (localStorage → API)

### P3 — 서비스 전환 과제

- 작업/프로젝트 정보구조 실구현
- 인증/권한/기관 운영 구조
- 분석 버전 관리
- 운영 안정성 강화

## 최근 완료 (2026-03-25)

- 프리셋 구조 재설계: 태그 토글 → 4차원(밀도/관점/스크립트/톤) + 기본 프리셋 4개
- 영상 재분석 기획: 물리 분할 없이 Gemini 분석 가능 확인, 2단계 흐름 확정
- 문서 구조 개편: workflow/ + reference/ 분리, 접두어 규칙, agent/ 문서 통합
- UI 규칙: impeccable + Playwright 자체 검증 도입
