# Genova AI - AX AgriEdu Platform

AI 기반  동영상 분석 플랫폼

## 📋 프로젝트 개요

Genova AI는  동영상을 분석하여 자동으로 자막 생성, 요약, 구간 분할 등을 제공하는 플랫폼입니다.

- **Frontend**: Next.js 14 + TypeScript
- **Backend**: FastAPI + Python 3.11
- **Infrastructure**: Google Cloud Platform (Cloud Run, Cloud SQL, Vertex AI)

---

## 🏗️ 프로젝트 구조

```
genova-ai/
├── frontend/          # Next.js 프론트엔드
├── backend/           # FastAPI 백엔드
├── docs/              # 문서 및 인수인계 자료
├── docker-compose.yml # 로컬 개발용 (PostgreSQL, Redis)
└── setup-local-env.sh # 로컬 환경 설정 스크립트
```

---

## 🚀 빠른 시작

### 로컬 개발 환경

#### 1. 저장소 클론
```bash
git clone https://github.com/ax-axmvp/genova-ai.git
cd genova-ai
```

#### 2. 로컬 인프라 실행 (PostgreSQL, Redis)
```bash
./setup-local-env.sh
```

#### 3. 백엔드 실행
```bash
cd backend
cp .env.example .env
# .env 파일 편집 (DB 비밀번호, API 키 등 설정)
./deploy-local.sh
```

서버: http://localhost:8000
API Docs: http://localhost:8000/docs

#### 4. 프론트엔드 실행 (새 터미널)
```bash
cd frontend
cp .env.example .env.local
# .env.local 파일 편집
./deploy-local.sh
```

서버: http://localhost:3000

---

## 🌐 배포

### Dev 환경 배포 (GCP Cloud Run)

#### 프론트엔드
```bash
cd frontend
./deploy-dev.sh
```

#### 백엔드
```bash
cd backend
./deploy-dev.sh
```

배포는 Cloud Build를 통해 자동으로 진행됩니다.

---

## 🛠️ 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Emotion (CSS-in-JS)
- **State Management**: Zustand
- **Data Fetching**: React Query
- **Authentication**: Firebase Auth

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Database**: PostgreSQL 15 (Cloud SQL)
- **Cache**: Redis 7
- **ORM**: SQLAlchemy (Async)
- **AI Services**:
  - Google Vertex AI (Gemini) - 비디오 분석, 요약, Transcript 생성
  - Google Cloud Translation - 다국어 번역

### Infrastructure
- **Cloud Platform**: Google Cloud Platform
- **Compute**: Cloud Run (Serverless)
- **Database**: Cloud SQL (PostgreSQL)
- **Storage**: Cloud Storage
- **Secrets**: Secret Manager
- **CI/CD**: Cloud Build
- **Containerization**: Docker

---

## 📚 문서

### 환경 설정
- [로컬 개발 환경 설정](./docs/LOCAL_SETUP_GUIDE.md)

### Dev 환경 인수인계
- [Backend Dev 환경 가이드](./docs/DEV_BACKEND_GUIDE.md)
- [Frontend Dev 환경 가이드](./docs/DEV_FRONTEND_GUIDE.md)
- [GCP 인프라 및 네트워크 가이드](./docs/DEV_INFRASTRUCTURE_GUIDE.md)

### 기타
- [인수인계 체크리스트](./docs/todo.md)
- [프론트엔드 README](./frontend/README.md)
- [백엔드 README](./backend/README.md)

---

## 🌍 GCP 환경

### Project
- **Project ID**: genova-ai-project
- **Region**: asia-northeast3 (Seoul)

### Services
- **Frontend**: https://genova-frontend-987680405347.asia-northeast3.run.app
- **Backend**: https://genova-ai-backend-987680405347.asia-northeast3.run.app
- **Backend API Docs**: https://genova-ai-backend-987680405347.asia-northeast3.run.app/docs

---

## 🔐 Secret Manager

개발 환경의 민감한 정보는 GCP Secret Manager에 저장되어 있습니다:

- `dev-next-public-api-key` - 프론트엔드 API 인증키
- `dev-db-password` - PostgreSQL 비밀번호
- `dev-gemini-api-key` - Google AI Studio API 키
- `dev-api-keys` - 백엔드 API 인증키
- `dev-redis-url` - Redis 연결 URL

---

## 🤝 기여 가이드

1. 기능 브랜치 생성: `git checkout -b feature/amazing-feature`
2. 변경사항 커밋: `git commit -m 'feat: add amazing feature'`
3. 브랜치 푸시: `git push origin feature/amazing-feature`
4. Pull Request 생성

### Commit Convention
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 코드
chore: 빌드, 설정 파일 수정
```

---

## 📝 라이선스

Proprietary - Golden Planet Co., Ltd.

---

## 👥 팀

- **Organization**: ax-axmvp
- **Project**: Genova AI - AX AgriEdu Platform
