# AX AgriEdu (Genova AI) 개발 환경 인수인계 체크리스트

## 프로젝트 개요

현재 백엔드(backend)와 프론트엔드(frontend)가 GCP Cloud Run에 배포되어 있는 개발 환경입니다.

**GCP Project**: genova-ai-project
**환경**: Development/Testing
**배포 방식**: GCP Cloud Run
**데이터베이스**: Cloud SQL (PostgreSQL)
**캐시**: Redis (Upstash 또는 Cloud Memorystore)
**Git 저장소**: genova-ai (Secret Manager 이관 후 연동 예정)

---

## 0. 프로젝트 구조 정리 (진행 중)

### 0.1 폴더 이름 변경

- [ ] `axmvp-agriedu-front` → `frontend`로 이름 변경
- [ ] `ax-agriedu-back-v3` → `backend`로 이름 변경

### 0.2 .gitignore 파일 생성/업데이트

루트 디렉토리에 `.gitignore` 생성:

```gitignore
# 환경 변수 파일
.env
.env.*
!.env.example
backend/deployment/config/.env.production
frontend/.env.local

# 서비스 어카운트 키
*.json
!package.json
!tsconfig.json
!package-lock.json
!yarn.lock

# Python
__pycache__/
*.py[cod]
.venv/
venv/
*.pyc
*.pyo
*.egg-info/

# Node.js
node_modules/
.next/
out/
dist/
build/

# 로그 파일
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS 파일
.DS_Store
Thumbs.db
*.swp
*.swo
*~

# IDE 설정
.vscode/
.idea/
*.code-workspace

# 테스트 및 커버리지
coverage/
.coverage
htmlcov/
.pytest_cache/

# 기타
.cache/
temp/
tmp/
```

- [ ] 루트 `.gitignore` 파일 생성
- [ ] 민감한 파일이 포함되지 않도록 확인

---

## 1. Secret Manager 마이그레이션 (최우선)

### 1.1 Secret Manager 기본 설정

```bash
# GCP 프로젝트 설정
export PROJECT_ID="genova-ai-project"
gcloud config set project $PROJECT_ID

# Secret Manager API 활성화
gcloud services enable secretmanager.googleapis.com

# Cloud Build 서비스 계정 확인
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Cloud Build 서비스 계정에 Secret Manager 접근 권한 부여
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Run 서비스 계정에도 권한 부여 (백엔드용)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:genova-backend-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

- [ ] GCP 프로젝트 설정 (`genova-ai-project`)
- [ ] Secret Manager API 활성화
- [ ] Cloud Build 서비스 계정 권한 설정
- [ ] Cloud Run 서비스 계정 권한 설정

### 1.2 프론트엔드 Secrets 생성

**현재 하드코딩된 값들** (`frontend/cloudbuild.yaml`):

```bash
# API 키
echo -n "nn1ezEkJImlE+/kj1vCqvhSS+6i41+caXIXat1Y7AMo=" | \
  gcloud secrets create NEXT_PUBLIC_API_KEY --data-file=- --project=$PROJECT_ID

# Firebase 설정
echo -n "AIzaSyA2HOaStGSfquR7e1NlPp7LglLtqvTQXCs" | \
  gcloud secrets create NEXT_PUBLIC_FIREBASE_API_KEY --data-file=- --project=$PROJECT_ID

echo -n "genova-ai-project.firebaseapp.com" | \
  gcloud secrets create NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN --data-file=- --project=$PROJECT_ID

echo -n "genova-ai-project" | \
  gcloud secrets create NEXT_PUBLIC_FIREBASE_PROJECT_ID --data-file=- --project=$PROJECT_ID

echo -n "genova-ai-project.firebasestorage.app" | \
  gcloud secrets create NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET --data-file=- --project=$PROJECT_ID

echo -n "987680405347" | \
  gcloud secrets create NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --data-file=- --project=$PROJECT_ID

echo -n "1:987680405347:web:de155bc342c02608c50556" | \
  gcloud secrets create NEXT_PUBLIC_FIREBASE_APP_ID --data-file=- --project=$PROJECT_ID
```

- [ ] `NEXT_PUBLIC_API_KEY` secret 생성
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` secret 생성
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` secret 생성
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` secret 생성
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` secret 생성
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` secret 생성
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID` secret 생성

### 1.3 백엔드 Secrets 생성

**필요한 secrets** (`backend/.env.example` 참고):

```bash
# 데이터베이스 비밀번호 (deployment/config/.env.production에서 확인)
echo -n "YOUR_DB_PASSWORD" | \
  gcloud secrets create DB_PASSWORD --data-file=- --project=$PROJECT_ID

# GenAI API 키
echo -n "YOUR_GENAI_API_KEY" | \
  gcloud secrets create GENAI_API_KEY --data-file=- --project=$PROJECT_ID

# 백엔드 API 키
echo -n "YOUR_API_KEYS" | \
  gcloud secrets create API_KEYS --data-file=- --project=$PROJECT_ID

# Redis URL (Upstash 또는 Cloud Memorystore)
echo -n "redis://host:port" | \
  gcloud secrets create REDIS_URL --data-file=- --project=$PROJECT_ID
```

- [ ] `backend/deployment/config/.env.production`에서 실제 값 확인
- [ ] `DB_PASSWORD` secret 생성
- [ ] `GENAI_API_KEY` secret 생성
- [ ] `API_KEYS` secret 생성
- [ ] `REDIS_URL` secret 생성

### 1.4 프론트엔드 cloudbuild.yaml 업데이트

`frontend/cloudbuild.yaml` 파일 수정:

```yaml
steps:
  # Docker 이미지 빌드
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=https://genova-ai-backend-987680405347.asia-northeast3.run.app'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_KEY=$$NEXT_PUBLIC_API_KEY'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_API_KEY=$$NEXT_PUBLIC_FIREBASE_API_KEY'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_PROJECT_ID=$$NEXT_PUBLIC_FIREBASE_PROJECT_ID'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_APP_ID=$$NEXT_PUBLIC_FIREBASE_APP_ID'
      - '-t'
      - 'gcr.io/$PROJECT_ID/genova-frontend:latest'
      - '.'
    secretEnv:
      - NEXT_PUBLIC_API_KEY
      - NEXT_PUBLIC_FIREBASE_API_KEY
      - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      - NEXT_PUBLIC_FIREBASE_PROJECT_ID
      - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
      - NEXT_PUBLIC_FIREBASE_APP_ID

  # 이미지를 GCR에 푸시
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/genova-frontend:latest'

images:
  - 'gcr.io/$PROJECT_ID/genova-frontend:latest'

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_API_KEY/versions/latest
      env: NEXT_PUBLIC_API_KEY
    - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_API_KEY/versions/latest
      env: NEXT_PUBLIC_FIREBASE_API_KEY
    - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/versions/latest
      env: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_PROJECT_ID/versions/latest
      env: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/versions/latest
      env: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID/versions/latest
      env: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    - versionName: projects/$PROJECT_ID/secrets/NEXT_PUBLIC_FIREBASE_APP_ID/versions/latest
      env: NEXT_PUBLIC_FIREBASE_APP_ID

timeout: 1200s
```

- [ ] `frontend/cloudbuild.yaml` 파일 백업
- [ ] `substitutions` 섹션 제거
- [ ] `secretEnv` 추가
- [ ] `availableSecrets` 섹션 추가
- [ ] 테스트 빌드 실행: `cd frontend && gcloud builds submit --config=cloudbuild.yaml`

### 1.5 백엔드 cloudbuild.yaml 생성

`backend/cloudbuild.yaml` 신규 생성:

```yaml
steps:
  # Docker 이미지 빌드
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--platform'
      - 'linux/amd64'
      - '-t'
      - 'asia-northeast3-docker.pkg.dev/$PROJECT_ID/genova-ai/backend:latest'
      - '-f'
      - 'Dockerfile'
      - '.'

  # 이미지를 Artifact Registry에 푸시
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'asia-northeast3-docker.pkg.dev/$PROJECT_ID/genova-ai/backend:latest'

  # Cloud Run 배포
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'genova-ai-backend'
      - '--image=asia-northeast3-docker.pkg.dev/$PROJECT_ID/genova-ai/backend:latest'
      - '--platform=managed'
      - '--region=asia-northeast3'
      - '--service-account=genova-backend-sa@$PROJECT_ID.iam.gserviceaccount.com'
      - '--memory=4Gi'
      - '--cpu=2'
      - '--timeout=3600'
      - '--concurrency=10'
      - '--min-instances=0'
      - '--max-instances=10'
      - '--allow-unauthenticated'
      - '--update-secrets=DB_PASSWORD=DB_PASSWORD:latest'
      - '--update-secrets=GENAI_API_KEY=GENAI_API_KEY:latest'
      - '--update-secrets=API_KEYS=API_KEYS:latest'
      - '--update-secrets=REDIS_URL=REDIS_URL:latest'
      - '--set-env-vars=GOOGLE_CLOUD_PROJECT=$PROJECT_ID'
      - '--set-env-vars=GOOGLE_CLOUD_LOCATION=asia-northeast3'
      - '--set-env-vars=GOOGLE_CLOUD_LOCATION_VERTEX_AI=us-central1'
      - '--add-cloudsql-instances=genova-ai-project:asia-northeast3:genova-postgres'
      - '--cpu-boost'

images:
  - 'asia-northeast3-docker.pkg.dev/$PROJECT_ID/genova-ai/backend:latest'

timeout: 1800s
```

- [ ] `backend/cloudbuild.yaml` 파일 생성
- [ ] Cloud SQL 인스턴스 연결 이름 확인 및 업데이트
- [ ] 테스트 빌드 실행: `cd backend && gcloud builds submit --config=cloudbuild.yaml`

### 1.6 Secret Manager 검증

```bash
# 생성된 모든 secrets 확인
gcloud secrets list --project=$PROJECT_ID

# 특정 secret 값 확인 (테스트)
gcloud secrets versions access latest --secret="NEXT_PUBLIC_API_KEY" --project=$PROJECT_ID
```

- [ ] 모든 secrets가 생성되었는지 확인
- [ ] Secret 값이 올바른지 확인

---

## 2. Git 저장소 구성

### 2.1 루트 README.md 작성

`README.md` 생성:

```markdown
# Genova AI - AX AgriEdu Platform

AI 기반 농업 교육 동영상 분석 플랫폼

## 프로젝트 구조

```
genova-ai/
├── frontend/          # Next.js 프론트엔드
├── backend/           # FastAPI 백엔드
├── docs/              # 문서 모음
├── .gitignore         # Git 제외 파일
└── README.md          # 프로젝트 개요
```

## 기술 스택

### Frontend
- Next.js 14
- React 18
- TypeScript
- Emotion (styled-components)
- Zustand (상태 관리)
- React Query
- Firebase (인증)

### Backend
- FastAPI
- Python 3.11+
- PostgreSQL (Cloud SQL)
- Redis (Upstash/Cloud Memorystore)
- Google Cloud Platform
  - Cloud Run
  - Vertex AI (Gemini)
  - Cloud Storage
  - Cloud Translation

## GCP 환경

- **Project**: genova-ai-project
- **Region**: asia-northeast3
- **Frontend URL**: https://genova-frontend-987680405347.asia-northeast3.run.app
- **Backend URL**: https://genova-ai-backend-987680405347.asia-northeast3.run.app

## 빠른 시작

### 로컬 개발 환경

각 디렉토리의 README를 참고하세요:
- [프론트엔드 개발 가이드](./frontend/README.md)
- [백엔드 개발 가이드](./backend/README.md)

### 배포

자동 배포: `main` 브랜치에 푸시하면 Cloud Build가 자동으로 배포합니다.

수동 배포:
```bash
# 프론트엔드
cd frontend && gcloud builds submit --config=cloudbuild.yaml

# 백엔드
cd backend && gcloud builds submit --config=cloudbuild.yaml
```

## 문서

- [인수인계 체크리스트](./docs/todo.md)
- [인프라 문서](./docs/infrastructure.md)
- [배포 가이드](./docs/deployment.md)
- [트러블슈팅](./docs/troubleshooting.md)

## 라이선스

Proprietary
```

- [ ] 루트 `README.md` 작성

### 2.2 프론트엔드 README 작성

`frontend/README.md` 생성:

```markdown
# Genova AI Frontend

Next.js 기반 프론트엔드 애플리케이션

## 로컬 개발 환경 설정

### 1. 환경 변수 설정

`.env.local` 파일 생성:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=your-api-key-here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=genova-ai-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=genova-ai-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=genova-ai-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987680405347
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 2. 의존성 설치

```bash
yarn install
```

### 3. 개발 서버 실행

```bash
yarn dev
```

브라우저에서 http://localhost:3000 열기

### 4. 빌드

```bash
yarn build
yarn start
```

## 배포

### Cloud Build를 통한 배포

```bash
gcloud builds submit --config=cloudbuild.yaml
```

### 직접 배포 (수동)

1. Docker 이미지 빌드
2. GCR에 푸시
3. Cloud Run 배포

자세한 내용은 [배포 가이드](../docs/deployment.md) 참고

## 프로젝트 구조

```
frontend/
├── public/           # 정적 파일
├── src/
│   ├── app/          # Next.js App Router
│   ├── components/   # 공통 컴포넌트
│   └── shared/       # 유틸리티, 훅
├── Dockerfile
├── cloudbuild.yaml
└── package.json
```
```

- [ ] `frontend/README.md` 작성

### 2.3 백엔드 README 작성

`backend/README.md` 생성:

```markdown
# Genova AI Backend

FastAPI 기반 백엔드 API 서버

## 로컬 개발 환경 설정

### 1. Python 가상환경 설정

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정

`.env` 파일 생성 (`.env.example` 참고):

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
GCS_BUCKET_NAME=your-bucket-name

# AI Services
GENAI_API_KEY=your-genai-api-key
VERTEX_AI_MODEL=gemini-3-flash-preview

# API Security
API_KEYS=your-api-key-here

# CORS
CORS_ORIGINS=http://localhost:3000
```

### 4. 로컬 데이터베이스 실행

Docker Compose 사용:

```bash
# docker-compose.yml 파일이 있는 경우
docker-compose up -d postgres redis
```

또는 개별 실행:

```bash
# PostgreSQL
docker run -d --name genova-postgres \
  -e POSTGRES_USER=genova_user \
  -e POSTGRES_PASSWORD=genova_password \
  -e POSTGRES_DB=genova_ai \
  -p 5432:5432 \
  postgres:15

# Redis
docker run -d --name genova-redis \
  -p 6379:6379 \
  redis:7
```

### 5. 데이터베이스 마이그레이션

```bash
# Alembic 사용 (설정된 경우)
alembic upgrade head
```

### 6. 서버 실행

```bash
uvicorn app.main:app --reload --port 8000
```

API 문서: http://localhost:8000/docs

## 배포

### Cloud Build를 통한 배포

```bash
gcloud builds submit --config=cloudbuild.yaml
```

## 프로젝트 구조

```
backend/
├── app/
│   ├── api/          # API 라우터
│   ├── core/         # 설정, 보안
│   ├── models/       # 데이터베이스 모델
│   ├── services/     # 비즈니스 로직
│   └── main.py       # FastAPI 앱
├── deployment/       # 배포 스크립트
├── Dockerfile
├── cloudbuild.yaml
└── requirements.txt
```
```

- [ ] `backend/README.md` 작성

### 2.4 Git 저장소 초기화

```bash
# 루트 디렉토리에서
cd "C:\Users\류중경\goldenplanet\ax-agriedu-handover"

# 기존 .git 디렉토리 백업 (있는 경우)
# mv frontend/.git frontend/.git.backup
# mv backend/.git backend/.git.backup

# 새 Git 저장소 초기화
git init

# .gitignore 확인
cat .gitignore

# 민감 정보 제외 확인
git status

# 초기 커밋
git add .
git commit -m "chore: initial commit - project structure setup

- Renamed folders: axmvp-agriedu-front -> frontend, ax-agriedu-back-v3 -> backend
- Migrated secrets to GCP Secret Manager
- Updated cloudbuild.yaml files for both frontend and backend
- Added comprehensive documentation"

# Remote 추가 (genova-ai 저장소 생성 후)
git remote add origin https://github.com/YOUR_ORG/genova-ai.git
git branch -M main
git push -u origin main
```

- [ ] `.gitignore` 파일 확인
- [ ] 민감 정보가 포함되지 않았는지 재확인
- [ ] Git 저장소 초기화
- [ ] GitHub/GitLab에 `genova-ai` 저장소 생성
- [ ] Remote 설정 및 푸시

---

## 3. Cloud Build 트리거 설정

### 3.1 프론트엔드 트리거

```bash
# GitHub 연동 후
gcloud builds triggers create github \
  --name="deploy-frontend-dev" \
  --repo-name="genova-ai" \
  --repo-owner="YOUR_ORG" \
  --branch-pattern="^main$" \
  --build-config="frontend/cloudbuild.yaml" \
  --project=genova-ai-project
```

- [ ] GitHub `genova-ai` 저장소 생성
- [ ] GCP와 GitHub 연동
- [ ] 프론트엔드 배포 트리거 생성
- [ ] 트리거 테스트 (Git push 후 배포 확인)

### 3.2 백엔드 트리거

```bash
gcloud builds triggers create github \
  --name="deploy-backend-dev" \
  --repo-name="genova-ai" \
  --repo-owner="YOUR_ORG" \
  --branch-pattern="^main$" \
  --build-config="backend/cloudbuild.yaml" \
  --project=genova-ai-project
```

- [ ] 백엔드 배포 트리거 생성
- [ ] 트리거 테스트

---

## 4. 인프라 문서화

### 4.1 인프라 문서 작성

`docs/infrastructure.md` 생성:

```markdown
# Genova AI - 인프라 구성

## GCP 프로젝트
- **Project ID**: genova-ai-project
- **Project Number**: 987680405347
- **Region**: asia-northeast3

## Cloud Run 서비스

### Frontend
- **Service Name**: genova-frontend
- **URL**: https://genova-frontend-987680405347.asia-northeast3.run.app
- **Image**: gcr.io/genova-ai-project/genova-frontend:latest
- **Memory**: 512Mi (기본)
- **CPU**: 1 (기본)

### Backend
- **Service Name**: genova-ai-backend
- **URL**: https://genova-ai-backend-987680405347.asia-northeast3.run.app
- **Image**: asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest
- **Memory**: 4Gi
- **CPU**: 2
- **Timeout**: 3600s
- **Concurrency**: 10
- **Min Instances**: 0
- **Max Instances**: 10

## Cloud SQL
- **Instance Name**: genova-postgres
- **Database**: genova_ai
- **Version**: PostgreSQL 15
- **Tier**: db-f1-micro
- **Region**: asia-northeast3
- **Private IP**: Yes
- **Backup Time**: 03:00 UTC
- **Connection Name**: genova-ai-project:asia-northeast3:genova-postgres

## Cloud Storage
- **Bucket Name**: genova-ai-project-genova-videos
- **Location**: asia-northeast3
- **Storage Class**: Standard
- **Lifecycle**: 90일 후 삭제 (uploaded_tmp/)

## Redis
- **Type**: Upstash 또는 Cloud Memorystore
- **Instance**: genova-redis (Cloud Memorystore 사용 시)
- **Version**: Redis 7.0
- **Tier**: Basic
- **Size**: 1GB

## Artifact Registry
- **Repository**: genova-ai
- **Location**: asia-northeast3
- **Format**: Docker

## VPC & Networking
- **VPC Connector**: genova-vpc-connector
- **Network**: default
- **IP Range**: 10.8.0.0/28

## Service Accounts
- **Backend SA**: genova-backend-sa@genova-ai-project.iam.gserviceaccount.com
  - Roles:
    - Cloud SQL Client
    - Storage Object Admin
    - Vertex AI User
    - Cloud Translation User

## Firebase
- **Project**: genova-ai-project
- **Web App ID**: 1:987680405347:web:de155bc342c02608c50556

## Secret Manager
- NEXT_PUBLIC_API_KEY
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- DB_PASSWORD
- GENAI_API_KEY
- API_KEYS
- REDIS_URL
```

- [ ] `docs/infrastructure.md` 작성
- [ ] 실제 리소스 정보로 업데이트

### 4.2 배포 가이드 작성

`docs/deployment.md` 작성:

```markdown
# 배포 가이드

## 자동 배포 (권장)

`main` 브랜치에 푸시하면 Cloud Build 트리거가 자동으로 배포를 시작합니다.

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

배포 진행 상황 확인:
- GCP Console > Cloud Build > History

## 수동 배포

### 프론트엔드

```bash
cd frontend
gcloud builds submit --config=cloudbuild.yaml --project=genova-ai-project
```

### 백엔드

```bash
cd backend
gcloud builds submit --config=cloudbuild.yaml --project=genova-ai-project
```

## 배포 검증

### Health Check

```bash
# Frontend
curl https://genova-frontend-987680405347.asia-northeast3.run.app

# Backend
curl https://genova-ai-backend-987680405347.asia-northeast3.run.app/health
```

### API 문서 확인

https://genova-ai-backend-987680405347.asia-northeast3.run.app/docs

## 로그 확인

```bash
# 프론트엔드 로그
gcloud run services logs read genova-frontend \
  --region=asia-northeast3 \
  --project=genova-ai-project \
  --limit=50

# 백엔드 로그
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --project=genova-ai-project \
  --limit=50
```

## 롤백

```bash
# 이전 리비전으로 롤백
gcloud run services update-traffic SERVICE_NAME \
  --to-revisions=REVISION_NAME=100 \
  --region=asia-northeast3 \
  --project=genova-ai-project
```
```

- [ ] `docs/deployment.md` 작성

### 4.3 트러블슈팅 가이드

`docs/troubleshooting.md` 작성:

```markdown
# 트러블슈팅 가이드

## Cloud Build 실패

### 1. Secret Manager 권한 오류

**증상**: `Permission denied on secret` 오류

**해결**:
```bash
# Cloud Build 서비스 계정 확인
export PROJECT_NUMBER=$(gcloud projects describe genova-ai-project --format='value(projectNumber)')
export CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Secret Manager 권한 부여
gcloud projects add-iam-policy-binding genova-ai-project \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. Docker 빌드 실패

**증상**: `ERROR: failed to solve: process "/bin/sh -c ..."`

**해결**:
- Dockerfile 문법 확인
- 빌드 로그에서 정확한 오류 메시지 확인
- 로컬에서 Docker 빌드 테스트

### 3. 타임아웃 오류

**증상**: `Build timeout exceeded`

**해결**:
- cloudbuild.yaml의 `timeout` 값 증가
- 캐시 활용 확인

## Cloud Run 배포 실패

### 1. 컨테이너 시작 실패

**증상**: `Container failed to start`

**로그 확인**:
```bash
gcloud run services logs read SERVICE_NAME \
  --region=asia-northeast3 \
  --limit=100
```

**일반적인 원인**:
- 환경 변수 누락
- 포트 설정 오류 (프론트엔드: 8080)
- 의존성 설치 실패

### 2. 메모리 부족

**증상**: `Exceeded memory limit`

**해결**:
```bash
gcloud run services update SERVICE_NAME \
  --memory=2Gi \
  --region=asia-northeast3
```

## 데이터베이스 연결 실패

### 1. Cloud SQL 연결 오류

**증상**: `Can't connect to Cloud SQL instance`

**확인사항**:
- Cloud SQL 인스턴스가 실행 중인지 확인
- Cloud SQL Proxy 설정 (로컬)
- VPC Connector 설정 (Cloud Run)
- Service Account 권한 (`roles/cloudsql.client`)

### 2. 데이터베이스 인증 실패

**증상**: `password authentication failed`

**해결**:
- Secret Manager의 DB_PASSWORD 확인
- Cloud SQL 사용자 계정 확인

## Redis 연결 실패

**증상**: `Can't connect to Redis`

**확인사항**:
- Redis 인스턴스 상태 확인 (Upstash/Cloud Memorystore)
- REDIS_URL 환경 변수 확인
- 네트워크 연결 확인

## Firebase 인증 오류

**증상**: `Firebase: Error (auth/...)`

**해결**:
- Firebase 프로젝트 설정 확인
- API 키가 올바른지 확인
- Firebase Console에서 인증 설정 확인

## API 응답 오류

### 1. CORS 오류

**증상**: `Access-Control-Allow-Origin` 오류

**해결**:
- 백엔드 CORS 설정 확인
- `CORS_ORIGINS` 환경 변수에 프론트엔드 URL 추가

### 2. 401 Unauthorized

**증상**: API 호출 시 401 오류

**해결**:
- API 키 확인 (`NEXT_PUBLIC_API_KEY`)
- 백엔드 API 키 설정 확인 (`API_KEYS`)

## 긴급 연락처

- GCP Admin: [이름] <email@example.com>
- 백엔드 담당: [이름] <email@example.com>
- 프론트엔드 담당: [이름] <email@example.com>
```

- [ ] `docs/troubleshooting.md` 작성

---

## 5. 로컬 개발 환경 설정

### 5.1 Docker Compose 설정

루트 디렉토리에 `docker-compose.yml` 생성:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: genova-postgres
    environment:
      POSTGRES_USER: genova_user
      POSTGRES_PASSWORD: genova_password
      POSTGRES_DB: genova_ai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U genova_user -d genova_ai"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: genova-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] `docker-compose.yml` 파일 생성
- [ ] 로컬 환경 테스트: `docker-compose up -d`

### 5.2 환경 변수 예시 파일 업데이트

**프론트엔드** (`frontend/.env.example`):

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=your-api-key-here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=genova-ai-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=genova-ai-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=genova-ai-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987680405347
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
```

**백엔드** (`backend/.env.example`):

```bash
# Application
APP_ENV=development
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql+asyncpg://genova_user:genova_password@localhost:5432/genova_ai
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis
REDIS_URL=redis://localhost:6379/0

# GCP
GOOGLE_CLOUD_PROJECT=genova-ai-project
GOOGLE_CLOUD_LOCATION=asia-northeast3
GOOGLE_CLOUD_LOCATION_VERTEX_AI=us-central1

# Cloud Storage
GCS_BUCKET_NAME=your-bucket-name
GCS_SIGNED_URL_EXPIRY=3600

# AI Services
GENAI_API_KEY=your-genai-api-key
VERTEX_AI_MODEL=gemini-3-flash-preview
SUMMARIZATION_MODEL=gemini-3-flash-preview
TRANSCRIBE_MODEL=gemini-2.0-pro-exp-02-05

# API Security
API_KEYS=your-api-key-here

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# File Upload
MAX_FILE_SIZE=2147483648
ALLOWED_EXTENSIONS=mp4,avi,mov,mkv,webm
```

- [ ] `frontend/.env.example` 업데이트 확인
- [ ] `backend/.env.example` 업데이트 확인

---

## 6. 최종 검증

### 6.1 Secret Manager 검증

```bash
# 모든 secrets 확인
gcloud secrets list --project=genova-ai-project

# 각 secret 접근 테스트
for SECRET in NEXT_PUBLIC_API_KEY DB_PASSWORD GENAI_API_KEY API_KEYS REDIS_URL; do
  echo "Testing $SECRET..."
  gcloud secrets versions access latest --secret="$SECRET" --project=genova-ai-project > /dev/null && echo "✓ $SECRET OK" || echo "✗ $SECRET FAILED"
done
```

- [ ] 모든 secrets 생성 확인
- [ ] 접근 권한 확인

### 6.2 Git 저장소 검증

```bash
# 민감 정보 확인
git status
git log --oneline

# .gitignore 테스트
git check-ignore -v backend/.env
git check-ignore -v frontend/.env.local
git check-ignore -v backend/deployment/config/.env.production
```

- [ ] 민감 정보가 Git에 포함되지 않음을 확인
- [ ] .gitignore가 올바르게 작동하는지 확인

### 6.3 배포 테스트

```bash
# 프론트엔드 배포 테스트
cd frontend
gcloud builds submit --config=cloudbuild.yaml --project=genova-ai-project

# 백엔드 배포 테스트
cd ../backend
gcloud builds submit --config=cloudbuild.yaml --project=genova-ai-project
```

- [ ] 프론트엔드 배포 성공
- [ ] 백엔드 배포 성공
- [ ] Health Check 정상
- [ ] 프론트엔드-백엔드 연동 정상

### 6.4 서비스 검증

```bash
# Frontend Health Check
curl https://genova-frontend-987680405347.asia-northeast3.run.app

# Backend Health Check
curl https://genova-ai-backend-987680405347.asia-northeast3.run.app/health

# API 문서 확인
curl https://genova-ai-backend-987680405347.asia-northeast3.run.app/docs
```

- [ ] 프론트엔드 정상 응답
- [ ] 백엔드 정상 응답
- [ ] API 문서 접근 가능

---

## 7. 인수인계 완료

### 7.1 문서 최종 확인

- [ ] README.md (루트)
- [ ] frontend/README.md
- [ ] backend/README.md
- [ ] docs/infrastructure.md
- [ ] docs/deployment.md
- [ ] docs/troubleshooting.md
- [ ] docs/todo.md (본 문서)

### 7.2 접근 권한 이관

- [ ] GCP 프로젝트 관리자 권한 부여
- [ ] GitHub 저장소 관리자 권한 부여
- [ ] Firebase 관리자 권한 부여

### 7.3 인수인계 미팅

- [ ] 전체 아키텍처 설명
- [ ] Secret Manager 사용법 설명
- [ ] 로컬 개발 환경 시연
- [ ] 배포 프로세스 시연
- [ ] 트러블슈팅 방법 설명
- [ ] Q&A 세션

---

## 작성일: 2026-01-27

**GCP Project**: genova-ai-project
**Git Repository**: genova-ai
**환경**: Development
**작성자**: Claude Code
**상태**: Secret Manager 마이그레이션 대기 중

## 다음 액션

1. **폴더 이름 변경** (수동)
   - `axmvp-agriedu-front` → `frontend`
   - `ax-agriedu-back-v3` → `backend`

2. **Secret Manager 마이그레이션**
   - API 활성화
   - Secrets 생성
   - cloudbuild.yaml 업데이트
   - 배포 테스트

3. **Git 저장소 설정**
   - README 작성
   - 초기 커밋
   - GitHub `genova-ai` 연동

4. **Cloud Build 트리거 설정**
   - 자동 배포 활성화
