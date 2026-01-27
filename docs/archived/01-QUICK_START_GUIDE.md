# 빠른 시작 가이드

이 가이드를 따라 30분 내에 로컬 개발 환경을 구축할 수 있습니다.

---

## 사전 요구사항 체크리스트

시작하기 전에 다음 항목을 확인하세요:

### 필수 소프트웨어

| 항목 | 버전 | 확인 명령어 |
|------|------|-------------|
| Python | 3.12+ | `python --version` |
| Node.js | 18+ | `node --version` |
| Docker | 최신 | `docker --version` |
| FFmpeg | 최신 | `ffmpeg -version` |
| Git | 최신 | `git --version` |

### GCP 서비스 계정

- GCP 서비스 계정 JSON 키 파일 필요
- 프로젝트 관리자에게 요청하세요
- 파일명 예시: `genova-ai-project-xxxx.json`

---

## 5단계 빠른 설정

### Step 1: 저장소 클론

```bash
# 프로젝트 폴더로 이동
cd your-workspace

# 저장소 클론 (이미 있다면 건너뛰기)
git clone <repository-url> ax-agriedu-handover
cd ax-agriedu-handover
```

### Step 2: 백엔드 설정

```bash
# 백엔드 폴더로 이동
cd ax-agriedu-back-v3

# uv 설치 (Python 패키지 관리자)
# macOS/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows:
# PowerShell에서 실행
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 의존성 설치
uv sync

# 환경 변수 설정
cp .env.example .env
```

`.env` 파일 편집:

```env
# Application
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# API Key (아무 값이나 설정)
API_KEY=dev-api-key-12345

# Database (Docker로 실행)
DATABASE_URL=postgresql+asyncpg://genova_user:genova_password@localhost:5432/genova_ai

# Redis (Docker로 실행)
REDIS_URL=redis://localhost:6379/0

# Google Cloud (서비스 계정 파일 경로)
GCP_PROJECT_ID=genova-ai-project
GCP_LOCATION=asia-northeast3
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json

# Storage
GCS_BUCKET_NAME=genova-ai-project-genova-videos
```

### Step 3: 데이터베이스 & Redis 실행

```bash
# Docker로 PostgreSQL과 Redis 실행
docker-compose up -d postgres redis

# 상태 확인
docker-compose ps
```

정상 실행 확인:
```
NAME                    STATUS
ax-agriedu-postgres     Up
ax-agriedu-redis        Up
```

### Step 4: 프론트엔드 설정

```bash
# 프론트엔드 폴더로 이동
cd ../axmvp-agriedu-front

# 의존성 설치
yarn install
# 또는
npm install

# 환경 변수 설정
cp .env.example .env.local
```

`.env.local` 파일 편집:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=dev-api-key-12345
```

### Step 5: 서비스 실행

**터미널 1 - 백엔드:**
```bash
cd ax-agriedu-back-v3
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**터미널 2 - 프론트엔드:**
```bash
cd axmvp-agriedu-front
yarn dev
# 또는
npm run dev
```

---

## 동작 확인

### 백엔드 확인

| URL | 용도 |
|-----|------|
| http://localhost:8000 | API 루트 |
| http://localhost:8000/health | 헬스체크 |
| http://localhost:8000/docs | Swagger UI |

헬스체크 테스트:
```bash
curl http://localhost:8000/health
```

예상 응답:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}
```

### 프론트엔드 확인

| URL | 용도 |
|-----|------|
| http://localhost:3000 | 메인 페이지 |

브라우저에서 http://localhost:3000 접속

---

## 환경 변수 템플릿

### 백엔드 (.env)

```env
# ===================
# Application
# ===================
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# ===================
# API
# ===================
API_KEY=dev-api-key-12345

# ===================
# Database
# ===================
DATABASE_URL=postgresql+asyncpg://genova_user:genova_password@localhost:5432/genova_ai
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# ===================
# Redis
# ===================
REDIS_URL=redis://localhost:6379/0

# ===================
# Google Cloud
# ===================
GCP_PROJECT_ID=genova-ai-project
GCP_LOCATION=asia-northeast3
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json

# ===================
# Storage
# ===================
GCS_BUCKET_NAME=genova-ai-project-genova-videos

# ===================
# AI
# ===================
VERTEX_MODEL_NAME=gemini-2.5-flash
```

### 프론트엔드 (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=dev-api-key-12345
```

---

## 자주 발생하는 문제 해결 (Top 5)

### 1. Docker 실행 실패

**증상**: `docker-compose up` 실패

**해결**:
```bash
# Docker Desktop 실행 확인
# Docker Desktop을 시작하세요

# 포트 충돌 확인
netstat -an | grep 5432  # PostgreSQL
netstat -an | grep 6379  # Redis

# 기존 컨테이너 정리 후 재시작
docker-compose down
docker-compose up -d
```

### 2. Python 패키지 설치 실패

**증상**: `uv sync` 에러

**해결**:
```bash
# uv 재설치
pip install uv

# 캐시 정리 후 재설치
uv cache clean
uv sync
```

### 3. GCP 인증 실패

**증상**: `Google Cloud credentials not found`

**해결**:
```bash
# 1. 서비스 계정 파일 위치 확인
ls -la ./your-service-account.json

# 2. 환경 변수 확인
echo $GOOGLE_APPLICATION_CREDENTIALS

# 3. .env 파일에서 경로 확인
# GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json
```

### 4. 데이터베이스 연결 실패

**증상**: `Connection refused` 에러

**해결**:
```bash
# PostgreSQL 컨테이너 상태 확인
docker-compose ps postgres

# 로그 확인
docker-compose logs postgres

# 컨테이너 재시작
docker-compose restart postgres

# 연결 테스트
docker exec -it ax-agriedu-postgres psql -U genova_user -d genova_ai -c "SELECT 1"
```

### 5. 프론트엔드 API 호출 실패

**증상**: `Network Error` 또는 CORS 에러

**해결**:
```bash
# 1. 백엔드가 실행 중인지 확인
curl http://localhost:8000/health

# 2. API URL 확인 (.env.local)
# NEXT_PUBLIC_API_URL=http://localhost:8000

# 3. API Key 일치 확인
# 백엔드 .env: API_KEY=dev-api-key-12345
# 프론트엔드 .env.local: NEXT_PUBLIC_API_KEY=dev-api-key-12345

# 4. 프론트엔드 재시작
# Ctrl+C 후 yarn dev
```

---

## 다음 단계

환경 구축이 완료되었다면:

1. [프로젝트 개요](./02-PROJECT_OVERVIEW.md) - 프로젝트 이해
2. [개발 가이드](./04-DEVELOPMENT_GUIDE.md) - 개발 워크플로우
3. [API 레퍼런스](./06-API_REFERENCE.md) - API 사용법
