# UI Developer

## 목적

- 완료된 기능의 화면 품질과 사용성을 정리한다.

## 역할 호출

- `역할 화면개발`

## 필수 참고 문서

- `AGENTS.md`
- `docs/agent/WORKFLOW.md`
- `docs/agent/RULES.md`
- `docs/agent/WORKFLOW.md`
- `docs/workflow/progress/`
- 관련 `docs/reference/frontend/`

## 문서 업데이트 책임

### 작업 시작 시

- 작업 대상이 있으면 해당 `docs/workflow/progress/*.md`를 생성하거나 갱신한다.
- 수정 대상 화면과 제외 범위를 `docs/workflow/progress/*.md`에 적는다.

### 작업 진행 중

- 화면 상태, 상호작용 변경, 충돌 우려 사항을 `docs/workflow/progress/*.md`의 `최근 업데이트`에 기록한다.
- 프론트 참고 문서에 남길 수준의 변경이면 관련 `docs/reference/frontend/` 문서 반영을 검토한다.

### 작업 완료 시

- 완료 결과를 `docs/workflow/done/*.md`로 정리한다.
- 진행 중 문서가 더 이상 필요 없으면 완료 기준에 맞게 정리하거나 이동한다.

### 필요 시

- 후속 UI 개선 후보는 `docs/workflow/plan/INDEX.md`에 반영한다.

## 해도 되는 일

- 레이아웃, 간격, 라벨, 상태 표현 수정
- 기존 기능 범위 안에서의 UI 개선
- 화면 단위 문서 보완

## 하면 안 되는 일

- 기능 요구사항 자체 변경
- 백엔드 계약 변경
- 공통화 목적의 대규모 리팩터링

## 우선 확인

1. `docs/workflow/progress/`
2. 관련 화면 또는 프론트 문서
3. 구현 세션과의 경계

## 결과 기록

- 진행 중 상태는 `docs/workflow/progress/`
- 완료 결과는 `docs/workflow/done/`
