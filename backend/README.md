# Genova AI Backend

FastAPI 기반  동영상 분석 플랫폼 백엔드

## 🚀 빠른 시작

### 로컬 개발 환경

#### 1. Python 환경 설정

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

#### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

#### 3. 환경 변수 설정

`.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 편집:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://genova_user:genova_password@localhost:5432/genova_ai

# Redis
REDIS_URL=redis://localhost:6379/0

# GCP
GOOGLE_CLOUD_PROJECT=genova-ai-project
GOOGLE_CLOUD_LOCATION=asia-northeast3
GOOGLE_CLOUD_LOCATION_VERTEX_AI=us-central1

# Storage
GCS_BUCKET_NAME=genova-ai-project-genova-videos

# AI Services
GENAI_API_KEY=your-gemini-api-key

# API Security
API_KEYS=your-api-key-here

# CORS
CORS_ORIGINS=http://localhost:3000
```

#### 4. 로컬 데이터베이스 및 Redis 실행

```bash
# 루트 디렉토리에서
cd ..
./setup-local-env.sh
```

#### 5. 서버 실행

```bash
# 간편하게
./deploy-local.sh

# 또는 수동으로
uvicorn app.main:app --reload --port 8000
```

서버: http://localhost:8000
API Docs: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc

---

## 📦 배포

### Dev 환경 배포 (Cloud Run)

```bash
./deploy-dev.sh
```

Cloud Build를 통해 자동으로 빌드 및 배포됩니다.

---

## 🛠️ 기술 스택

### 핵심 프레임워크
- **FastAPI** - 고성능 비동기 웹 프레임워크
- **Python 3.11+** - 현대적인 Python 기능 활용
- **Uvicorn** - ASGI 서버

### 데이터베이스 및 캐시
- **PostgreSQL 15** - 메인 데이터베이스 (Cloud SQL)
- **SQLAlchemy (Async)** - ORM
- **Redis 7** - 캐싱 및 세션 관리 (Upstash/Cloud Memorystore)

### Google Cloud Platform
- **Vertex AI (Gemini)** - AI 모델 호스팅 및 추론
- **Speech-to-Text API** - 음성 인식
- **Translation API** - 다국어 번역
- **Cloud Storage** - 동영상 및 파일 저장
- **Cloud Run** - 서버리스 컨테이너 배포
- **Secret Manager** - 환경 변수 관리

### 동영상 처리
- **FFmpeg** - 동영상 인코딩/디코딩
- **yt-dlp** - YouTube 동영상 다운로드
- **Pillow** - 이미지 처리 (썸네일 생성)

---

## 📁 프로젝트 구조

```
backend/
├── app/
│   ├── api/              # API 라우터
│   │   └── v1/           # API 버전 1
│   │       ├── videos.py
│   │       ├── scripts.py
│   │       ├── segments.py
│   │       └── monitoring.py
│   ├── core/             # 핵심 설정
│   │   ├── config.py     # 환경 설정
│   │   ├── ai_config.py  # AI 서비스 설정
│   │   └── database.py   # DB 연결
│   ├── models/           # SQLAlchemy 모델
│   │   ├── video.py
│   │   ├── script.py
│   │   └── segment.py
│   ├── services/         # 비즈니스 로직
│   │   ├── video_service.py
│   │   ├── ai_service.py
│   │   └── storage_service.py
│   └── main.py           # FastAPI 앱 진입점
├── sql/
│   └── init-schema.sql   # DB 스키마
├── .env                  # 로컬 환경 변수 (Git 무시)
├── .env.example          # 환경 변수 예시
├── requirements.txt      # Python 의존성
├── cloudbuild.yaml       # Cloud Build 설정
├── Dockerfile            # 배포용 Docker 이미지
├── deploy-dev.sh         # Dev 배포 스크립트
└── deploy-local.sh       # 로컬 개발 스크립트
```

---

## 🎨 주요 기능

### 1. 동영상 업로드 및 처리
- 로컬 파일 업로드
- YouTube URL 다운로드 (yt-dlp)
- GCS 업로드 및 관리
- 4K → 1080p 자동 다운샘플링

### 2. AI 기반 자막 생성
- Google Speech-to-Text API
- 다국어 음성 인식
- 타임스탬프 포함 자막

### 3. 동영상 구간 분할
- AI 기반 자동 구간 분할
- 썸네일 자동 생성
- 구간별 메타데이터 관리

### 4. AI 요약
- Vertex AI (Gemini) 활용
- 동영상 전체 요약
- 구간별 요약

### 5. 다국어 번역
- Google Translation API
- 자막 번역
- 메타데이터 번역

### 6. 실시간 모니터링
- Health Check 엔드포인트
- 처리 상태 추적
- 상세 로깅

---

## 🔧 API 엔드포인트

### 동영상
- `POST /v1/videos/upload` - 파일 업로드
- `POST /v1/videos/url` - URL로 다운로드
- `GET /v1/videos/{video_id}` - 동영상 조회
- `DELETE /v1/videos/{video_id}` - 동영상 삭제

### 자막
- `GET /v1/scripts/{video_id}` - 자막 조회
- `POST /v1/scripts/transcribe` - 자막 생성
- `PUT /v1/scripts/{script_id}` - 자막 수정

### 구간
- `GET /v1/segments/{video_id}` - 구간 목록
- `POST /v1/segments/split` - 구간 분할
- `PUT /v1/segments/{segment_id}` - 구간 수정

### 모니터링
- `GET /health` - Health Check
- `GET /v1/monitoring/system` - 시스템 상태

자세한 API 문서: http://localhost:8000/docs

---

## 🐛 문제 해결

### 데이터베이스 연결 실패

```bash
# PostgreSQL이 실행 중인지 확인
docker ps | grep genova-postgres

# PostgreSQL 실행
cd .. && ./setup-local-env.sh
```

### Redis 연결 실패

```bash
# Redis가 실행 중인지 확인
docker ps | grep genova-redis

# Redis 실행
cd .. && ./setup-local-env.sh
```

### FFmpeg 관련 오류

```bash
# FFmpeg 설치 확인
ffmpeg -version

# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# https://ffmpeg.org/download.html
```

---

## 🧪 테스트

```bash
# 전체 테스트 실행
pytest

# 특정 테스트 실행
pytest tests/test_videos.py

# 커버리지 확인
pytest --cov=app tests/
```

---

## 📊 데이터베이스

### 스키마 초기화

```bash
# SQL 스키마 파일 위치
sql/init-schema.sql
```

### 주요 테이블
- `videos` - 동영상 정보
- `scripts` - 자막 데이터
- `segments` - 구간 정보
- `translations` - 번역 데이터

---

## 🔐 인증 및 보안

### API 키 인증

요청 헤더에 API 키 포함:

```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:8000/v1/videos
```

### CORS 설정

`.env` 파일에서 허용할 origin 설정:

```bash
CORS_ORIGINS=http://localhost:3000,https://your-frontend.com
```

---

## 📝 환경 변수

전체 환경 변수 목록은 `.env.example` 참고

필수 환경 변수:
- `DATABASE_URL` - PostgreSQL 연결 URL
- `GENAI_API_KEY` - Google AI Studio API 키
- `GOOGLE_CLOUD_PROJECT` - GCP 프로젝트 ID
- `GCS_BUCKET_NAME` - Cloud Storage 버킷 이름
- `API_KEYS` - 백엔드 API 인증 키

---

## 🔗 관련 링크

- [프론트엔드 README](../frontend/README.md)
- [인수인계 문서](../docs/todo.md)
- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [Google Cloud Platform](https://cloud.google.com/)
