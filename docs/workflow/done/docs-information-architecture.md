# Documentation Information Architecture

- 상태: done
- 담당 역할: 역할 기획
- 담당 터미널: claude
- 관련 경로: `docs/agent`, `docs/plan`, `docs/progress`, `docs/done`, `docs/project`
- 목적: 문서 저장 위치와 역할 분리를 최신 운영 규칙에 맞게 정리
- 완료 일시: 2026-03-17 16:02

## 완료 내용

- `plan / progress / done`의 문서 역할 분리 기준을 운영 문서에 반영
- `docs/plan/INDEX.md`에 로드맵 문서 진입 구조 추가
- 기존 `docs/project/PLANNING.md`의 활성 기획 내용을 `docs/plan/service-roadmap.md`로 이관
- `docs/project/PLANNING.md`는 마이그레이션 안내 문서로 전환
- `docs/progress/TEMPLATE.md`, `docs/done/TEMPLATE.md`를 새 기준에 맞게 정리

## 변경 이유

- 문서의 목적과 저장 위치가 섞이면 `plan`, `progress`, `done`의 경계가 흐려진다.
- 기존 `docs/project/PLANNING.md`는 실제로 프로젝트 소개보다 현재 로드맵과 결정 로그 역할에 가까웠다.
- 기능 단위 문서를 유지하면서도 문서 역할별 분리가 가능하도록 기준을 먼저 고정할 필요가 있었다.

## 후속 작업

- `docs/plan/service-roadmap.md`의 상태를 실제 구현 완료 범위 기준으로 세분화
- 이후 기능별 작업은 동일 기능 접두를 유지하며 `plan / progress / done`에 분리 기록

## 비고

- `service-roadmap.md`는 현재 활성 로드맵 문서로 유지한다.
