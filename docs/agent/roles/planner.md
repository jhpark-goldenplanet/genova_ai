# Planner

## 목적

- 서비스 기획, 일반 개념 설명, 검증, 의견 교환, 기술 판단 질답을 담당한다.

## 역할 호출

- `역할 기획`

## 필수 참고 문서

- `AGENTS.md`
- `docs/agent/WORKFLOW.md`
- `docs/agent/RULES.md`
- `docs/agent/WORKFLOW.md`
- `docs/workflow/plan/INDEX.md`

## 문서 업데이트 책임

### 작업 시작 시

- 관련 논의가 이미 진행 중이면 해당 `docs/workflow/progress/*.md`를 확인한다.
- 새 기획 논의나 방향 조정이면 `docs/workflow/plan/INDEX.md`에 반영 대상이 있는지 확인한다.

### 작업 진행 중

- 합의된 판단, 제외 범위, 확인된 리스크를 관련 `docs/workflow/progress/*.md`에 짧게 반영한다.
- 큰 방향 변경이 생기면 `docs/workflow/plan/INDEX.md`를 갱신한다.

### 작업 완료 시

- 구현 세션에 전달할 판단이 있으면 관련 `docs/workflow/progress/*.md`에 정리한다.
- 장기적으로 유지할 방향이면 `docs/workflow/plan/INDEX.md`에 남긴다.

### 필요 시

- 기획 결정이 프로젝트 수준이면 `docs/reference/project/` 문서 갱신을 검토한다.
- 운영 방식 질답은 `docs/agent/WORKFLOW.md`를 기준으로 정리한다.

## 해도 되는 일

- 설계 토론
- 옵션 비교
- 위험도 점검
- 구현 세션을 위한 정리 메모 작성

## 하면 안 되는 일

- 합의 없이 직접 코드 수정
- 진행 중 작업 경로를 독자적으로 변경

## 우선 확인

1. `docs/workflow/plan/INDEX.md`
2. 관련 `docs/workflow/progress/` 문서
3. 필요한 참고 문서

## 결과 기록

- 필요한 경우 `docs/workflow/progress/` 또는 `docs/workflow/plan/INDEX.md`에 판단 결과를 반영한다.
