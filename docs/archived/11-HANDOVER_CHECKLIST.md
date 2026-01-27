# 인수인계 체크리스트

인수인계 발표 시 진행할 항목과 인수자 확인용 체크리스트

---

## 사용 방법

- **발표자**: 각 섹션 순서대로 설명
- **인수자**: 이해한 항목에 체크 `[ ]` → `[x]`
- 질문이 있으면 해당 항목 옆에 메모

---

## 1. 프로젝트 개요

### 1.1 비즈니스 이해

- [ ] 프로젝트 목적 (농업 교육 비디오 AI 분석 플랫폼)
- [ ] 주요 사용자 (콘텐츠 관리자, 교육 담당자)
- [ ] 핵심 기능 이해
  - [ ] 비디오 업로드 (파일/URL/YouTube)
  - [ ] AI 자동 분석 (요약, 키워드, 세그먼트)
  - [ ] 음성-텍스트 변환 (STT)
  - [ ] 다국어 번역

### 1.2 서비스 URL 확인

- [ ] 프로덕션 URL 접속 확인: https://genova.genaion.net
- [ ] API 문서 확인: https://genova-ai-backend-...run.app/docs
- [ ] GCP Console 접근 권한 확인

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

- [ ] 프론트엔드/백엔드 분리 구조 이해
- [ ] GCP 서비스 구성 이해
  - [ ] Cloud Run (서버리스 컨테이너)
  - [ ] Cloud SQL (PostgreSQL)
  - [ ] Cloud Storage (비디오 파일)
  - [ ] Vertex AI (Gemini 모델)

### 2.2 데이터 흐름

- [ ] 비디오 업로드 → GCS 저장 → AI 분석 → DB 저장 흐름 이해
- [ ] 비동기 처리 방식 이해 (긴 작업은 백그라운드 실행)

---

## 3. 개발 환경

### 3.1 로컬 환경 구축

- [ ] 필수 도구 설치 확인
  - [ ] Node.js 18+
  - [ ] Python 3.12
  - [ ] Docker
  - [ ] gcloud CLI
- [ ] 저장소 clone 완료
- [ ] 환경 변수 파일(.env) 전달 완료

### 3.2 로컬 실행 확인

- [ ] 백엔드 로컬 실행 성공 (FastAPI)
- [ ] 프론트엔드 로컬 실행 성공 (Next.js)
- [ ] 로컬에서 API 연동 테스트 완료

---

## 4. 코드베이스

### 4.1 백엔드 구조 (ax-agriedu-back-v3)

- [ ] 디렉토리 구조 설명
  - [ ] `app/api/v1/` - API 엔드포인트
  - [ ] `app/services/` - 비즈니스 로직
  - [ ] `app/models/` - DB 모델
  - [ ] `app/repositories/` - 데이터 액세스
- [ ] 주요 API 엔드포인트 설명
  - [ ] `/videos` - 비디오 CRUD
  - [ ] `/videos/{id}/analyze` - AI 분석
  - [ ] `/videos/{id}/segments` - 세그먼트 관리

### 4.2 프론트엔드 구조 (axmvp-agriedu-front)

- [ ] Next.js App Router 구조 이해
- [ ] 주요 페이지 설명
  - [ ] `/` - 홈 (비디오 업로드)
  - [ ] `/video/[id]/summary` - 요약 페이지
  - [ ] `/video/[id]/script` - 스크립트 페이지
  - [ ] `/video/[id]/split` - 세그먼트 분할 페이지
- [ ] 상태 관리 방식 (Zustand, React Query)

---

## 5. 배포

### 5.1 배포 프로세스

- [ ] Cloud Run 배포 방식 이해
- [ ] 배포 스크립트 위치 확인 (`deployment/`)
- [ ] 배포 명령어 실행 방법 확인

### 5.2 배포 권한

- [ ] GCP 프로젝트 접근 권한 부여 완료
- [ ] Cloud Run 배포 권한 확인
- [ ] Cloud SQL 접근 권한 확인

---

## 6. 운영

### 6.1 모니터링

- [ ] Cloud Run 로그 확인 방법
- [ ] Cloud SQL 모니터링 방법
- [ ] Upstash Redis 콘솔 접근

### 6.2 트러블슈팅

- [ ] 자주 발생하는 이슈 유형 공유
- [ ] 운영 런북 문서 위치 확인 (`07-OPERATIONS_RUNBOOK.md`)

---

## 7. 계정 및 접근 권한

### 7.1 GCP

- [ ] GCP 프로젝트 (genova-ai-project) 멤버 추가 완료
- [ ] 필요한 역할(Role) 부여 완료

### 7.2 외부 서비스

- [ ] Upstash 계정 접근 권한 (또는 정보 공유)
- [ ] Firebase 프로젝트 접근 권한

### 7.3 저장소

- [ ] Git 저장소 접근 권한 확인

---

## 8. 인수인계 문서

### 8.1 문서 확인

- [ ] 인수인계 문서 전체 목록 확인 (`docs/` 폴더)
- [ ] Quick Start Guide 따라해보기 완료
- [ ] 각 문서 위치 및 용도 이해

### 8.2 기존 프로젝트 문서

- [ ] 백엔드 README.md 확인
- [ ] 프론트엔드 README.md 확인
- [ ] API 명세서 확인

---

## 9. 알려진 이슈 및 TODO

- [ ] 현재 알려진 이슈 공유 (`10-KNOWN_ISSUES_AND_TODOS.md`)
- [ ] 향후 개발 예정 기능 공유
- [ ] 기술 부채 현황 공유

---

## 10. 질의응답

- [ ] 추가 질문 사항 논의
- [ ] 후속 미팅 일정 (필요시)

---

## 인수인계 완료 확인

| 항목 | 발표자 | 인수자 | 날짜 |
|------|--------|--------|------|
| 서명 |        |        |      |

### 메모

```
(인수인계 과정에서 추가로 논의된 사항 기록)




```

---

## 참고 문서 바로가기

| 문서 | 용도 |
|------|------|
| [00-HANDOVER_INDEX.md](./00-HANDOVER_INDEX.md) | 문서 인덱스 |
| [01-QUICK_START_GUIDE.md](./01-QUICK_START_GUIDE.md) | 빠른 시작 |
| [02-PROJECT_OVERVIEW.md](./02-PROJECT_OVERVIEW.md) | 프로젝트 개요 |
| [03-SYSTEM_ARCHITECTURE.md](./03-SYSTEM_ARCHITECTURE.md) | 시스템 아키텍처 |
| [04-DEVELOPMENT_GUIDE.md](./04-DEVELOPMENT_GUIDE.md) | 개발 가이드 |
| [05-DEPLOYMENT_GUIDE.md](./05-DEPLOYMENT_GUIDE.md) | 배포 가이드 |
| [07-OPERATIONS_RUNBOOK.md](./07-OPERATIONS_RUNBOOK.md) | 운영 런북 |
| [10-KNOWN_ISSUES_AND_TODOS.md](./10-KNOWN_ISSUES_AND_TODOS.md) | 이슈 및 TODO |
