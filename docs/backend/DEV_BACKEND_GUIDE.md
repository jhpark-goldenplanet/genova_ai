# Backend Dev 환경 인수인계 가이드

Genova AI Backend의 Dev 환경 배포 및 운영 가이드입니다.

---

## 📋 목차

1. [Dev 환경 개요](#-dev-환경-개요)
2. [배포 프로세스](#-배포-프로세스)
3. [환경 변수 및 Secret 관리](#-환경-변수-및-secret-관리)
4. [Cloud Run 서비스 구성](#-cloud-run-서비스-구성)
5. [데이터베이스 (Cloud SQL)](#-데이터베이스-cloud-sql)
6. [캐시 (Redis)](#-캐시-redis)
7. [Storage (GCS)](#-storage-gcs)
8. [모니터링 및 로깅](#-모니터링-및-로깅)
9. [트러블슈팅](#-트러블슈팅)

---

## 1. 🌐 Dev 환경 개요

### 서비스 정보

| 항목 | 값 |
|------|-----|
| **서비스 이름** | `genova-ai-backend` |
| **GCP 프로젝트** | `genova-ai-project` |
| **리전** | `asia-northeast3` (Seoul) |
| **플랫폼** | Cloud Run (Serverless) |
| **URL** | https://genova-ai-backend-987680405347.asia-northeast3.run.app |

### 아키텍처 구성

```
┌─────────────────┐
│   Cloud Run     │
│   (Backend)     │
│  - FastAPI      │
│  - Python 3.12+ │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌─▼────────┐
│Cloud   │ │ Cloud    │
│SQL     │ │ Storage  │
│(Postgres)│ │ (Videos) │
└────────┘ └──────────┘
    │
┌───▼────┐
│ Redis  │
│(Upstash)│
└────────┘
```

### 주요 기술 스택

- **Runtime**: Python 3.12+
- **Framework**: FastAPI
- **ASGI Server**: Uvicorn
- **Database**: PostgreSQL 15 (Cloud SQL)
- **Cache**: Redis 7 (Upstash)
- **Storage**: Google Cloud Storage
- **AI Services**:
  - Vertex AI (Gemini) - 비디오 분석, 요약, Transcript 생성
  - Translation API - 다국어 번역

---

## 2. 🚀 배포 프로세스

### 전제 조건

다음이 준비되어 있어야 합니다:

```bash
# gcloud CLI 설치 확인
gcloud version

# 프로젝트 설정
gcloud config set project genova-ai-project

# 인증 확인
gcloud auth list

# 필요한 권한
# - Cloud Run Admin
# - Cloud Build Editor
# - Secret Manager Secret Accessor
# - Artifact Registry Writer
```

### 배포 스크립트 실행

```bash
cd backend

# Dev 환경 배포
./deploy-dev.sh
```

### 배포 과정 상세

배포 스크립트는 다음 단계를 자동으로 수행합니다:

#### 1. Docker 이미지 빌드

```yaml
# cloudbuild.yaml 참조
# Platform: linux/amd64
# Base Image: python:3.12-slim
# 빌드 위치: Artifact Registry
# - asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest
```

#### 2. Artifact Registry 푸시

```bash
# 자동으로 다음 레지스트리에 푸시됨
asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest
```

#### 3. Cloud Run 배포

다음 설정으로 배포됩니다:

| 항목 | 값 | 설명 |
|------|-----|------|
| **Memory** | 8Gi | 동영상 처리에 필요한 메모리 |
| **CPU** | 4 | 멀티코어 처리 |
| **Timeout** | 3600s (1시간) | 긴 작업 처리 |
| **Concurrency** | 10 | 동시 요청 수 |
| **Min Instances** | 0 | Cold start 허용 |
| **Max Instances** | 10 | 최대 확장 |
| **CPU Boost** | 활성화 | 빠른 시작 |

### 수동 배포 (Cloud Build)

스크립트 없이 수동으로 배포:

```bash
cd backend

# Cloud Build 제출
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=genova-ai-project
```

### 배포 확인

```bash
# 배포 상태 확인
gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format=yaml

# Health Check
curl https://genova-ai-backend-987680405347.asia-northeast3.run.app/health

# API 문서 확인
open https://genova-ai-backend-987680405347.asia-northeast3.run.app/docs
```

---

## 3. 🔐 환경 변수 및 Secret 관리

### Secret Manager 목록

Dev 환경의 민감한 정보는 Secret Manager에 저장됩니다:

| Secret 이름 | 용도 | 접근 방법 |
|-------------|------|-----------|
| `dev-db-password` | PostgreSQL 비밀번호 | Cloud Run 자동 주입 |
| `dev-gemini-api-key` | Google AI Studio API 키 | Cloud Run 자동 주입 |
| `dev-api-keys` | 백엔드 API 인증 키 | Cloud Run 자동 주입 |
| `dev-redis-url` | Redis 연결 URL (Upstash) | Cloud Run 자동 주입 |

### Secret 확인 및 수정

```bash
# Secret 목록 조회
gcloud secrets list --project=genova-ai-project

# Secret 값 확인 (최신 버전)
gcloud secrets versions access latest --secret=dev-db-password

# Secret 업데이트
echo -n "new-password" | gcloud secrets versions add dev-db-password --data-file=-

# Secret 삭제 (주의!)
gcloud secrets delete dev-db-password
```

### 환경 변수 설정

Cloud Run에서 다음 환경 변수가 설정됩니다 (`cloudbuild.yaml` 참조):

#### 필수 환경 변수

```bash
# 애플리케이션
APP_ENV=production
LOG_LEVEL=INFO

# 데이터베이스
DATABASE_URL=postgresql+asyncpg://genova_user:${DB_PASSWORD}@/genova_ai?host=/cloudsql/genova-ai-project:asia-northeast3:genova-postgres
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10

# GCP 설정
GOOGLE_CLOUD_PROJECT=genova-ai-project
GOOGLE_CLOUD_LOCATION=asia-northeast3
GOOGLE_CLOUD_LOCATION_VERTEX_AI=us-central1
GCS_BUCKET_NAME=genova-ai-project-genova-videos

# 파일 업로드
MAX_FILE_SIZE=2147483648  # 2GB

# 처리 설정
PROCESSING_TIMEOUT=900
MAX_CONCURRENT_TASKS=5

# AI 모델
VERTEX_AI_MODEL=gemini-3-flash-preview
SUMMARIZATION_MODEL=gemini-3-flash-preview

# CORS
CORS_ORIGINS=https://genova.genaion.net
```

### 환경 변수 업데이트

```bash
# Cloud Run 서비스 환경 변수 업데이트
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --set-env-vars="LOG_LEVEL=DEBUG"

# 여러 환경 변수 동시 업데이트
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --set-env-vars="LOG_LEVEL=DEBUG,MAX_FILE_SIZE=3221225472"
```

---

## 4. ☁️ Cloud Run 서비스 구성

### Service Account

```bash
# Service Account: genova-backend-sa@genova-ai-project.iam.gserviceaccount.com

# 부여된 권한:
# - Cloud SQL Client (cloudsql.client)
# - Storage Object Admin (storage.objectAdmin)
# - Secret Manager Secret Accessor (secretmanager.secretAccessor)
# - Vertex AI User (aiplatform.user)
```

### 네트워크 설정

```bash
# Ingress: 모든 트래픽 허용 (all)
# Egress: 모든 외부 연결 허용 (all)

# Cloud SQL 연결:
# - Private IP 사용 안 함
# - Unix Socket 사용 (/cloudsql/...)
```

### 리소스 제한

```yaml
Resources:
  CPU: 4 cores (4000m)
  Memory: 8Gi
  Startup CPU Boost: enabled

Execution:
  Max Instances: 10
  Min Instances: 0
  Max Concurrency: 10
  Timeout: 3600s (1시간)
```

### Cold Start 최적화

```bash
# CPU Boost 활성화로 빠른 시작
# Min Instances = 0 으로 비용 절감
# 첫 요청은 10-30초 소요 가능
```

---

## 5. 💾 데이터베이스 (Cloud SQL)

### 인스턴스 정보

| 항목 | 값 |
|------|-----|
| **인스턴스 이름** | `genova-postgres` |
| **연결 이름** | `genova-ai-project:asia-northeast3:genova-postgres` |
| **버전** | PostgreSQL 15 |
| **리전** | `asia-northeast3` |
| **머신 타입** | db-f1-micro (Shared vCPU, 0.6GB RAM) |
| **디스크** | SSD 10GB (자동 증가 활성화) |

### 데이터베이스 접속

```bash
# Cloud SQL Proxy를 통한 로컬 접속
gcloud sql connect genova-postgres \
  --user=genova_user \
  --project=genova-ai-project

# 또는 Cloud SQL Proxy 직접 실행
cloud-sql-proxy genova-ai-project:asia-northeast3:genova-postgres

# 그 다음 로컬에서 연결
psql "host=127.0.0.1 port=5432 user=genova_user dbname=genova_ai"
```

### 스키마 관리

```bash
# 스키마 파일 위치
backend/sql/init-schema.sql

# 주요 테이블:
# - videos: 동영상 정보
# - scripts: 자막/스크립트
# - segments: 구간 정보
# - translations: 번역 데이터
```

### 백업 및 복구

```bash
# 자동 백업: 매일 새벽 2시 (KST)
# 보관 기간: 7일

# 수동 백업 생성
gcloud sql backups create \
  --instance=genova-postgres \
  --project=genova-ai-project

# 백업 목록 조회
gcloud sql backups list \
  --instance=genova-postgres

# 백업에서 복구 (신중히!)
gcloud sql backups restore BACKUP_ID \
  --backup-instance=genova-postgres \
  --backup-project=genova-ai-project
```

### DB 성능 모니터링

```bash
# Cloud SQL Insights에서 확인:
# https://console.cloud.google.com/sql/instances/genova-postgres/insights

# 주요 메트릭:
# - CPU 사용률
# - 메모리 사용률
# - 활성 연결 수
# - 느린 쿼리
```

---

## 6. 🗄️ 캐시 (Redis)

### Redis 정보

| 항목 | 값 |
|------|-----|
| **Provider** | Upstash |
| **Type** | Redis 7 |
| **리전** | ap-northeast-1 (Tokyo) - 가장 가까운 리전 |
| **용도** | 캐싱, 세션 관리 |

### 연결 정보

```bash
# Secret Manager에 저장됨: dev-redis-url
# 형식: rediss://default:password@host:port

# 접속 확인
redis-cli -u "$(gcloud secrets versions access latest --secret=dev-redis-url)"
```

### 캐시 키 구조

```bash
# 동영상 메타데이터
video:{video_id}:metadata

# 처리 상태
video:{video_id}:status

# 세션 데이터
session:{session_id}
```

### Redis 모니터링

```bash
# Upstash Console에서 모니터링:
# https://console.upstash.com/

# 주요 메트릭:
# - Commands/sec
# - Memory Usage
# - Hit Rate
```

---

## 7. 📦 Storage (GCS)

### 버킷 정보

| 항목 | 값 |
|------|-----|
| **버킷 이름** | `genova-ai-project-genova-videos` |
| **리전** | `asia-northeast3` |
| **Storage Class** | Standard |
| **접근 제어** | Uniform (IAM) |

### 디렉토리 구조

```
genova-ai-project-genova-videos/
├── videos/                # 원본 동영상
│   └── {video_id}/
│       ├── original.mp4
│       └── metadata.json
├── thumbnails/            # 썸네일 이미지
│   └── {video_id}/
│       └── {segment_id}.jpg
├── segments/              # 분할된 동영상
│   └── {video_id}/
│       ├── segment_1.mp4
│       └── segment_2.mp4
└── temp/                  # 임시 파일 (자동 삭제)
```

### 버킷 접근

```bash
# gsutil로 파일 확인
gsutil ls gs://genova-ai-project-genova-videos/

# 특정 디렉토리 내용 확인
gsutil ls gs://genova-ai-project-genova-videos/videos/

# 파일 다운로드
gsutil cp gs://genova-ai-project-genova-videos/videos/123/original.mp4 ./

# 파일 업로드
gsutil cp ./local-file.mp4 gs://genova-ai-project-genova-videos/temp/
```

### CORS 설정

GCS CORS 설정은 환경에 따라 다르게 적용합니다:

**로컬 개발용** (`backend/cors.json`):
```json
[
  {
    "origin": ["http://localhost:3000"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

**프로덕션용** (수동 설정 필요):
```json
[
  {
    "origin": ["https://genova.genaion.net"],
    "method": ["GET", "HEAD", "PUT", "POST"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

**CORS 적용 명령**:
```bash
# 프로덕션 설정 적용
gsutil cors set cors-production.json gs://genova-ai-project-genova-videos
```

### 수명 주기 관리

```bash
# temp/ 디렉토리: 7일 후 자동 삭제
# 설정 위치: GCS Console > Lifecycle

# 수명 주기 규칙 확인
gsutil lifecycle get gs://genova-ai-project-genova-videos
```

---

## 8. 📊 모니터링 및 로깅

### Cloud Logging

```bash
# 최근 로그 확인
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --limit=50

# 실시간 로그 스트리밍
gcloud run services logs tail genova-ai-backend \
  --region=asia-northeast3

# 에러 로그만 필터링
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit=50 \
  --format=json
```

### Log Explorer (고급 검색)

```bash
# Cloud Console > Logging > Logs Explorer
# https://console.cloud.google.com/logs/

# 유용한 쿼리:
resource.type="cloud_run_revision"
resource.labels.service_name="genova-ai-backend"
severity>=ERROR

# 특정 요청 추적
resource.type="cloud_run_revision"
httpRequest.requestUrl=~"/v1/videos"
```

### Cloud Monitoring

```bash
# Cloud Console > Monitoring
# https://console.cloud.google.com/monitoring

# 주요 메트릭:
# - Request Count
# - Request Latency (P50, P95, P99)
# - Error Rate
# - Instance Count
# - CPU/Memory Utilization
# - Billable Instance Time
```

### Health Check 엔드포인트

```bash
# 기본 Health Check
curl https://genova-ai-backend-987680405347.asia-northeast3.run.app/health

# 응답 예시:
{
  "status": "healthy",
  "timestamp": "2024-01-28T10:00:00Z",
  "version": "1.0.0"
}
```

### 알림 설정

```bash
# Cloud Monitoring > Alerting
# 추천 알림:
# 1. Error Rate > 5% (5분 동안)
# 2. Request Latency P99 > 10s
# 3. Instance Count = 0 (서비스 다운)
# 4. CPU > 90% (5분 동안)
```

---

## 9. 🐛 트러블슈팅

### 일반적인 문제

#### 1. 서비스가 시작되지 않음

```bash
# 로그 확인
gcloud run services logs read genova-ai-backend --limit=100

# 주요 체크사항:
# - Secret Manager 접근 권한
# - Cloud SQL 연결
# - 환경 변수 설정
```

#### 2. Cold Start가 너무 느림

```bash
# CPU Boost 확인
gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.containers[0].startupCpuBoost)"

# CPU Boost 활성화
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --cpu-boost
```

#### 3. 타임아웃 오류

```bash
# 현재 타임아웃 확인
gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.timeoutSeconds)"

# 타임아웃 증가 (최대 3600초)
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --timeout=3600
```

#### 4. 메모리 부족

```bash
# 메모리 증가
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --memory=8Gi
```

#### 5. Database 연결 실패

```bash
# Cloud SQL 인스턴스 상태 확인
gcloud sql instances describe genova-postgres

# Cloud SQL 재시작
gcloud sql instances restart genova-postgres

# Cloud SQL Proxy 연결 테스트
gcloud sql connect genova-postgres --user=genova_user
```

### 디버깅 팁

```bash
# 1. 로컬에서 동일한 환경 재현
cd backend
cp .env.example .env
# .env 파일을 Cloud Run 환경 변수와 동일하게 설정
uv run python -m uvicorn app.main:app --reload

# 2. Cloud Run 리비전 확인
gcloud run revisions list --service=genova-ai-backend

# 3. 특정 리비전 트래픽 조정
gcloud run services update-traffic genova-ai-backend \
  --to-revisions=REVISION-001=100

# 4. 롤백
gcloud run services update-traffic genova-ai-backend \
  --to-revisions=PREVIOUS-REVISION=100
```

### 긴급 대응

```bash
# 서비스 중단 (긴급)
gcloud run services delete genova-ai-backend --region=asia-northeast3

# 트래픽 0으로 설정 (서비스 유지하며 중단)
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --min-instances=0 \
  --max-instances=0

# 서비스 재개
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --min-instances=0 \
  --max-instances=10
```

---

## 📞 추가 정보

### 관련 문서

- [Frontend Dev 가이드](../frontend/DEV_FRONTEND_GUIDE.md)
- [인프라 가이드](../infra/DEV_INFRASTRUCTURE_GUIDE.md)
- [로컬 셋업 가이드](../infra/LOCAL_SETUP_GUIDE.md)
- [Backend README](../backend/README.md)

### 유용한 링크

- [Cloud Run Console](https://console.cloud.google.com/run?project=genova-ai-project)
- [Cloud SQL Console](https://console.cloud.google.com/sql?project=genova-ai-project)
- [Secret Manager Console](https://console.cloud.google.com/security/secret-manager?project=genova-ai-project)
- [GCS Console](https://console.cloud.google.com/storage?project=genova-ai-project)
- [Logs Explorer](https://console.cloud.google.com/logs?project=genova-ai-project)
- [Cloud Monitoring](https://console.cloud.google.com/monitoring?project=genova-ai-project)

### 연락처

- **Project**: Genova AI - AX AgriEdu Platform
- **Organization**: ax-axmvp
- **Support**: [프로젝트 관리자 연락처]
