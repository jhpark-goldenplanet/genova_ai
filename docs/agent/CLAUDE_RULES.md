# Claude Code Rules

이 문서는 현재 작업자의 Claude Code 사용 스타일을 프로젝트 규칙으로 고정하기 위한 초안입니다.

## 기본 원칙

- 기존 구조를 우선 이해하고 필요한 범위만 수정한다.
- 작은 변경 단위로 나누고 항상 실행 가능한 상태를 유지한다.
- 불필요한 추상화나 대규모 패턴 교체는 피한다.
- 임시 판단은 남기지 말고 반복될 때만 규칙으로 승격한다.

## 문서 원칙

- 프로젝트 설명 문서는 `docs/`에 유지한다.
- Claude Code 운영 규칙은 이 문서와 `docs/agent/CLAUDE_WORKFLOW.md`에만 기록한다.
- 특정 에이전트 전용 규칙은 다른 운영 문서와 분리한다.

## UI 구현 규칙

### impeccable 스킬 활용

UI 구현 완료 후, 별도 지시 없어도 `/critique`로 자체 평가하고, 문제 발견 시 수정한 뒤, Playwright로 최종 검증한다.

- 구현 완료 후: `/critique` — UX 관점 자체 평가, 문제 발견 시 즉시 수정
- 새 컴포넌트 생성 시에만: `/frontend-design` — 처음부터 만들 때 디자인 품질 확보
- 사용자가 요청한 경우: `/polish` — 정렬, 간격, 일관성 최종 점검

역할이 `역할 화면개발` 또는 `역할 기능개발`일 때 UI 변경이 포함되면 이 흐름을 따른다.

### Playwright 자체 검증

UI 구현 완료 후 Playwright MCP를 사용하여 직접 검증한다.

- 개발 서버가 실행 중인 상태에서 `mcp__playwright__browser_navigate`로 해당 페이지 접근
- `mcp__playwright__browser_snapshot`으로 현재 화면 상태 확인
- `mcp__playwright__browser_take_screenshot`으로 스크린샷 촬영하여 시각적 확인
- 버튼 클릭, 입력 등 인터랙션은 `mcp__playwright__browser_click`, `mcp__playwright__browser_fill_form` 활용
- 콘솔 에러 확인: `mcp__playwright__browser_console_messages`

검증 기준:
- 화면이 정상 렌더링되는가
- 버튼/인터랙션이 의도대로 동작하는가
- 콘솔에 에러가 없는가
- 레이아웃이 깨지지 않는가

## 초안 메모

아래 항목은 이후 작업자가 직접 채우는 자리다.

### 코드 탐색

- 자주 확인하는 진입 파일
- 우선 읽는 디렉터리 순서
- 피하고 싶은 탐색 방식

### 수정 스타일

- 선호하는 함수/컴포넌트 크기
- 리팩터링 허용 기준
- 주석 사용 기준
- 네이밍 선호

### 협업 로그

- 무엇을
- 어디를
- 왜
