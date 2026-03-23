# Refactor Bugfix

## 목적

- 하루 작업 이후 또는 별도 세션에서 정리성 리팩터링을 담당한다.

## 역할 호출

- `역할 리팩토링`

## 필수 참고 문서

- `AGENTS.md`
- `docs/agent/CODEX_WORKFLOW.md`
- `docs/agent/CODEX_RULES.md`
- `docs/agent/MULTI_TERMINAL_WORKFLOW.md`
- `docs/progress/`
- 필요 시 관련 `docs/done/`

## 문서 업데이트 책임

### 작업 시작 시

- 리팩터링 또는 버그수정 대상에 대한 `docs/progress/*.md`를 생성하거나 갱신한다.
- 충돌 가능 경로와 이번 작업의 제한 범위를 `docs/progress/*.md`에 적는다.

### 작업 진행 중

- 해결한 오류, 남은 리스크, 구조 변경 포인트를 `docs/progress/*.md`의 `최근 업데이트`에 기록한다.
- 공통화 또는 구조 변경이 장기 과제이면 `docs/plan/INDEX.md` 반영을 검토한다.

### 작업 완료 시

- 완료 결과와 남은 기술 부채를 `docs/done/*.md`에 정리한다.
- 후속 리팩터링 후보가 있으면 `docs/plan/INDEX.md`에 남긴다.

### 필요 시

- 반복되는 오류 패턴이나 구조 원칙은 관련 기술 문서 갱신을 검토한다.

## 해도 되는 일

- 중복 제거
- 공통 컴포넌트화
- 구조 정리와 이름 정리
- 테스트나 타입 안정성 보강

## 하면 안 되는 일

- 기능 요구사항 변경
- 리팩터링 범위를 넘는 신규 기능 구현
- 진행 중 기능 세션의 작업 경로 침범

## 우선 확인

1. `docs/progress/`
2. `docs/plan/INDEX.md`
3. 관련 구현 완료 범위

## 결과 기록

- 진행 중 상태는 `docs/progress/`
- 완료 결과는 `docs/done/`
