# Claude Code Workflow

## 목적

- 세션 시작 시 읽는 문서를 최소화한다.
- 세션이 바뀌어도 동일한 판단 흐름을 유지한다.
- 병렬 터미널 운영 시 충돌을 줄인다.

## 세션 시작 체크리스트

1. `AGENTS.md`를 읽는다.
2. `docs/workflow/progress/`에서 현재 진행 중인 작업과 점유 경로를 확인한다.
3. 이 문서와 `docs/agent/RULES.md`를 확인한다.
4. 역할 호출이 있으면 대응되는 `docs/agent/roles/` 문서를 읽는다.
5. 큰 방향이 필요하면 `docs/workflow/plan/INDEX.md`를 확인한다.
6. 필요한 경우에만 참고 문서(`docs/reference/*`)를 본다.
7. 새 작업이면 `docs/workflow/progress/`에 작업 문서를 만든다.

## 세션 종료 체크리스트

1. `docs/workflow/progress/`의 현재 상태와 최근 업데이트를 정리한다.
2. 완료된 작업은 `docs/workflow/done/`으로 옮긴다.
3. 큰 그림이 바뀌었으면 `docs/workflow/plan/INDEX.md`를 갱신한다.
4. 참고 문서(`docs/reference/`)에 반영할 변경이 있으면 갱신한다.

## 역할 호출

- `역할 기획` -> `docs/agent/roles/planner.md`
- `역할 화면개발` -> `docs/agent/roles/ui-developer.md`
- `역할 기능개발` -> `docs/agent/roles/feature-developer.md`
- `역할 리팩토링` -> `docs/agent/roles/refactor-bugfix.md`

## 문서 구조

### 작업 흐름 문서 (`docs/workflow/`)

| 폴더 | 역할 | 적는 것 | 적지 않는 것 |
|------|------|---------|-------------|
| `plan/` | 기획·로드맵 | 우선순위, 상태(예정/진행중/완료), 큰 과제 | 세션 로그, 담당 터미널, 디버깅 과정 |
| `progress/` | 진행 중 작업 | 담당 역할, 터미널, 대상 경로, 범위, 최근 업데이트 | 프로젝트 전체 우선순위 |
| `done/` | 완료 결과 | 무엇을, 어디를, 왜 변경했는지, 후속 작업 | 진행 중 메모 |

### 참고 문서 (`docs/reference/`)

- `project/`: 프로젝트 전체 현황 (아키텍처, 기술스택)
- `api/`: API 정의
- `infra/`: 환경·배포 가이드
- `frontend/`: 프론트 개발 가이드
- `backend/`: 백엔드 개발 가이드, DB 스키마

### 접두어 규칙 (workflow 문서)

- `front-` : 프론트엔드 작업
- `back-` : 백엔드 작업
- 접두어 없음 : 공통 (기획, 전체 설계)

## 멀티터미널 운영

### 핵심 원칙

- 한 터미널에는 한 역할만 부여한다.
- 한 터미널은 한 시점에 하나의 `docs/workflow/progress/*.md` 문서에 집중한다.
- 다른 기능이나 다른 화면 작업은 새 터미널로 분리한다.

### 새 작업이 생겼을 때

- 기존 터미널의 컨텍스트를 유지하고 싶으면 새 터미널을 연다.
- 새 터미널에서 역할 호출을 먼저 한다.
- 해당 작업용 `docs/workflow/progress/*.md` 문서를 생성하거나 갱신한다.
- 기능 단위 로드맵 문서가 없으면 `docs/workflow/plan/`에 기준 문서를 만든다.

### 작업 중일 때

- 같은 작업 문서 안에서만 상태를 갱신한다.
- 범위 변경, 제외 범위, 다음 액션을 짧게 기록한다.
- 다른 작업이 생겨도 기존 문서에 섞어 쓰지 않는다.

### 작업이 끝났을 때

- 결과를 `docs/workflow/done/*.md`로 정리한다.
- `docs/workflow/plan/`에는 해당 항목의 상태만 `완료`로 갱신한다.
- 참고 문서(`docs/reference/`)에 반영할 변경이 있으면 함께 갱신한다.

### 기능 단위 문서 원칙

- 문서는 기능 단위로 관리한다.
- 같은 기능이라도 문서 목적에 따라 `plan/`, `progress/`, `done/`에 나눠 기록한다.
- 예시: `docs/workflow/plan/workspace-roadmap.md`, `docs/workflow/progress/front-workspace-ui.md`, `docs/workflow/done/front-workspace-ui-phase1.md`

### 예시

**A. 로그인 기능 구현 + 로그인 화면 수정**
- A 터미널 `역할 기능개발`: `docs/workflow/progress/back-login-api.md`
- B 터미널 `역할 화면개발`: `docs/workflow/progress/front-login-ui.md`

**B. 작업 중 다른 화면 수정 요청**
- 기존 터미널에서 섞지 않고, 새 터미널 + 새 progress 문서로 분리한다.

## 운영 관련 질문

- 운영 방식이 헷갈리면 `역할 기획` 터미널에서 질문한다.
- 답변 기준 문서는 `AGENTS.md`, 이 문서다.
