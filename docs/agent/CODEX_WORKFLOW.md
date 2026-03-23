# Codex Workflow

이 문서는 현재 프로젝트에서 Codex를 사용할 때의 작업 흐름 기준점입니다.

## 목적

- 작업 시작 전에 읽어야 할 문서를 최소화한다.
- 구현보다 앞서 문서 해석 비용이 커지는 상황을 줄인다.
- 세션이 바뀌어도 동일한 판단 흐름을 유지한다.

## 현재 기본 흐름

1. `AGENTS.md`를 확인한다.
2. `docs/progress/`에서 현재 진행 중인 작업과 점유 경로를 확인한다.
3. 이 문서와 `docs/agent/CODEX_RULES.md`, `docs/agent/MULTI_TERMINAL_WORKFLOW.md`를 확인한다.
4. 사용자가 아래 역할 호출 중 하나를 말하면 해당 역할 문서를 자동으로 참조한다.
5. 큰 방향이 필요하면 `docs/plan/INDEX.md`를 확인한다.
6. 필요한 경우에만 프로젝트 문서(`README`, `docs/*`)를 본다.
7. `claude-legacy`는 명시적 요청이 있을 때만 참고한다.

## 역할 호출

- `역할 기획` -> `docs/agent/roles/planner.md`
- `역할 화면개발` -> `docs/agent/roles/ui-developer.md`
- `역할 기능개발` -> `docs/agent/roles/feature-developer.md`
- `역할 리팩토링` -> `docs/agent/roles/refactor-bugfix.md`

## 오늘 정리 기준

- Claude 전용 운영 자산은 `claude-legacy`로 분리했다.
- `docs` 아래 프로젝트 인수인계 문서는 그대로 유지한다.
- 앞으로 Codex 운영 규칙은 이 문서와 `docs/agent/CODEX_RULES.md`에 누적한다.

## 다음에 채울 항목

- 코드 탐색 순서
- 리팩터링 허용 범위
- 테스트 실행 우선순위
- 프론트/백엔드 변경 시 기록 형식
- 세션 시작 체크리스트
