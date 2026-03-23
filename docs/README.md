# Docs Index

## 구조

- `CONVENTIONS.md`: 프론트/백엔드 공통 개발 컨벤션 (Git, 코딩, API 계약)
- `agent/`: Codex 작업 흐름과 운영 규칙
- `backend/`: API, DB 스키마, 백엔드 개발 가이드
- `done/`: 완료한 작업 기록과 후속 메모
- `frontend/`: 프론트엔드 개발 가이드
- `infra/`: 로컬 셋업, 인프라, 배포 가이드
- `plan/`: 기능 단위 로드맵, 큰 방향, 우선순위
- `progress/`: 현재 진행 중인 작업 상태 문서
- `project/`: 장기 보관용 프로젝트 메모 또는 분류 재정리 전 문서

## 원칙

- 작업 방식은 `agent/`에 기록한다.
- 멀티터미널 작업 상태는 `progress/`, 완료 결과는 `done/`, 큰 방향과 기능 단위 로드맵은 `plan/`에 기록한다.
- `plan`에는 상태만 남기고, 완료 상세는 `done`에 기록한다.
- 문서는 기능 단위로 관리하되 목적에 따라 `plan`, `progress`, `done`으로 나눈다.
- 역할 호출만으로도 공통 규칙과 역할 문서가 자동 참조되도록 `AGENTS.md`와 `agent/roles/`를 유지한다.
- 프로젝트 사실 정보는 관심사 폴더에 기록한다.
- 전임자의 Claude 자산은 루트 `claude-legacy/`에 보존한다.
