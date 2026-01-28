# 로컬 개발 환경 설정 가이드

Genova AI 프로젝트를 로컬에서 실행하기 위한 가이드입니다.

---

## 📋 목차

1. [사전 요구사항](#-사전-요구사항)
2. [빠른 시작](#-빠른-시작)
3. [환경변수 설정](#-환경변수-설정)
4. [트러블슈팅](#-트러블슈팅)

---

## ✅ 사전 요구사항

다음 도구들이 설치되어 있어야 합니다:

```bash
# 버전 확인
node --version    # v18.0.0 이상 (권장: v20+)
python --version  # Python 3.12.0 이상
uv --version      # uv 패키지 관리자
docker --version  # Docker Desktop
ffmpeg -version   # FFmpeg
```

### 설치 가이드

| 도구 | Windows | macOS | Linux |
|------|---------|-------|-------|
| Node.js | [nodejs.org](https://nodejs.org/) | `brew install node` | `apt install nodejs` |
| Python 3.12+ | [python.org](https://www.python.org/) | `brew install python@3.12` | `apt install python3.12` |
| uv | `choco install uv` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | 동일 |
| Docker | [Docker Desktop](https://www.docker.com/products/docker-desktop) | 동일 | 동일 |
| FFmpeg | `choco install ffmpeg` | `brew install ffmpeg` | `apt install ffmpeg` |

---

## 🚀 빠른 시작

전체 실행 과정은 4단계로 진행됩니다.

### 1단계: 저장소 클론 및 인프라 실행

```bash
# 저장소 클론
git clone https://github.com/ax-axmvp/genova-ai.git
cd genova-ai

# docker-compose.yml이 프로젝트 루트에 있습니다
# PostgreSQL + Redis 실행
./setup-local-env.sh
```

### 2단계: 백엔드 실행

```bash
cd backend

# 환경변수 복사 및 설정 (아래 환경변수 섹션 참고)
cp .env.example .env
# .env 파일 편집 필요
```

**방법 1: 스크립트 사용 (권장)**
```bash
./deploy-local.sh
```

**방법 2: 수동 실행**
```bash
uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**접속 확인:**
- API: http://localhost:8000
- API 문서: http://localhost:8000/docs

### 3단계: 프론트엔드 실행 (새 터미널)

```bash
cd frontend

# 환경변수 복사 및 설정 (아래 환경변수 섹션 참고)
cp .env.example .env.local
# .env.local 파일 편집 필요
```

**방법 1: 스크립트 사용 (권장)**
```bash
./deploy-local.sh
```

**방법 2: 수동 실행**
```bash
# npm 사용
npm install && npm run dev

# 또는 yarn 사용
yarn install && yarn dev
```

**접속 확인:**
- 프론트엔드: http://localhost:3000

---

## 🔧 환경변수 설정

### 백엔드 (`.env`)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://genova_user:genova_password@localhost:5432/genova_ai
REDIS_URL=redis://localhost:6379/0

# GCP
GOOGLE_CLOUD_PROJECT=genova-ai-project
GOOGLE_CLOUD_LOCATION=asia-northeast3
GOOGLE_CLOUD_LOCATION_VERTEX_AI=us-central1
GCS_BUCKET_NAME=genova-ai-project-genova-videos

# AI Services (GCP Console에서 발급)
GENAI_API_KEY=your-gemini-api-key

# API Security
API_KEYS=dev-test-key-123

# CORS
CORS_ORIGINS=http://localhost:3000
```

### 프론트엔드 (`.env.local`)

```bash
# Backend API (백엔드 API_KEYS와 동일하게 설정)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=dev-test-key-123

# Firebase (Firebase Console에서 발급)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=genova-ai-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=genova-ai-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=genova-ai-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987680405347
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
```

**중요:** `NEXT_PUBLIC_API_KEY`는 백엔드의 `API_KEYS`와 반드시 동일해야 합니다.

---

## 🐛 트러블슈팅

### Docker

**Docker 실행 안됨**
```bash
docker info  # Docker Desktop 재시작 필요
```

**포트 충돌**
```bash
# Windows
netstat -ano | findstr :5432

# macOS/Linux
lsof -i :5432

# 컨테이너 중지
docker-compose down
```

### 백엔드

**PostgreSQL 연결 실패**
```bash
docker-compose restart postgres
```

**DB 초기화 (스키마 생성)**
```bash
# 첫 실행 시 자동 생성되지만, 수동으로 하려면:
docker-compose exec postgres psql -U genova_user -d genova_ai -f - < backend/sql/init-schema.sql

# 또는 컨테이너 내부에서:
docker-compose exec postgres psql -U genova_user -d genova_ai
# 그 다음 SQL 파일 내용 복사/붙여넣기
```

**DB 완전 초기화 (데이터 삭제)**
```bash
# 데이터 포함 완전 삭제
docker-compose down -v

# 재시작
./setup-local-env.sh
```

**모듈 없음 오류**
```bash
cd backend
uv sync
```

**API 키 오류**
- `.env` 파일에 `GENAI_API_KEY` 추가 (GCP Console에서 발급)

### 프론트엔드

**포트 3000 사용 중**
```bash
# 포트 사용 중인 프로세스 종료
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9

# 또는 다른 포트로 실행
PORT=3001 npm run dev
```

**모듈 없음 오류**
```bash
rm -rf node_modules .next
npm install
```

**환경변수 미적용**
- `.env.local` 파일 확인 (`.env.example` 아님)
- 서버 재시작

### 기타

**FFmpeg 없음**
```bash
# Windows: choco install ffmpeg
# macOS: brew install ffmpeg
```

**권한 오류**
```bash
chmod +x *.sh
```

---

## 📞 추가 정보

- [Backend README](../backend/README.md)
- [Frontend README](../frontend/README.md)
- [인수인계 문서](./todo.md)
