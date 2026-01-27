# Quick Start Guide - Genova AI Backend Deployment

3단계로 GCP Cloud Run에 배포하기

## 🚀 빠른 시작 (3단계)

### 사전 준비

```bash
# 1. Google Cloud SDK 설치 확인
gcloud --version

# 2. 프로젝트 설정
gcloud config set project YOUR_PROJECT_ID

# 3. 인증
gcloud auth login
```

### 1단계: GCP 리소스 생성 (15-20분)

```bash
cd deployment/scripts

# 환경 변수 설정
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="asia-northeast3"
export DB_PASSWORD="your-secure-password"

# 리소스 생성 실행
chmod +x *.sh
./1-create-resources.sh
```

**생성되는 것들:**
- ✅ Cloud SQL (PostgreSQL 15, db-f1-micro)
- ✅ Cloud Memorystore (Redis 7.0, 1GB)
- ✅ Cloud Storage 버킷
- ✅ VPC Connector
- ✅ Service Account

### 2단계: 데이터베이스 스키마 초기화 (2-3분)

```bash
cd ../sql

# PostgreSQL 클라이언트 설치 (필요시)
# macOS: brew install postgresql@15
# Ubuntu: sudo apt-get install postgresql-client-15

# 스키마 초기화
chmod +x init-database.sh
./init-database.sh
```

**생성되는 테이블:**
- videos (비디오 메타데이터)
- segments (비디오 세그먼트)
- video_translations (비디오 번역)
- segment_translations (세그먼트 번역)

### 3단계: Cloud Run 배포 (10-15분)

```bash
cd ../scripts

# Docker 실행 확인
docker --version

# 배포 실행
./2-deploy.sh
```

**배포 과정:**
1. Artifact Registry 리포지토리 생성
2. Docker 이미지 빌드 (Python 3.12 + FFmpeg)
3. 이미지 푸시
4. Cloud Run 서비스 배포
5. 헬스 체크

### ✅ 배포 확인

```bash
# 서비스 URL 확인
export SERVICE_URL=$(gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format='value(status.url)')

echo "Service URL: $SERVICE_URL"

# 헬스 체크
curl $SERVICE_URL/health

# API 문서 열기
open $SERVICE_URL/docs  # macOS
# 또는 브라우저에서 직접 접속
```

## 📊 배포 후 설정

### 환경 변수 확인

배포 시 자동으로 설정된 주요 환경 변수:

```bash
APP_ENV=production
LOG_LEVEL=INFO
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
GOOGLE_CLOUD_PROJECT=...
GCS_BUCKET_NAME=...
MAX_FILE_SIZE=2GB
PROCESSING_TIMEOUT=900
```

### 로그 확인

```bash
# 최근 로그 50줄
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --limit=50

# 실시간 로그
gcloud run services logs tail genova-ai-backend \
  --region=asia-northeast3
```

## 🔧 주요 설정

### 스케일링 조정

```bash
# 최소 인스턴스를 1로 설정 (콜드 스타트 방지)
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --min-instances=1

# 메모리 증가 (대용량 비디오용)
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --memory=8Gi \
  --cpu=4
```

### CORS 설정

```bash
# 특정 도메인만 허용
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --update-env-vars="CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com"
```

## 💰 예상 비용 (월간)

**최소 사용 시나리오** (~100 요청/일):
- Cloud Run: $5-10
- Cloud SQL: $10-15
- Memorystore: $40-45
- Cloud Storage: $2-5
- VPC Connector: $10-15
- **합계: ~$70-90/월**

**프로덕션 사용 시나리오** (~1000 요청/일):
- Cloud Run: $50-100
- Cloud SQL: $50-100 (더 큰 인스턴스)
- Memorystore: $100-200 (5GB 또는 Standard tier)
- Cloud Storage: $10-20
- **합계: ~$200-400/월**

## 🗑️ 리소스 정리

테스트 후 모든 리소스 삭제:

```bash
cd deployment/scripts

# 경고: 모든 데이터가 영구 삭제됩니다!
./destroy-resources.sh
```

## 📱 API 사용 예시

### 비디오 업로드 (파일)

```bash
curl -X POST "$SERVICE_URL/v1/videos/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/video.mp4" \
  -F "title=Test Video" \
  -F "description=Test description"
```

### 비디오 업로드 (YouTube URL)

```bash
curl -X POST "$SERVICE_URL/v1/videos/upload/youtube" \
  -H "Content-Type: application/json" \
  -d '{
    "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "title": "YouTube Video",
    "description": "From YouTube"
  }'
```

### 비디오 상태 확인

```bash
curl "$SERVICE_URL/v1/videos/{video_id}"
```

### 비디오 목록 조회

```bash
curl "$SERVICE_URL/v1/videos?limit=10&offset=0"
```

## 🆘 문제 해결

### Cloud SQL 연결 실패

```bash
# Cloud SQL 인스턴스 상태 확인
gcloud sql instances describe genova-postgres

# VPC Connector 확인
gcloud compute networks vpc-access connectors describe genova-vpc-connector \
  --region=asia-northeast3
```

### Redis 연결 실패

```bash
# Memorystore 인스턴스 확인
gcloud redis instances describe genova-redis \
  --region=asia-northeast3
```

### 메모리 부족 에러

```bash
# 메모리 증가
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --memory=8Gi
```

## 📚 추가 문서

- 상세 배포 가이드: [deployment/README.md](./README.md)
- Redis 설정: [deployment/config/redis-config.md](./config/redis-config.md)
- 환경 변수: [deployment/config/.env.example](./config/.env.example)

## 🔗 유용한 링크

- [Cloud Run Console](https://console.cloud.google.com/run)
- [Cloud SQL Console](https://console.cloud.google.com/sql)
- [Memorystore Console](https://console.cloud.google.com/memorystore)
- [Cloud Storage Console](https://console.cloud.google.com/storage)

---

**배포 완료!** 🎉

문제가 있으면 로그를 확인하거나 [deployment/README.md](./README.md)의 Troubleshooting 섹션을 참고하세요.
