# AGENTS

## 이 프로젝트 작업 우선순위
- 최우선: 이 파일에서 지정한 규칙을 따른다.
- 사용자가 `역할 기획`, `역할 화면개발`, `역할 기능개발`, `역할 리팩토링` 중 하나를 말하면, 별도 지시가 없어도 공통 규칙과 해당 역할 문서를 자동으로 참조한다.
- 다음: 멀티터미널 작업 중이면 `docs/progress/`에서 현재 점유 중인 작업을 먼저 확인한다.
- 다음: Codex 작업 기준 문서(`docs/agent/CODEX_WORKFLOW.md`, `docs/agent/CODEX_RULES.md`)가 있으면 먼저 확인한다.
- 다음: 역할이 지정된 세션이면 `docs/agent/roles/`의 해당 역할 문서를 확인한다.
- 다음: 큰 방향이나 다음 우선순위가 필요하면 `docs/plan/INDEX.md`를 확인한다.
- 다음: 프로젝트 문서 (`README`, `docs/*`)를 확인한다.
- 다음: `claude-legacy`는 보존용 아카이브로 간주하며, 사용자가 명시적으로 요청한 경우에만 참고한다.
- 마지막: 사용자 대화 문맥에 맞춰 실행한다.

## 실행 원칙
- 코딩/Git/API 컨벤션은 `docs/CONVENTIONS.md`를 따른다.
- 기존 코딩 스타일/구조를 최대한 유지한다 (새 패턴 도입 최소화).
- 작은 단위로 변경하고 즉시 실행 가능한 상태로 유지한다.
- 불필요한 리팩터링보다 현재 작업 목표에 필요한 범위만 수정한다.
- 환경 변수는 로컬/CI 기준값과 실제 값 분리하여 `.env` 또는 `.env.local`에서만 관리한다.
- 프론트/백엔드 협업 시 API 응답 포맷과 에러 코드는 `docs/CONVENTIONS.md` 3절을 기준으로 맞춘다.

## 문서화/연속 작업 규칙
- 프론트/백엔드 큰 변경은 `무엇을` `어디를` `왜`로 간단히 요약해 둔다.
- 병렬 터미널 작업 시 새 작업을 시작하기 전에 `docs/progress/`에 작업 문서를 만들거나 기존 문서를 갱신한다.
- 한 터미널은 한 시점에 하나의 `docs/progress/*.md` 문서에 집중한다.
- 다른 기능이나 다른 화면 작업으로 넘어가려면 새 터미널을 열고 새 역할 호출로 시작하는 것을 기본 원칙으로 한다.
- 진행 중 작업 문서에는 담당 역할, 담당 터미널, 대상 경로, 제외 범위, 최근 업데이트를 기록한다.
- 완료된 작업은 `docs/done/`으로 옮기고 결과와 후속 작업을 남긴다.
- 큰 그림 변경이나 다음 우선순위 조정은 `docs/plan/INDEX.md` 또는 관련 계획 문서에 반영한다.
- 세션이 바뀌어도 동일 규칙을 적용할 수 있게 다음을 유지한다:
  - 백엔드 실행: `backend/.env`의 `API_KEYS`, `GOOGLE_APPLICATION_CREDENTIALS`(또는 ADC 동작), `GCP_PROJECT_ID`
  - 프론트 실행: `frontend/.env.local`
  - 주요 실행 포인트: `backend`는 `uv run ...`, `frontend`는 `yarn`/`npm`로 개발 서버

## 참고
- 이미 작업한 임시 키/설정은 실제값으로 바꾸거나 문서와 맞춘 뒤 적용한다.
- 인증/보안 관련 수정은 별도 확인 없이 배포하지 않는다.
- `claude-legacy`는 전임자의 Claude 운영 자산 보관용이며, 현재 기본 작업 기준이 아니다.
- 역할 호출 매핑:
  - `역할 기획` -> `docs/agent/roles/planner.md`
  - `역할 화면개발` -> `docs/agent/roles/ui-developer.md`
  - `역할 기능개발` -> `docs/agent/roles/feature-developer.md`
  - `역할 리팩토링` -> `docs/agent/roles/refactor-bugfix.md`
