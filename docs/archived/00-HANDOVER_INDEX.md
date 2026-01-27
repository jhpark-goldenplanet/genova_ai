# Genova AI (AgriEdu) 인수인계 문서

농업 교육 비디오 플랫폼 - 인수인계 문서 센터

---

## 프로젝트 요약

**Genova AI**는 농업 교육용 비디오를 업로드하고 AI로 자동 분석하는 플랫폼입니다. 비디오를 업로드하면 자동으로 요약, 스크립트 추출, 세그먼트 분할, 다국어 번역이 이루어집니다.

| 항목 | 내용 |
|------|------|
| **프로젝트명** | Genova AI (AgriEdu) |
| **도메인** | genova.genaion.net |
| **백엔드** | FastAPI (Python 3.12) |
| **프론트엔드** | Next.js 14 (TypeScript) |
| **배포 환경** | Google Cloud Run (서버리스) |
| **리전** | asia-northeast3 (서울) |

---

## 문서 읽는 순서

### 신규 개발자 온보딩 (Day 1)
1. [02-PROJECT_OVERVIEW.md](./02-PROJECT_OVERVIEW.md) - 프로젝트 개요
2. [03-SYSTEM_ARCHITECTURE.md](./03-SYSTEM_ARCHITECTURE.md) - 시스템 아키텍처
3. [01-QUICK_START_GUIDE.md](./01-QUICK_START_GUIDE.md) - 로컬 환경 구축

### 개발 업무 시작 (Day 2~3)
4. [04-DEVELOPMENT_GUIDE.md](./04-DEVELOPMENT_GUIDE.md) - 개발 가이드
5. [06-API_REFERENCE.md](./06-API_REFERENCE.md) - API 레퍼런스
6. [08-CODEBASE_GUIDE.md](./08-CODEBASE_GUIDE.md) - 코드베이스 가이드

### 운영 및 배포 (필요시)
7. [05-DEPLOYMENT_GUIDE.md](./05-DEPLOYMENT_GUIDE.md) - 배포 가이드
8. [07-OPERATIONS_RUNBOOK.md](./07-OPERATIONS_RUNBOOK.md) - 운영 런북
9. [09-INFRASTRUCTURE_DETAILS.md](./09-INFRASTRUCTURE_DETAILS.md) - 인프라 상세

### 참고 자료
10. [10-KNOWN_ISSUES_AND_TODOS.md](./10-KNOWN_ISSUES_AND_TODOS.md) - 알려진 이슈 및 TODO
12. [12-YOUTUBE_AUTH_GUIDE.md](./12-YOUTUBE_AUTH_GUIDE.md) - YouTube 인증 가이드

### 인수인계 미팅용
11. [11-HANDOVER_CHECKLIST.md](./11-HANDOVER_CHECKLIST.md) - 인수인계 발표/체크리스트

---

## 문서 목록

| 문서 | 설명 |
|------|------|
| [00-HANDOVER_INDEX.md](./00-HANDOVER_INDEX.md) | 인수인계 문서 인덱스 (현재 문서) |
| [01-QUICK_START_GUIDE.md](./01-QUICK_START_GUIDE.md) | 30분 내 로컬 환경 구축 |
| [02-PROJECT_OVERVIEW.md](./02-PROJECT_OVERVIEW.md) | 프로젝트 개요 및 비즈니스 배경 |
| [03-SYSTEM_ARCHITECTURE.md](./03-SYSTEM_ARCHITECTURE.md) | 전체 시스템 아키텍처 |
| [04-DEVELOPMENT_GUIDE.md](./04-DEVELOPMENT_GUIDE.md) | 개발 환경 및 워크플로우 |
| [05-DEPLOYMENT_GUIDE.md](./05-DEPLOYMENT_GUIDE.md) | Cloud Run 배포 가이드 |
| [06-API_REFERENCE.md](./06-API_REFERENCE.md) | API 엔드포인트 레퍼런스 |
| [07-OPERATIONS_RUNBOOK.md](./07-OPERATIONS_RUNBOOK.md) | 운영 및 트러블슈팅 |
| [08-CODEBASE_GUIDE.md](./08-CODEBASE_GUIDE.md) | 코드베이스 구조 설명 |
| [09-INFRASTRUCTURE_DETAILS.md](./09-INFRASTRUCTURE_DETAILS.md) | GCP 인프라 상세 |
| [10-KNOWN_ISSUES_AND_TODOS.md](./10-KNOWN_ISSUES_AND_TODOS.md) | 알려진 이슈 및 향후 계획 |
| [11-HANDOVER_CHECKLIST.md](./11-HANDOVER_CHECKLIST.md) | 인수인계 미팅 발표/체크리스트 |
| [12-YOUTUBE_AUTH_GUIDE.md](./12-YOUTUBE_AUTH_GUIDE.md) | YouTube 쿠키 인증 설정 가이드 |

---

## 기존 문서 참조

각 프로젝트에 이미 존재하는 상세 문서들:

### 백엔드 (ax-agriedu-back-v3)
| 문서 | 위치 | 내용 |
|------|------|------|
| README.md | 루트 | 설치 및 실행 방법 |
| ARCHITECTURE.md | 루트 | GCP 인프라 아키텍처 |
| INTEGRATED_ARCHITECTURE.md | 루트 | 프론트/백엔드 통합 아키텍처 |
| USER_WORKFLOW.md | 루트 | 비디오 처리 워크플로우 |
| deployment/README.md | deployment/ | 상세 배포 가이드 |
| docs/completed/API_SPECIFICATION.md | docs/completed/ | API 명세서 |
| docs/completed/ENVIRONMENT_VARIABLES.md | docs/completed/ | 환경 변수 가이드 |
| docs/completed/DATABASE.md | docs/completed/ | 데이터베이스 스키마 |

### 프론트엔드 (axmvp-agriedu-front)
| 문서 | 위치 | 내용 |
|------|------|------|
| README.md | 루트 | 시작하기 |
| ARCHITECTURE.md | 루트 | 프론트엔드 아키텍처 |
| DOMAIN_SETUP_GUIDE.md | 루트 | 도메인 설정 가이드 |

---

## 프로젝트 폴더 구조

```
ax-agriedu-handover/
├── docs/                        # 인수인계 문서 (현재 위치)
├── ax-agriedu-back-v3/          # 백엔드 (FastAPI)
│   ├── app/                     # 애플리케이션 코드
│   ├── deployment/              # 배포 스크립트
│   ├── docs/                    # 백엔드 문서
│   └── tests/                   # 테스트 코드
└── axmvp-agriedu-front/         # 프론트엔드 (Next.js)
    ├── src/                     # 소스 코드
    │   ├── app/                 # Next.js App Router
    │   ├── components/          # 공통 컴포넌트
    │   └── shared/              # 공유 유틸리티
    └── public/                  # 정적 파일
```

---

## 주요 URL

| 환경 | URL |
|------|-----|
| **프로덕션 (프론트엔드)** | https://genova.genaion.net |
| **프로덕션 (백엔드 API)** | https://genova-ai-backend-987680405347.asia-northeast3.run.app |
| **API 문서 (Swagger)** | https://genova-ai-backend-987680405347.asia-northeast3.run.app/docs |
| **GCP Console** | https://console.cloud.google.com/run?project=genova-ai-project |
| **Upstash Redis Console** | https://console.upstash.com |

---

## 담당자 연락처

| 역할 | 담당자 | 연락처 |
|------|--------|--------|
| 인수인계 담당 | - | - |
| DevOps | - | - |
| 백엔드 개발 | - | - |
| 프론트엔드 개발 | - | - |

> 연락처 정보는 프로젝트 관리자에게 문의하세요.

---

## 문서 업데이트 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-01 | 1.0.0 | 인수인계 문서 초기 작성 |
