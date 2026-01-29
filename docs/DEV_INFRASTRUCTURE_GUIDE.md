# Dev 인프라 및 네트워크 가이드

Genova AI 프로젝트의 GCP 인프라 구성 및 네트워크 설정에 대한 상세 가이드입니다.

---

## 📋 목차

1. [인프라 개요](#-인프라-개요)
2. [GCP 프로젝트 구성](#-gcp-프로젝트-구성)
3. [네트워크 아키텍처](#-네트워크-아키텍처)
4. [컴퓨팅 리소스](#-컴퓨팅-리소스)
5. [데이터베이스 및 스토리지](#-데이터베이스-및-스토리지)
6. [보안 및 IAM](#-보안-및-iam)
7. [CI/CD 파이프라인](#-cicd-파이프라인)
8. [비용 관리](#-비용-관리)
9. [재해 복구](#-재해-복구)

---

## 1. 🌐 인프라 개요

### 전체 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                        GCP Project                               │
│                    genova-ai-project                             │
│                  Region: asia-northeast3 (Seoul)                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Custom Domains                                │
│           agriedu.genaion.net / genova.genaion.net               │
│                   (Google Managed SSL)                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Cloud Load Balancer                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ Static IP: 136.110.153.12                              │     │
│  │ - HTTPS Forwarding Rule → HTTPS Proxy                  │     │
│  │ - HTTP Forwarding Rule → HTTP Redirect (→ HTTPS)       │     │
│  │ - URL Map: genova-url-map                              │     │
│  │ - Backend Service: be-genova-frontend                  │     │
│  └────────────────────┬───────────────────────────────────┘     │
└───────────────────────┼──────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Frontend Layer                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Cloud Run: genova-frontend                                │   │
│  │ - Next.js 14                                              │   │
│  │ - 1 vCPU, 1GB RAM                                         │   │
│  │ - Min: 0, Max: 10 instances                               │   │
│  │ - Ingress: Internal + Load Balancer only                 │   │
│  │ - Network Endpoint Group: neg-genova-frontend            │   │
│  └────────────────────┬─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                        │
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend Layer                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cloud Run: genova-ai-backend                             │  │
│  │ - FastAPI                                                │  │
│  │ - 4 vCPU, 8GB RAM                                        │  │
│  │ - Min: 0, Max: 10 instances                              │  │
│  │ - Ingress: All (Public)                                  │  │
│  └────┬───────────┬──────────┬──────────────────────────────┘  │
└───────┼───────────┼──────────┼─────────────────────────────────┘
        │           │          │
        │           │          │
    ┌───▼─────┐ ┌──▼──────┐ ┌─▼──────────────┐
    │ Cloud   │ │ Cloud   │ │ Redis          │
    │ SQL     │ │ Storage │ │ (Upstash)      │
    │ Postgres│ │ (GCS)   │ │ ap-northeast-1 │
    └─────────┘ └─────────┘ └────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      AI Services                                │
│  ┌─────────────────────────────┐  ┌────────────────┐           │
│  │ Vertex AI (Gemini)          │  │ Translation    │           │
│  │ - Video Analysis            │  │ API            │           │
│  │ - Summarization             │  │ Global         │           │
│  │ - Transcript Generation     │  │                │           │
│  │ us-central1                 │  │                │           │
│  └─────────────────────────────┘  └────────────────┘           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   Support Services                              │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐            │
│  │ Secret       │  │ Artifact  │  │ Cloud Build  │            │
│  │ Manager      │  │ Registry  │  │              │            │
│  └──────────────┘  └───────────┘  └──────────────┘            │
│                                                                 │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐            │
│  │ Cloud        │  │ Cloud     │  │ IAM          │            │
│  │ Logging      │  │ Monitoring│  │              │            │
│  └──────────────┘  └───────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   External Services                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Firebase Authentication                                   │  │
│  │ - Email/Password Auth                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 리전 전략

| 서비스 | 리전 | 이유 |
|--------|------|------|
| Cloud Run (Frontend/Backend) | asia-northeast3 (Seoul) | 한국 사용자 최소 지연시간 |
| Cloud SQL | asia-northeast3 (Seoul) | Backend와 동일 리전 (지연시간 최소화) |
| Cloud Storage | asia-northeast3 (Seoul) | Backend와 동일 리전 (전송 속도) |
| Vertex AI | us-central1 (Iowa) | Gemini 모델 가용성 |
| Redis (Upstash) | ap-northeast-1 (Tokyo) | 가장 가까운 지원 리전 |

---

## 2. 🏢 GCP 프로젝트 구성

### 프로젝트 정보

```bash
# 프로젝트 ID
PROJECT_ID=genova-ai-project

# 프로젝트 번호
PROJECT_NUMBER=987680405347

# 기본 리전
DEFAULT_REGION=asia-northeast3

# 조직
ORGANIZATION=ax-axmvp
```

### 활성화된 API

```bash
# 활성화된 GCP API 목록
gcloud services list --enabled --project=genova-ai-project

# 주요 API:
# - run.googleapis.com (Cloud Run)
# - cloudbuild.googleapis.com (Cloud Build)
# - sqladmin.googleapis.com (Cloud SQL Admin)
# - storage-api.googleapis.com (Cloud Storage)
# - secretmanager.googleapis.com (Secret Manager)
# - aiplatform.googleapis.com (Vertex AI - Gemini)
# - translate.googleapis.com (Translation API)
# - artifactregistry.googleapis.com (Artifact Registry)
```

### API 활성화 명령

```bash
# 필수 API 일괄 활성화
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  storage-api.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  translate.googleapis.com \
  artifactregistry.googleapis.com \
  --project=genova-ai-project
```

---

## 3. 🌐 네트워크 아키텍처

### Custom Domain 및 Load Balancer

**적용된 설정:**

```yaml
Custom Domains:
  - agriedu.genaion.net
  - genova.genaion.net

Domain Registrar: 가비아 (Gabia)
  # 도메인 관리는 가비아 웹사이트에서 수행
  # DNS 레코드 설정: A 레코드 → 136.110.153.12

SSL Certificate:
  Name: genova-ssl-cert
  Type: Google Managed
  Status: ACTIVE
  Domains:
    - agriedu.genaion.net (ACTIVE)
    - genova.genaion.net (ACTIVE)
  Expiry: 2026-04-05

Static IP:
  Address: 136.110.153.12
  Name: genova-frontend-ip

Cloud Load Balancer:
  - URL Map: genova-url-map
    Default Service: be-genova-frontend

  - HTTPS Proxy: genova-https-proxy
    SSL Certificate: genova-ssl-cert
    URL Map: genova-url-map

  - HTTP Redirect: genova-http-redirect
    HTTP → HTTPS 자동 리다이렉트

Forwarding Rules:
  - genova-https-forwarding-rule (TCP:443)
  - genova-http-forwarding-rule (TCP:80)

Backend Service:
  Name: be-genova-frontend
  Protocol: HTTP
  Backend: neg-genova-frontend (Serverless NEG)

Network Endpoint Group:
  Name: neg-genova-frontend
  Type: SERVERLESS
  Location: asia-northeast3
  Service: genova-frontend (Cloud Run)

Cloud Armor Security Policy:
  Name: block-suspicious-ips
  Description: Block suspicious IPs for Cloud Run
  Attached to: be-genova-frontend (Backend Service)

  Rules:
    - Priority 100: Geo-blocking
      Action: deny(403)
      Description: Block non-Korea traffic
      Condition: origin.region_code != 'KR'
      # 한국 이외 지역에서 오는 트래픽 차단

    - Priority 2147483647: Default allow
      Action: allow
      Description: Default rule
      Condition: All remaining traffic
```

### VPC 구성

현재 기본 VPC 네트워크 사용:

```bash
# VPC 정보
NETWORK=default
SUBNET=default (auto mode)

# Cloud Run은 기본적으로 공용 인터넷 통해 외부 접근
# Private IP 사용 안 함 (간소화된 구성)
```

### 방화벽 규칙

```bash
# 기본 방화벽 규칙 사용
# - default-allow-icmp
# - default-allow-internal
# - default-allow-rdp
# - default-allow-ssh

# Load Balancer는 자동으로 HTTPS(443), HTTP(80) 포트 노출
```

### 네트워크 흐름

#### 사용자 → Frontend (Custom Domain)

```
User Browser
    ↓ HTTPS (443) / HTTP (80)
agriedu.genaion.net (136.110.153.12)
    ↓
Cloud Load Balancer
  - HTTP → HTTPS 리다이렉트
  - SSL Termination (Google Managed SSL)
    ↓
Backend Service (be-genova-frontend)
    ↓
Serverless NEG (neg-genova-frontend)
    ↓
Cloud Run: genova-frontend
```

#### Frontend → Backend

```
genova-frontend.run.app
    ↓ HTTPS (443)
genova-ai-backend.run.app (Public 접근 가능)
    ↓
Cloud SQL / GCS / Redis
```

#### CORS 설정

Backend에서 Frontend origin 허용:

```python
# backend/app/main.py
origins = [
    "https://agriedu.genaion.net",  # Custom Domain (Primary)
    "https://genova.genaion.net",   # Custom Domain (Alternative)
    "https://genova-frontend-987680405347.asia-northeast3.run.app",
    "http://localhost:3000",  # 로컬 개발
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

GCS CORS 설정:

```bash
# backend/cors.json
gsutil cors set cors.json gs://genova-ai-project-genova-videos

# CORS 허용 도메인:
# - https://agriedu.genaion.net
# - https://genova.genaion.net
# - https://genova-frontend-987680405347.asia-northeast3.run.app
```

### 외부 연결

```bash
# Cloud Run → Cloud SQL
# - Unix Domain Socket 사용 (/cloudsql/...)
# - Private IP 불필요

# Cloud Run → GCS
# - 공용 API 엔드포인트 사용
# - Service Account 인증

# Cloud Run → Vertex AI
# - 공용 API 엔드포인트 (us-central1)
# - Service Account 인증

# Cloud Run → Redis (Upstash)
# - 공용 인터넷 연결
# - TLS 암호화 (rediss://)
```

---

## 4. 💻 컴퓨팅 리소스

### Cloud Run Services

#### Frontend Service

```yaml
Service: genova-frontend
Region: asia-northeast3
Image: gcr.io/genova-ai-project/genova-frontend:latest

Resources:
  CPU: 1 vCPU (1000m)
  Memory: 1Gi
  Timeout: 300s

Scaling:
  Min Instances: 0
  Max Instances: 10
  Max Concurrency: 80

Network:
  Ingress: Internal and Cloud Load Balancing
    (Load Balancer를 통해서만 접근 가능)
  Egress: All

Load Balancer Integration:
  Backend Service: be-genova-frontend
  Network Endpoint Group: neg-genova-frontend
  Custom Domains:
    - agriedu.genaion.net
    - genova.genaion.net

URLs:
  - https://agriedu.genaion.net (Primary)
  - https://genova.genaion.net (Primary)
  - https://genova-frontend-6frp4obakq-du.a.run.app (Direct, Internal only)

Authentication:
  Allow unauthenticated: Yes
```

#### Backend Service

```yaml
Service: genova-ai-backend
Region: asia-northeast3
Image: asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest

Resources:
  CPU: 4 vCPU (4000m)
  Memory: 8Gi
  Timeout: 3600s
  CPU Boost: Enabled

Scaling:
  Min Instances: 0
  Max Instances: 10
  Max Concurrency: 10

Network:
  Ingress: All
  Egress: All
  Cloud SQL Connections:
    - genova-ai-project:asia-northeast3:genova-postgres

Authentication:
  Allow unauthenticated: Yes
  Service Account: genova-backend-sa@genova-ai-project.iam.gserviceaccount.com
```

### 리소스 최적화

```bash
# Frontend: 가벼운 Next.js SSR
# - 1 vCPU, 1GB RAM 충분
# - Cold Start: 5-15초

# Backend: 동영상 처리, AI 호출
# - 4 vCPU, 8GB RAM (동영상 인코딩 및 처리)
# - Cold Start: 5-20초
# - CPU Boost로 시작 시간 단축
```

---

## 5. 💾 데이터베이스 및 스토리지

### Cloud SQL (PostgreSQL)

```yaml
Instance Name: genova-postgres
Database Version: PostgreSQL 15
Region: asia-northeast3
Zone: asia-northeast3-a

Machine Type:
  Type: db-f1-micro
  vCPUs: Shared (0.6GB RAM)
  Memory: 0.6GB

Storage:
  Type: SSD
  Capacity: 10GB
  Auto-increase: Enabled
  Max: 100GB

High Availability:
  Enabled: No (Dev 환경)

Backups:
  Automated: Daily at 02:00 KST
  Retention: 7 days
  Point-in-time recovery: Disabled (Dev)

Maintenance Window:
  Day: Sunday
  Hour: 03:00-04:00 KST

Connections:
  Public IP: Disabled
  Private IP: Disabled
  Cloud SQL Proxy: Enabled (Unix Socket)
```

### Cloud Storage (GCS)

```yaml
Bucket Name: genova-ai-project-genova-videos
Location Type: Region
Location: asia-northeast3 (Seoul)
Storage Class: Standard

Access Control:
  Type: Uniform (IAM only)
  Public Access: Prevention enabled

Lifecycle Rules:
  - Delete temp/ files after 7 days

Versioning: Disabled

Encryption:
  Type: Google-managed

CORS:
  Allowed Origins:
    - https://genova-frontend-987680405347.asia-northeast3.run.app
  Allowed Methods: GET, HEAD, PUT, POST
  Max Age: 3600s
```

### Redis (Upstash)

```yaml
Provider: Upstash (External)
Type: Redis 7
Region: ap-northeast-1 (Tokyo)
Plan: Free Tier

Limits:
  Max Commands: 10,000/day
  Max Storage: 256MB
  Max Concurrent Connections: 100

Connection:
  Protocol: TLS (rediss://)
  URL: Stored in Secret Manager (dev-redis-url)

Usage:
  - Session caching
  - API rate limiting
  - Temporary data storage
```

---

## 6. 🔐 보안 및 IAM

### Service Accounts

#### Backend Service Account

```bash
# Name: genova-backend-sa
# Email: genova-backend-sa@genova-ai-project.iam.gserviceaccount.com

# Roles:
gcloud projects add-iam-policy-binding genova-ai-project \
  --member="serviceAccount:genova-backend-sa@genova-ai-project.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding genova-ai-project \
  --member="serviceAccount:genova-backend-sa@genova-ai-project.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding genova-ai-project \
  --member="serviceAccount:genova-backend-sa@genova-ai-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding genova-ai-project \
  --member="serviceAccount:genova-backend-sa@genova-ai-project.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

#### Frontend Service Account

```bash
# 기본 Compute Engine Service Account 사용
# Email: 987680405347-compute@developer.gserviceaccount.com

# Roles: (최소 권한)
# - roles/run.invoker (자동)
```

### Secret Manager

```bash
# Secret 목록
gcloud secrets list --project=genova-ai-project

# Secrets:
# 1. dev-db-password
# 2. dev-gemini-api-key
# 3. dev-api-keys
# 4. dev-redis-url
# 5. dev-next-public-api-key

# Secret 권한 확인
gcloud secrets get-iam-policy dev-db-password
```

### IAM 베스트 프랙티스

```bash
# 1. 최소 권한 원칙
# - Service Account별 필요한 권한만 부여

# 2. Secret 접근 제어
# - Secret Manager에 민감 정보 저장
# - 환경 변수에 직접 노출 금지

# 3. 서비스 간 인증
# - Cloud Run → Cloud SQL: Unix Socket
# - Cloud Run → GCS: Service Account
# - Frontend → Backend: API Key

# 4. 사용자 인증
# - Firebase Authentication
# - Backend API Key 검증
```

---

## 7. 🔄 CI/CD 파이프라인

### Cloud Build 구성

#### Backend Build Trigger

```yaml
# 트리거 이름: backend-dev-deploy
# 리포지토리: GitHub (ax-axmvp/genova-ai)
# 브랜치: main
# 빌드 구성: backend/cloudbuild.yaml

# 수동 트리거:
cd backend
gcloud builds submit --config=cloudbuild.yaml
```

#### Frontend Build Trigger

```yaml
# 트리거 이름: frontend-dev-deploy
# 리포지토리: GitHub (ax-axmvp/genova-ai)
# 브랜치: main
# 빌드 구성: frontend/cloudbuild.yaml

# 수동 트리거:
cd frontend
gcloud builds submit --config=cloudbuild.yaml
```

### 배포 파이프라인

```
┌─────────────┐
│   Git Push  │
│  to main    │
└──────┬──────┘
       │ (수동 트리거)
       ▼
┌─────────────────┐
│  Cloud Build    │
│  - Build Image  │
│  - Push to      │
│    Registry     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Deploy to      │
│  Cloud Run      │
│  (Backend만     │
│   자동 배포)    │
└─────────────────┘
```

### Artifact Registry

```bash
# Registry 정보
REGISTRY=asia-northeast3-docker.pkg.dev
PROJECT=genova-ai-project
REPOSITORY=genova-ai

# 이미지 목록 확인
gcloud artifacts docker images list \
  ${REGISTRY}/${PROJECT}/${REPOSITORY}

# Backend 이미지:
# asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest

# Frontend 이미지:
# gcr.io/genova-ai-project/genova-frontend:latest
```

---

## 8. 💰 비용 관리

### 월간 예상 비용 (Dev 환경)

| 서비스 | 예상 비용 | 설명 |
|--------|-----------|------|
| **Cloud Run (Backend)** | $60-100 | CPU 4, Memory 8Gi, 저사용량 |
| **Cloud Run (Frontend)** | $10-20 | CPU 1, Memory 1Gi, 저사용량 |
| **Cloud SQL** | $7-15 | db-f1-micro, 상시 실행 |
| **Cloud Storage** | $5-10 | Standard, 50GB 가정 |
| **Redis (Upstash)** | $0 | Free Tier (10K commands/day) |
| **Vertex AI** | $20-50 | Gemini API 호출량에 따라 |
| **Secret Manager** | $1 | 5개 시크릿 |
| **기타** | $10-20 | 네트워크, 로깅 등 |
| **총 예상 비용** | **$113-216/월** | 사용량에 따라 변동 |

### 비용 절감 전략

```bash
# 1. Cloud Run Min Instances = 0
# - Cold Start 허용으로 유휴 시간 비용 절감

# 2. Cloud SQL 최소 사양 사용
# - Dev 환경은 db-f1-micro (가장 저렴)
# - 프로덕션 시 db-custom-2-7680 이상 권장

# 3. GCS Lifecycle Policy
# - temp/ 디렉토리 자동 삭제 (7일)

# 4. 로깅 보관 기간
# - 기본 30일 → 7일로 단축 고려

# 5. 개발 시간 외 리소스 중지 (선택)
# - Cloud SQL 중지/시작 스크립트
```

### 비용 모니터링

```bash
# Cloud Console > Billing > Reports
# https://console.cloud.google.com/billing/

# 예산 알림 설정
# - 예산: $250/월
# - 알림: 50%, 90%, 100%

# 비용 분석
gcloud billing accounts list
gcloud billing projects describe genova-ai-project
```

---

## 9. 🚨 재해 복구

### 백업 전략

#### Database Backup

```bash
# 자동 백업: 매일 02:00 KST
# 보관 기간: 7일

# 수동 백업 생성
gcloud sql backups create \
  --instance=genova-postgres \
  --project=genova-ai-project

# 백업 목록
gcloud sql backups list --instance=genova-postgres

# 백업 복원 (재해 발생 시)
gcloud sql backups restore BACKUP_ID \
  --backup-instance=genova-postgres
```

#### Storage Backup

```bash
# 버전 관리 미활성화 (비용 절감)
# 중요 파일은 주기적으로 다른 버킷/리전에 복제 권장

# 다른 버킷으로 복사 (재해 복구용)
gsutil -m rsync -r \
  gs://genova-ai-project-genova-videos/ \
  gs://genova-ai-project-backup-us/
```

#### Container Images

```bash
# Artifact Registry는 자동으로 이미지 보관
# 수동 삭제하지 않는 한 영구 보관

# 이미지 목록 및 태그
gcloud artifacts docker images list \
  asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend
```

### 재해 복구 절차

#### 시나리오 1: Cloud Run 서비스 다운

```bash
# 1. 로그 확인
gcloud run services logs read genova-ai-backend --limit=100

# 2. 이전 리비전으로 롤백
gcloud run services update-traffic genova-ai-backend \
  --to-revisions=PREVIOUS-REVISION=100

# 3. 서비스 재시작
gcloud run services update genova-ai-backend \
  --region=asia-northeast3
```

#### 시나리오 2: Cloud SQL 장애

```bash
# 1. 인스턴스 상태 확인
gcloud sql instances describe genova-postgres

# 2. 인스턴스 재시작
gcloud sql instances restart genova-postgres

# 3. 백업에서 복원 (필요시)
gcloud sql backups restore BACKUP_ID \
  --backup-instance=genova-postgres
```

#### 시나리오 3: 전체 리전 장애

```bash
# 다른 리전에 재배포 (예: us-west1)
# 1. Cloud SQL 복제본 생성 (사전 준비 권장)
# 2. GCS 다른 리전 버킷에 복제
# 3. Cloud Run 서비스 다른 리전 배포

# 수동 단계:
# - DNS 변경 (커스텀 도메인 사용 시)
# - 프론트엔드 환경 변수 업데이트
```

### RTO/RPO 목표

```
RTO (Recovery Time Objective): 4시간
RPO (Recovery Point Objective): 24시간 (Daily Backup)

- Dev 환경이므로 관대한 목표 설정
- 프로덕션 환경은 더 엄격한 목표 필요
```

---

## 📞 추가 정보

### 관련 문서

- [Backend Dev 가이드](./DEV_BACKEND_GUIDE.md)
- [Frontend Dev 가이드](./DEV_FRONTEND_GUIDE.md)
- [로컬 셋업 가이드](./LOCAL_SETUP_GUIDE.md)

### GCP Console 링크

- [프로젝트 대시보드](https://console.cloud.google.com/home/dashboard?project=genova-ai-project)
- [Cloud Run](https://console.cloud.google.com/run?project=genova-ai-project)
- [Cloud SQL](https://console.cloud.google.com/sql?project=genova-ai-project)
- [Cloud Storage](https://console.cloud.google.com/storage?project=genova-ai-project)
- [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=genova-ai-project)
- [IAM & Admin](https://console.cloud.google.com/iam-admin?project=genova-ai-project)
- [Cloud Build](https://console.cloud.google.com/cloud-build?project=genova-ai-project)
- [Billing](https://console.cloud.google.com/billing?project=genova-ai-project)
- [Monitoring](https://console.cloud.google.com/monitoring?project=genova-ai-project)
- [Logs Explorer](https://console.cloud.google.com/logs?project=genova-ai-project)

### 현재 인프라 상태

#### ✅ 적용된 설정

1. **Custom Domain 및 SSL**
   - ✅ 커스텀 도메인: agriedu.genaion.net, genova.genaion.net
   - ✅ Google Managed SSL 인증서
   - ✅ Cloud Load Balancer 구성
   - ✅ HTTP → HTTPS 자동 리다이렉트
   - ✅ Static IP: 136.110.153.12

2. **Load Balancer 및 보안**
   - ✅ Backend Service + Serverless NEG
   - ✅ URL Map 및 HTTPS Proxy
   - ✅ Frontend Ingress 제한 (Internal + LB only)
   - ✅ Cloud Armor (Geo-blocking: 한국 외 지역 차단)

3. **기본 인프라**
   - ✅ Cloud Run (Frontend/Backend)
   - ✅ Cloud SQL (PostgreSQL 15)
   - ✅ Cloud Storage (Regional)
   - ✅ Secret Manager
   - ✅ Artifact Registry
   - ✅ Cloud Build CI/CD

---

## 연락처

- **Project**: Genova AI - AX AgriEdu Platform
- **Organization**: ax-axmvp
- **GCP Project ID**: genova-ai-project
- **Support**: [프로젝트 관리자 연락처]
