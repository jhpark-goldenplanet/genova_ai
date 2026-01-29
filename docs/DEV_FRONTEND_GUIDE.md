# Frontend Dev 환경 인수인계 가이드

Genova AI Frontend의 Dev 환경 배포 및 운영 가이드입니다.

---

## 📋 목차

1. [Dev 환경 개요](#-dev-환경-개요)
2. [배포 프로세스](#-배포-프로세스)
3. [환경 변수 및 Secret 관리](#-환경-변수-및-secret-관리)
4. [Cloud Run 서비스 구성](#-cloud-run-서비스-구성)
5. [Firebase 연동](#-firebase-연동)
6. [모니터링 및 로깅](#-모니터링-및-로깅)
7. [트러블슈팅](#-트러블슈팅)

---

## 1. 🌐 Dev 환경 개요

### 서비스 정보

| 항목 | 값 |
|------|-----|
| **서비스 이름** | `genova-frontend` |
| **GCP 프로젝트** | `genova-ai-project` |
| **리전** | `asia-northeast3` (Seoul) |
| **플랫폼** | Cloud Run (Serverless) |
| **URL** | https://genova-frontend-987680405347.asia-northeast3.run.app |

### 아키텍처 구성

```
┌──────────────────────┐
│   Cloud Run          │
│   (Frontend)         │
│  - Next.js 14        │
│  - Node.js 20        │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐   ┌───▼────────┐
│Backend │   │  Firebase  │
│ API    │   │  Auth      │
└────────┘   └────────────┘
```

### 주요 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Emotion (CSS-in-JS)
- **State Management**: Zustand
- **Data Fetching**: React Query
- **Authentication**: Firebase Auth
- **Video Player**: Video.js
- **HTTP Client**: Axios

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

# 필요한 권한:
# - Cloud Run Admin
# - Cloud Build Editor
# - Secret Manager Secret Accessor
# - Container Registry Service Agent
```

### 배포 스크립트 실행

```bash
cd frontend

# Dev 환경 배포
./deploy-dev.sh
```

### 배포 과정 상세

배포 스크립트는 다음 단계를 자동으로 수행합니다:

#### 1. Docker 이미지 빌드

```yaml
# cloudbuild.yaml 참조
# Build Args (substitutions):
# - NEXT_PUBLIC_API_URL: Backend API URL (기본값)
# - NEXT_PUBLIC_API_KEY: Backend API 인증 키 (substitutions)
# - NEXT_PUBLIC_FIREBASE_*: Firebase 설정 (공개 정보)

# 이미지 위치: GCR (Container Registry)
# - gcr.io/genova-ai-project/genova-frontend:latest
```

**중요**:
- Next.js의 환경 변수는 빌드 타임에 주입되므로, 환경 변수 변경 시 반드시 재빌드가 필요합니다.
- API Key는 cloudbuild.yaml의 `substitutions`로 관리됩니다 (클라이언트 번들에 포함되어 공개됨)

#### 2. Container Registry 푸시

```bash
# 자동으로 다음 레지스트리에 푸시됨
gcr.io/genova-ai-project/genova-frontend:latest
```

#### 3. Cloud Run 배포

cloudbuild.yaml Step #2에서 자동으로 Cloud Run에 배포됩니다.

```bash
# Step #2에서 자동 실행되는 명령
gcloud run deploy genova-frontend \
  --image=gcr.io/genova-ai-project/genova-frontend:latest \
  --platform=managed \
  --region=asia-northeast3 \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=10
```

**참고**: Backend와 동일하게 이미지 빌드 → 푸시 → 배포가 한 번에 자동화되어 있습니다.

### 리소스 설정

| 항목 | 값 | 설명 |
|------|-----|------|
| **Memory** | 1Gi | Next.js SSR/SSG 처리 |
| **CPU** | 1 | 단일 코어 |
| **Timeout** | 300s (5분) | 페이지 렌더링 |
| **Concurrency** | 80 | 동시 요청 수 |
| **Min Instances** | 0 | Cold start 허용 |
| **Max Instances** | 10 | 최대 확장 |

### 수동 배포 (Cloud Build)

스크립트 없이 수동으로 배포:

```bash
cd frontend

# Cloud Build 제출 (이미지만 빌드)
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=genova-ai-project

# Cloud Run 배포
gcloud run deploy genova-frontend \
  --image=gcr.io/genova-ai-project/genova-frontend:latest \
  --region=asia-northeast3 \
  --platform=managed \
  --allow-unauthenticated
```

### 배포 확인

```bash
# 배포 상태 확인
gcloud run services describe genova-frontend \
  --region=asia-northeast3 \
  --format=yaml

# 서비스 접속 확인
curl https://genova-frontend-987680405347.asia-northeast3.run.app

# 브라우저에서 열기
open https://genova-frontend-987680405347.asia-northeast3.run.app
```

---

## 3. 🔐 환경 변수 및 Secret 관리

### 환경 변수 관리

Frontend는 다음 방식으로 환경 변수를 관리합니다:

| 변수 이름 | 관리 방식 | 용도 |
|-----------|----------|------|
| `NEXT_PUBLIC_API_KEY` | cloudbuild.yaml substitutions | Backend API 인증 키 |
| `NEXT_PUBLIC_FIREBASE_*` | cloudbuild.yaml substitutions | Firebase 설정 (공개 정보) |

**참고**:
- Frontend의 `NEXT_PUBLIC_*` 변수는 클라이언트 번들에 포함되어 브라우저에 노출됩니다.
- Secret Manager 대신 `substitutions`를 사용하는 이유는 어차피 공개되는 정보이기 때문입니다.

### Secret 확인 및 수정

```bash
# Secret 목록 조회
gcloud secrets list --project=genova-ai-project

# Secret 값 확인
gcloud secrets versions access latest --secret=dev-next-public-api-key

# Secret 업데이트
echo -n "new-api-key" | gcloud secrets versions add dev-next-public-api-key --data-file=-
```

**중요**: Secret 변경 시 반드시 재배포가 필요합니다. (빌드 타임 환경 변수)

### 빌드 타임 환경 변수

Next.js는 `NEXT_PUBLIC_` prefix가 있는 변수를 클라이언트에 노출합니다.
이러한 변수는 **빌드 타임**에 번들에 포함되므로, 변경 시 재빌드가 필수입니다.

```bash
# cloudbuild.yaml에서 설정됨

# Backend API
NEXT_PUBLIC_API_URL=https://genova-ai-backend-987680405347.asia-northeast3.run.app
NEXT_PUBLIC_API_KEY=${SECRET_FROM_SECRET_MANAGER}

# Firebase (공개 정보)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA2HOaStGSfquR7e1NlPp7LglLtqvTQXCs
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=genova-ai-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=genova-ai-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=genova-ai-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987680405347
NEXT_PUBLIC_FIREBASE_APP_ID=1:987680405347:web:de155bc342c02608c50556
```

### 환경 변수 업데이트 프로세스

```bash
# 1. cloudbuild.yaml 수정
vim frontend/cloudbuild.yaml

# 2. 재배포
cd frontend
./deploy-dev.sh

# 3. Cloud Run 서비스 업데이트 (필요시)
gcloud run deploy genova-frontend \
  --image=gcr.io/genova-ai-project/genova-frontend:latest \
  --region=asia-northeast3
```

---

## 4. ☁️ Cloud Run 서비스 구성

### Service Account

```bash
# 기본 Compute Engine Service Account 사용
# PROJECT_NUMBER-compute@developer.gserviceaccount.com

# 부여된 권한:
# - 기본 Compute Engine 권한
# - Container Registry 읽기
```

### 네트워크 설정

```bash
# Ingress: 모든 트래픽 허용 (all)
# Egress: 모든 외부 연결 허용 (all)

# 외부 연결:
# - Backend API (asia-northeast3)
# - Firebase (전역)
```

### 리소스 제한

```yaml
Resources:
  CPU: 1 core (1000m)
  Memory: 1Gi

Execution:
  Max Instances: 10
  Min Instances: 0
  Max Concurrency: 80
  Timeout: 300s (5분)
```

### Cold Start 최적화

```bash
# Next.js Standalone 빌드 사용
# 빌드 결과물 크기 최소화
# 첫 요청 응답 시간: 5-15초
```

---

## 5. 🔥 Firebase 연동

### Firebase 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트 ID** | `genova-ai-project` |
| **인증 도메인** | `genova-ai-project.firebaseapp.com` |
| **Storage Bucket** | `genova-ai-project.firebasestorage.app` |

### Firebase 설정

Firebase 설정은 `cloudbuild.yaml`에 하드코딩되어 있습니다:

```javascript
// Firebase 초기화 코드 (frontend/src/lib/firebase.ts 등)
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
```

### Firebase Authentication

```bash
# Firebase Console: https://console.firebase.google.com/project/genova-ai-project

# 활성화된 인증 방법:
# - Email/Password
# - Google OAuth (선택사항)

# 승인된 도메인:
# - localhost (개발)
# - genova-frontend-987680405347.asia-northeast3.run.app (Dev)
```

### Firebase 설정 확인

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 확인
firebase projects:list

# 프로젝트 선택
firebase use genova-ai-project

# 설정 확인
firebase apps:list
```

### 인증 도메인 추가

새로운 도메인 배포 시 Firebase 콘솔에서 승인:

```bash
# Firebase Console > Authentication > Settings > Authorized domains
# 새 도메인 추가: your-new-domain.run.app
```

---

## 6. 📊 모니터링 및 로깅

### Cloud Logging

```bash
# 최근 로그 확인
gcloud run services logs read genova-frontend \
  --region=asia-northeast3 \
  --limit=50

# 실시간 로그 스트리밍
gcloud run services logs tail genova-frontend \
  --region=asia-northeast3

# 에러 로그만 필터링
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=genova-frontend AND severity>=ERROR" \
  --limit=50 \
  --format=json
```

### Log Explorer (고급 검색)

```bash
# Cloud Console > Logging > Logs Explorer
# https://console.cloud.google.com/logs/

# 유용한 쿼리:
resource.type="cloud_run_revision"
resource.labels.service_name="genova-frontend"
severity>=ERROR

# 특정 페이지 요청 추적
resource.type="cloud_run_revision"
httpRequest.requestUrl=~"/video"
```

### Cloud Monitoring

```bash
# Cloud Console > Monitoring
# https://console.cloud.google.com/monitoring

# 주요 메트릭:
# - Request Count
# - Request Latency (P50, P95, P99)
# - Error Rate (4xx, 5xx)
# - Instance Count
# - CPU/Memory Utilization
# - Container Startup Latency
```

### 클라이언트 사이드 모니터링

```javascript
// 추천: Google Analytics 4 또는 Sentry 연동

// Next.js Web Vitals 추적
export function reportWebVitals(metric) {
  // CLS, FID, FCP, LCP, TTFB
  console.log(metric);

  // Google Analytics로 전송
  // window.gtag('event', metric.name, {
  //   value: Math.round(metric.value),
  //   event_label: metric.id,
  // });
}
```

### 성능 최적화 체크

```bash
# Lighthouse CI 실행 (로컬)
npm install -g @lhci/cli
lhci autorun --collect.url=https://genova-frontend-987680405347.asia-northeast3.run.app

# Core Web Vitals 확인
# - Largest Contentful Paint (LCP): < 2.5s
# - First Input Delay (FID): < 100ms
# - Cumulative Layout Shift (CLS): < 0.1
```

---

## 7. 🐛 트러블슈팅

### 일반적인 문제

#### 1. 빌드 실패

```bash
# 로그 확인
gcloud builds log --region=asia-northeast3 BUILD_ID

# 주요 체크사항:
# - package.json 의존성 버전 충돌
# - TypeScript 타입 에러
# - 빌드 타임 환경 변수 누락

# 로컬에서 빌드 테스트
cd frontend
npm run build
```

#### 2. 환경 변수 미적용

```bash
# Next.js는 빌드 타임에 환경 변수를 번들에 포함
# 환경 변수 변경 시 반드시 재빌드 필요

# 1. cloudbuild.yaml 확인
cat frontend/cloudbuild.yaml

# 2. 재배포
cd frontend
./deploy-dev.sh

# 3. 브라우저에서 환경 변수 확인 (개발자 도구)
console.log(process.env.NEXT_PUBLIC_API_URL)
```

#### 3. API 호출 실패

```bash
# CORS 에러
# - Backend의 CORS_ORIGINS가 https://genova.genaion.net으로 설정되어 있는지 확인
# - Backend에 Frontend URL 추가

# API 키 오류
# - Secret Manager의 dev-next-public-api-key 확인
# - Backend의 API_KEYS와 일치 여부 확인

# Network 타임아웃
# - Backend Health Check 확인
# - Backend Cold Start 대기 (10-30초)
```

#### 4. Firebase 인증 실패

```bash
# Firebase Console에서 확인:
# 1. Authentication > Settings > Authorized domains
#    - genova.genaion.net 추가 확인

# 2. Firebase API Key 확인
gcloud secrets versions access latest --secret=dev-next-public-api-key

# 3. 브라우저 콘솔 에러 확인
# - auth/invalid-api-key
# - auth/unauthorized-domain
```

#### 5. 페이지 로딩 느림

```bash
# Next.js 빌드 최적화
# 1. next.config.mjs 확인
# 2. 이미지 최적화 (next/image 사용)
# 3. 코드 스플리팅 확인

# Cloud Run 리소스 증가
gcloud run services update genova-frontend \
  --region=asia-northeast3 \
  --memory=2Gi \
  --cpu=2
```

### 디버깅 팁

```bash
# 1. 로컬에서 프로덕션 빌드 테스트
cd frontend
npm run build
npm run start

# 2. Cloud Run 리비전 확인
gcloud run revisions list --service=genova-frontend

# 3. 특정 리비전으로 트래픽 조정
gcloud run services update-traffic genova-frontend \
  --to-revisions=REVISION-001=100

# 4. 롤백
gcloud run services update-traffic genova-frontend \
  --to-revisions=PREVIOUS-REVISION=100
```

### Next.js 특정 이슈

```bash
# 1. 빌드 캐시 문제
# - .next 디렉토리 삭제 후 재빌드

# 2. 정적 생성 오류
# - next.config.mjs의 output 설정 확인
# - Standalone 모드 사용 권장

# 3. 환경 변수 undefined
# - NEXT_PUBLIC_ prefix 확인
# - 빌드 타임 vs 런타임 구분
```

### 긴급 대응

```bash
# 이전 버전으로 즉시 롤백
gcloud run services update-traffic genova-frontend \
  --region=asia-northeast3 \
  --to-revisions=PREVIOUS-GOOD-REVISION=100

# 서비스 일시 중단 (긴급)
gcloud run services delete genova-frontend --region=asia-northeast3

# 서비스 재개
./deploy-dev.sh
```

---

## 📞 추가 정보

### 관련 문서

- [Backend Dev 가이드](./DEV_BACKEND_GUIDE.md)
- [인프라 가이드](./DEV_INFRASTRUCTURE_GUIDE.md)
- [로컬 셋업 가이드](./LOCAL_SETUP_GUIDE.md)
- [Frontend README](../frontend/README.md)

### 유용한 링크

- [Cloud Run Console](https://console.cloud.google.com/run?project=genova-ai-project)
- [Container Registry](https://console.cloud.google.com/gcr/images/genova-ai-project)
- [Secret Manager Console](https://console.cloud.google.com/security/secret-manager?project=genova-ai-project)
- [Firebase Console](https://console.firebase.google.com/project/genova-ai-project)
- [Logs Explorer](https://console.cloud.google.com/logs?project=genova-ai-project)
- [Cloud Monitoring](https://console.cloud.google.com/monitoring?project=genova-ai-project)

### Next.js 참고 자료

- [Next.js 공식 문서](https://nextjs.org/docs)
- [App Router 가이드](https://nextjs.org/docs/app)
- [Cloud Run 배포 가이드](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service)

### 연락처

- **Project**: Genova AI - AX AgriEdu Platform
- **Organization**: ax-axmvp
- **Support**: [프로젝트 관리자 연락처]
