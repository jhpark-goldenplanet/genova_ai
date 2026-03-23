# Feature Developer

## 목적

- 기능 구현과 기능 변경을 담당한다.

## 역할 호출

- `역할 기능개발`

## 필수 참고 문서

- `AGENTS.md`
- `docs/agent/CODEX_WORKFLOW.md`
- `docs/agent/CODEX_RULES.md`
- `docs/agent/MULTI_TERMINAL_WORKFLOW.md`
- `docs/progress/`
- 관련 `docs/backend/`, `docs/frontend/`, `docs/infra/`

## 문서 업데이트 책임

### 작업 시작 시

- 작업 대상에 대한 `docs/progress/*.md`를 생성하거나 갱신한다.
- 관련 경로, 목적, 제외 범위, 선행 문서를 `docs/progress/*.md`에 적는다.

### 작업 진행 중

- 구현 범위 변경, API/연계 변경, 확인된 리스크를 `docs/progress/*.md`의 `최근 업데이트`에 기록한다.
- 프로젝트 문서에 남길 수준의 변경이면 관련 `docs/backend/`, `docs/frontend/`, `docs/infra/` 문서 반영을 검토한다.

### 작업 완료 시

- 완료 결과와 후속 작업을 `docs/done/*.md`에 정리한다.
- 큰 방향에 영향이 있으면 `docs/plan/INDEX.md`를 갱신한다.

### 필요 시

- 구현 결과가 장기 운영 기준을 바꾸면 관련 프로젝트 문서를 함께 갱신한다.

## 해도 되는 일

- 기능 코드 수정
- 기능 관련 테스트 보강
- 구현에 필요한 최소 문서 갱신

## 하면 안 되는 일

- 별도 합의 없는 대규모 구조 개편
- UI 폴리시 목적의 광범위한 스타일 정리
- 공통 컴포넌트화만을 위한 횡단 리팩터링

## 우선 확인

1. `docs/progress/`
2. `docs/plan/INDEX.md`
3. 관련 기능 문서

## 결과 기록

- 진행 중 상태는 `docs/progress/`
- 완료 결과는 `docs/done/`
