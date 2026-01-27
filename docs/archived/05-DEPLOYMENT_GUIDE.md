# 배포 가이드

이 문서는 Google Cloud Run으로의 배포 프로세스를 설명합니다.

---

## 배포 환경 개요

### 현재 배포 상태

| 항목 | 값 |
|------|-----|
| GCP 프로젝트 | genova-ai-project |
| 리전 | asia-northeast3 (서울) |
| 프론트엔드 URL | https://genova.genaion.net |
| 백엔드 URL | https://genova-ai-backend-987680405347.asia-northeast3.run.app |

### 서비스별 구성

| 서비스 | Cloud Run 이름 | 메모리 | CPU | 인스턴스 |
|--------|----------------|--------|-----|----------|
| 프론트엔드 | genova-frontend | 512Mi | 1 | 0~10 |
| 백엔드 | genova-ai-backend | 4Gi | 2 | 0~10 |

---

## 사전 준비

### 필수 도구

```bash
# gcloud CLI 설치 확인
gcloud --version

# Docker 설치 확인
docker --version

# 인증
gcloud auth login
gcloud config set project genova-ai-project
```

### 필요 권한

배포를 위해 다음 IAM 역할이 필요합니다:
- Cloud Run Admin
- Cloud Build Editor
- Storage Admin
- Artifact Registry Writer

---

## 백엔드 배포

### 배포 스크립트 사용

```bash
cd ax-agriedu-back-v3/deployment/scripts

# 배포 스크립트 실행
./2-deploy.sh
```

### 수동 배포 단계

**1. Docker 이미지 빌드**
```bash
cd ax-agriedu-back-v3

# 이미지 빌드
docker build -t asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest .
```

**2. 이미지 푸시**
```bash
# Artifact Registry 인증
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# 이미지 푸시
docker push asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest
```

**3. Cloud Run 배포**
```bash
gcloud run deploy genova-ai-backend \
  --image=asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest \
  --region=asia-northeast3 \
  --platform=managed \
  --memory=4Gi \
  --cpu=2 \
  --timeout=900 \
  --concurrency=10 \
  --min-instances=0 \
  --max-instances=10 \
  --add-cloudsql-instances=genova-ai-project:asia-northeast3:genova-postgres \
  --set-env-vars="APP_ENV=production,LOG_LEVEL=INFO" \
  --allow-unauthenticated
```

**4. 배포 확인**
```bash
# 서비스 상태 확인
gcloud run services describe genova-ai-backend --region=asia-northeast3

# 헬스체크
curl https://genova-ai-backend-987680405347.asia-northeast3.run.app/health
```

---

## 프론트엔드 배포

### Cloud Build 사용 (권장)

```bash
cd axmvp-agriedu-front

# Cloud Build로 자동 빌드 및 배포
gcloud builds submit --config cloudbuild.yaml
```

### 수동 배포 단계

**1. Docker 이미지 빌드**
```bash
cd axmvp-agriedu-front

# 이미지 빌드
docker build -t gcr.io/genova-ai-project/genova-frontend:latest .
```

**2. 이미지 푸시**
```bash
# Container Registry 인증
gcloud auth configure-docker

# 이미지 푸시
docker push gcr.io/genova-ai-project/genova-frontend:latest
```

**3. Cloud Run 배포**
```bash
gcloud run deploy genova-frontend \
  --image=gcr.io/genova-ai-project/genova-frontend:latest \
  --region=asia-northeast3 \
  --platform=managed \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://genova-ai-backend-987680405347.asia-northeast3.run.app" \
  --allow-unauthenticated
```

---

## 환경 변수 관리

### 백엔드 환경 변수 업데이트

```bash
# 단일 변수 업데이트
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --update-env-vars="LOG_LEVEL=DEBUG"

# 여러 변수 업데이트
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --update-env-vars="LOG_LEVEL=INFO,MAX_FILE_SIZE=4GB"

# 변수 제거
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --remove-env-vars="SOME_VAR"
```

### 프론트엔드 환경 변수 업데이트

```bash
gcloud run services update genova-frontend \
  --region=asia-northeast3 \
  --update-env-vars="NEXT_PUBLIC_API_URL=https://new-backend-url"
```

### 주요 환경 변수

**백엔드:**
| 변수 | 설명 |
|------|------|
| APP_ENV | production |
| LOG_LEVEL | INFO |
| DATABASE_URL | Cloud SQL 연결 문자열 |
| REDIS_URL | Upstash Redis URL |
| GCS_BUCKET_NAME | 비디오 저장소 버킷 |

**프론트엔드:**
| 변수 | 설명 |
|------|------|
| NEXT_PUBLIC_API_URL | 백엔드 API URL |
| NEXT_PUBLIC_API_KEY | API 인증 키 |

---

## 롤백 절차

### Cloud Run 롤백

```bash
# 리비전 목록 확인
gcloud run revisions list --service=genova-ai-backend --region=asia-northeast3

# 특정 리비전으로 트래픽 전환
gcloud run services update-traffic genova-ai-backend \
  --region=asia-northeast3 \
  --to-revisions=genova-ai-backend-00015-abc=100
```

### 이전 이미지로 배포

```bash
# 이미지 태그 목록 확인
gcloud artifacts docker images list \
  asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend

# 특정 버전으로 재배포
gcloud run deploy genova-ai-backend \
  --image=asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:previous-tag \
  --region=asia-northeast3
```

---

## 데이터베이스 마이그레이션

### Cloud SQL Proxy 연결

```bash
# Cloud SQL Proxy 실행
cloud-sql-proxy genova-ai-project:asia-northeast3:genova-postgres --port=5433

# 다른 터미널에서 psql 연결
PGPASSWORD=your-password psql -h localhost -p 5433 -U genova_user -d genova_ai
```

### 스키마 변경 시

1. 로컬에서 변경 테스트
2. Cloud SQL Proxy로 프로덕션 DB 연결
3. 마이그레이션 SQL 실행
4. 애플리케이션 배포

```bash
# 마이그레이션 SQL 실행
cd ax-agriedu-back-v3/deployment/sql
./init-database.sh
```

---

## 스케일링 설정

### 인스턴스 수 조정

```bash
# 최소/최대 인스턴스 변경
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --min-instances=1 \
  --max-instances=20
```

### 리소스 조정

```bash
# 메모리/CPU 변경
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --memory=8Gi \
  --cpu=4
```

### 동시성 조정

```bash
# 인스턴스당 동시 요청 수 변경
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --concurrency=20
```

---

## 배포 체크리스트

### 배포 전

- [ ] 로컬에서 테스트 완료
- [ ] 코드 리뷰 완료
- [ ] 환경 변수 확인
- [ ] 데이터베이스 마이그레이션 필요 여부 확인

### 배포 후

- [ ] 헬스체크 확인
- [ ] 로그에서 에러 확인
- [ ] 주요 기능 테스트
- [ ] 성능 모니터링

```bash
# 헬스체크
curl https://genova-ai-backend-987680405347.asia-northeast3.run.app/health

# 로그 확인
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --limit=50
```

---

## 참고 문서

- [배포 상세 가이드](../ax-agriedu-back-v3/deployment/README.md)
- [인프라 상세](./09-INFRASTRUCTURE_DETAILS.md)
- [운영 런북](./07-OPERATIONS_RUNBOOK.md)
