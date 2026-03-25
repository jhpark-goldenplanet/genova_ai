# Genova AI - 프로젝트 개요

## 프로젝트 정의

Genova AI는 AI 기반 영상 분석 플랫폼이다. 사용자가 영상을 업로드하면 자동으로 요약, 자막(스크립트), 구간 분할, 키워드 추출을 수행하고, 다국어 번역까지 제공한다. 교육 기관(AX AgriEdu)의 농업 교육 영상 관리를 1차 타겟으로 설계되었다.

분석은 두 가지 모드를 제공한다:
- **Standard (STT 기반)**: 음성을 STT로 텍스트 추출 후 Gemini로 요약·분석 — 토큰 비용 절약
- **Premium (영상 전체 분석)**: Gemini가 영상을 직접 시청·분석하여 OCR, 시각 정보까지 포함 — 고품질 결과

## 핵심 사용자 흐름

```
영상 업로드 → 분석 설정(프리셋 선택) → AI 분석 시작 → 결과 확인 → 분할 다운로드
```

1. **영상 업로드**: 파일 직접 업로드(최대 2GB) 또는 URL 입력
2. **분석 설정**: Standard/Premium 모드 선택 + AI 자동 분석(기본) 또는 커스텀 분석(사용자 프롬프트)
3. **AI 분석**: Gemini가 영상 전체 요약, 구간별 제목/요약/스크립트/키워드 생성
4. **결과 확인**: 요약 탭, 스크립트 탭, 분할 탭으로 구분된 상세 화면
5. **분할 다운로드**: 구간별 영상 클립 개별/일괄 다운로드 (썸네일 포함 옵션)

## 팀 구성

- 프론트엔드 개발자 1명 (프로젝트 리드)
- 백엔드 개발자 1명 (2026-03-23부터 합류)

## 프로젝트 운영 원칙

- **UI 선행 개발**: 회의 시연을 위해 UI를 먼저 구축하고, 피드백 반영 후 백엔드 구현을 병행
- **단계별 진행**: 사용자와 기능 범위 합의 → UI 구현 → 피드백 → 백엔드 구현
- **실용적 MVP**: 전체 TDD/E2E 테스트는 SaaS 단계에서 도입 예정, 현재는 핵심 기능 완성에 집중
- **파일당 최대 800줄**: 코드 복잡도 관리
- **커밋 컨벤션**: `feat/fix/refactor/docs/chore/perf/ci` 접두사 사용

## 저장소 구조

```
genova-ai/
├── backend/          # FastAPI 백엔드 (Python)
├── frontend/         # Next.js 프론트엔드 (TypeScript)
├── docs/             # 프로젝트 문서
│   ├── agent/        # AI 코딩 에이전트 운영 규칙
│   ├── backend/      # 백엔드 API, DB 스키마 문서
│   ├── frontend/     # 프론트엔드 개발 가이드
│   ├── infra/        # 인프라, 로컬 셋업, 배포 가이드
│   ├── plan/         # 로드맵, 우선순위
│   ├── progress/     # 현재 진행 중인 작업
│   └── done/         # 완료된 작업 기록
├── scripts/          # 유틸리티 스크립트
├── cmd/              # 개발 실행 스크립트
├── docker-compose.yml # 로컬 개발 환경 (PostgreSQL + Redis)
└── setup-local-env.sh # 로컬 환경 자동 설정
```

## 로컬 개발 환경 시작

```bash
# 1. 인프라 (PostgreSQL 15 + Redis 7)
./setup-local-env.sh

# 2. 백엔드 (FastAPI, port 8000)
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# 3. 프론트엔드 (Next.js, port 3000)
cd frontend && yarn install && yarn dev

# 또는 한 번에
./cmd/dev_start.sh
```

## 접속 URL

| 환경 | 프론트엔드 | 백엔드 API | API 문서 |
|------|-----------|-----------|---------|
| 로컬 | http://localhost:3000 | http://localhost:8000 | http://localhost:8000/docs |
| 개발서버 | https://genova.genaion.net | Cloud Run 내부 | - |
