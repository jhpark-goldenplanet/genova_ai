# AX AgriEdu 백엔드 - 배포 가이드

Google Cloud Platform (GCP)의 Cloud Run을 사용한 배포 가이드입니다.

## 목차

- [사전 요구사항](#사전-요구사항)
- [아키텍처 개요](#아키텍처-개요)
- [배포 단계](#배포-단계)
- [설정](#설정)
- [모니터링](#모니터링)
- [트러블슈팅](#트러블슈팅)
- [비용 예측](#비용-예측)

## 사전 요구사항

### 필수 도구

**1. Google Cloud SDK (gcloud)**
```bash
# gcloud CLI 설치
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

**2. Docker**
```bash
# Docker 설치 확인
docker --version
```

**3. PostgreSQL Client** (데이터베이스 초기화용)
```bash
# macOS
brew install postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql-client-15
```

**4. Cloud SQL Proxy**
```bash
# init-database.sh 스크립트가 필요시 자동 설치
```

### GCP 프로젝트 설정

1. 새 GCP 프로젝트 생성 또는 기존 프로젝트 사용
2. 프로젝트에 대한 결제 활성화
3. 인증 설정:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        Cloud Run                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │   AX AgriEdu Backend                               │     │
│  │   - FastAPI 애플리케이션                            │     │
│  │   - 비디오 처리                                     │     │
│  │   - AI 분석                                         │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ VPC Connector
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Cloud SQL   │  │   Upstash    │  │   Cloud      │
│ (PostgreSQL) │  │   Redis      │  │   Storage    │
│              │  │              │  │              │
│  - 비디오    │  │  - 상태      │  │  - 비디오    │
│  - 세그먼트  │  │  - 잠금      │  │    파일      │
│  - 메타데이터│  │  - 캐시      │  │  - 출력물    │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 구성 요소

**GCP 리소스:**
- **Cloud Run**: FastAPI 애플리케이션을 위한 서버리스 컨테이너 런타임 (4GB RAM, 2 vCPU)
- **Cloud SQL (PostgreSQL 15)**: 구조화된 데이터를 위한 관리형 데이터베이스
- **Cloud Storage**: 비디오 파일 및 출력물을 위한 객체 스토리지
- **VPC Connector**: Cloud Run과 Cloud SQL 간 프라이빗 네트워크 연결
- **Vertex AI**: 비디오 분석을 위한 AI/ML 서비스 (Gemini 2.5 Pro)

**외부 서비스:**
- **Upstash Redis**: 서버리스 관리형 Redis (캐싱 및 상태 관리)

**현재 배포된 리소스:**
- 프로젝트: `genova-ai-project`
- 리전: `asia-northeast3`
- Cloud Run: `genova-ai-backend`
- Cloud SQL: `genova-postgres`
- Storage Bucket: `genova-ai-project-genova-videos`
- VPC Connector: `genova-vpc-connector-v2`

## 현재 배포 상태 확인

실제 배포된 리소스를 확인하려면:

```bash
# 프로젝트 설정
gcloud config set project genova-ai-project

# Cloud Run 서비스 확인
gcloud run services list --region=asia-northeast3

# Cloud SQL 확인
gcloud sql instances describe genova-postgres --region=asia-northeast3

# Storage 버킷 확인
gcloud storage buckets describe gs://genova-ai-project-genova-videos

# VPC Connector 확인
gcloud compute networks vpc-access connectors describe genova-vpc-connector-v2 \
  --region=asia-northeast3

# 서비스 URL 확인
echo "Backend URL: https://genova-ai-backend-6frp4obakq-du.a.run.app"
```

## 배포 단계

### 1단계: GCP 리소스 생성

필요한 모든 GCP 인프라를 생성하는 스크립트입니다:

```bash
cd deployment/scripts

# 필수 환경 변수 설정
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-northeast3"  # 또는 선호하는 리전
export DB_PASSWORD="your-secure-database-password"

# 리소스 생성 스크립트 실행
chmod +x 1-create-resources.sh
./1-create-resources.sh
```

**생성되는 리소스:**
- Cloud SQL PostgreSQL 인스턴스 (genova-postgres)
- 비디오용 Cloud Storage 버킷 (genova-ai-project-genova-videos)
- 프라이빗 네트워킹을 위한 VPC Connector (genova-vpc-connector-v2)
- 적절한 IAM 역할을 가진 서비스 계정
- 설정 파일: `deployment/config/.env.production`

**Redis 설정:**
- Upstash Redis를 사용하므로 별도 생성 불필요
- Upstash Console에서 Redis 인스턴스 생성 및 연결 URL 확보
- https://console.upstash.com 에서 관리

**소요 시간**: 약 10-15분

### 2단계: Upstash Redis 설정

Upstash Console에서 Redis 인스턴스를 설정합니다:

**1. Upstash Console 접속**
```
https://console.upstash.com
```

**2. Redis 인스턴스 생성** (이미 생성된 경우 건너뛰기)
- 리전: asia-northeast3 또는 가까운 리전 선택
- 플랜: 개발/테스트는 무료 티어 사용 가능

**3. 연결 정보 확보**
- Dashboard에서 연결 URL 복사
- 형식: `redis://default:password@hostname:port`

**4. Cloud Run에 환경 변수 설정**
```bash
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --update-env-vars="REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_HOST:PORT"
```

**소요 시간**: 약 5분

### 3단계: 데이터베이스 스키마 초기화

필요한 스키마로 PostgreSQL 데이터베이스를 초기화합니다:

```bash
cd deployment/sql

# 데이터베이스 초기화 실행
chmod +x init-database.sh
./init-database.sh
```

**수행 작업:**
- Cloud SQL Proxy 시작
- 데이터베이스 테이블 생성 (videos, segments, translations)
- 인덱스 및 트리거 설정
- 스키마 생성 검증

**소요 시간**: 약 2-3분

### 4단계: Cloud Run에 배포

Docker 이미지를 빌드하고 Cloud Run에 배포합니다:

```bash
cd deployment/scripts

# 배포 스크립트 실행
chmod +x 2-deploy.sh
./2-deploy.sh
```

**수행 작업:**
- Artifact Registry 저장소 생성
- 모든 의존성을 포함한 Docker 이미지 빌드
- Artifact Registry에 이미지 푸시
- 최적화된 설정으로 Cloud Run에 배포
- 헬스 체크 실행

**소요 시간**: 약 10-15분 (최초 배포)

### 5단계: 배포 검증

배포가 완료된 후 서비스를 테스트합니다:

```bash
# 서비스 URL 가져오기
export SERVICE_URL=$(gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format='value(status.url)')

# 헬스 체크
curl ${SERVICE_URL}/health

# API 루트
curl ${SERVICE_URL}/

# 브라우저에서 API 문서 열기
open ${SERVICE_URL}/docs
```

## 설정

### 환경 변수

모든 환경 변수는 배포 중에 설정됩니다. 주요 설정:

**애플리케이션:**
- `APP_ENV=production`
- `LOG_LEVEL=INFO`
- `MAX_FILE_SIZE=2GB`

**데이터베이스:**
- `DATABASE_URL` (Cloud SQL Unix 소켓으로 자동 구성)
- `DATABASE_POOL_SIZE=5`
- `DATABASE_MAX_OVERFLOW=10`

**Redis:**
- `REDIS_URL` (Upstash Redis 연결 URL 사용)
- Upstash Console에서 제공하는 연결 문자열 설정

**Google Cloud:**
- `GOOGLE_CLOUD_PROJECT`
- `GCS_BUCKET_NAME`
- Workload Identity 사용 (서비스 계정 키 불필요)

### 설정 업데이트

배포 후 환경 변수를 업데이트하려면:

```bash
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --update-env-vars="LOG_LEVEL=DEBUG,MAX_FILE_SIZE=4GB"
```

### 스케일링 설정

현재 설정 (비디오 처리에 최적화):

```yaml
메모리: 4GB
CPU: 2 vCPU
타임아웃: 900초 (15분)
동시성: 인스턴스당 10개 요청
최소 인스턴스: 0 (제로 스케일)
최대 인스턴스: 10
```

스케일링 조정:

```bash
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --memory=8Gi \
  --cpu=4 \
  --min-instances=1 \
  --max-instances=20
```

## 모니터링

### 로그 확인

```bash
# 최근 로그
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --limit=50

# 실시간 로그 추적
gcloud run services logs tail genova-ai-backend \
  --region=asia-northeast3

# 에러 레벨 필터
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --log-filter='severity>=ERROR'
```

### Cloud Console 모니터링

**1. Cloud Run 메트릭**: https://console.cloud.google.com/run
- 요청 수
- 요청 지연 시간
- 컨테이너 인스턴스
- 메모리/CPU 사용률

**2. Cloud SQL**: https://console.cloud.google.com/sql
- 연결 수
- 쿼리 성능
- 스토리지 사용량

**3. Upstash Redis**: https://console.upstash.com
- 메모리 사용량
- 초당 작업 수
- 연결 수
- 캐시 적중률

**4. Cloud Storage**: https://console.cloud.google.com/storage
- 스토리지 사용량
- 요청률
- 대역폭

### 알림 설정

```bash
# Cloud Run 에러에 대한 알림 생성
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Run 에러율" \
  --condition-display-name="높은 에러율" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s
```

## 트러블슈팅

### 일반적인 문제

#### 1. 데이터베이스 연결 실패

**증상**: 데이터베이스 연결 오류로 헬스 체크 실패

**해결 방법**:
```bash
# Cloud SQL 인스턴스 상태 확인
gcloud sql instances describe genova-postgres

# VPC 커넥터 확인
gcloud compute networks vpc-access connectors describe genova-vpc-connector \
  --region=asia-northeast3

# 데이터베이스 자격 증명 확인
cd deployment/config
cat .env.production | grep DB_
```

#### 2. Redis 연결 타임아웃

**증상**: 애플리케이션 로그에 Redis 연결 타임아웃 표시

**해결 방법**:
```bash
# Upstash Redis 연결 확인
# 1. Upstash Console에서 Redis 인스턴스 상태 확인
# 2. 연결 URL 형식 확인: redis://default:password@host:port
# 3. 네트워크 방화벽 설정 확인 (Upstash는 public endpoint 제공)
# 4. Cloud Run 환경 변수에서 REDIS_URL 확인

gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.containers[0].env)"
```

#### 3. 메모리 부족 오류

**증상**: OOMKilled 상태로 컨테이너 종료

**해결 방법**:
```bash
# 메모리 제한 증가
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --memory=8Gi

# 또는 동시 처리 감소
# MAX_CONCURRENT_TASKS 환경 변수 업데이트
```

#### 4. 요청 타임아웃

**증상**: 900초 후 요청 타임아웃

**해결 방법**:
- 비디오 처리가 15분 이상 걸릴 수 있음
- 비동기 처리를 위해 Cloud Tasks 또는 Pub/Sub 사용 고려
- 대용량 비디오에 대한 청크 처리 구현

### 디버그 모드

디버그 로깅을 임시로 활성화:

```bash
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --update-env-vars="LOG_LEVEL=DEBUG"

# 상세 로그 확인
gcloud run services logs tail genova-ai-backend \
  --region=asia-northeast3
```

### Cloud SQL 연결

데이터베이스 디버깅용:

```bash
# Cloud SQL Proxy 시작
cloud-sql-proxy --port=5433 PROJECT:REGION:INSTANCE &

# psql로 연결
source deployment/config/.env.production
PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5433 -U $DB_USER -d $DB_NAME

# 유용한 쿼리
SELECT COUNT(*) FROM videos;
SELECT status, COUNT(*) FROM videos GROUP BY status;
SELECT * FROM videos ORDER BY created_at DESC LIMIT 10;
```

## 비용 예측

### 월간 비용 (낮은 트래픽)

| 서비스 | 사양 | 예상 비용 |
|---------|---------------|----------------|
| Cloud Run | 4GB RAM, 2 vCPU, ~100 요청/일 | $5-10 |
| Cloud SQL | db-f1-micro, 10GB SSD | $10-15 |
| Upstash Redis | 무료 티어 (10K commands/일) | $0 |
| Cloud Storage | 100GB 저장, 중간 액세스 | $2-5 |
| VPC Connector | f1-micro, 최소 트래픽 | $10-15 |
| AI 서비스 | Vertex AI (Gemini 2.5 Pro) | 가변 |
| **합계** | | **~$30-45/월** |

**참고:** Upstash Redis 무료 티어는 10,000 commands/day까지 무료. 초과 시 종량제 과금.

### 비용 최적화 팁

1. **제로 스케일**: Cloud Run의 `min-instances=0` 유지 (현재 설정)
2. **배치 처리**: 단일 인스턴스에서 여러 비디오 처리
3. **스토리지 라이프사이클**: 오래된 임시 파일 자동 삭제 (버킷에 설정)
4. **데이터베이스**: 연결 풀링 효율적으로 사용
5. **Upstash Redis**: 무료 티어 활용, 불필요한 캐시 제거로 명령 수 절감
6. **Vertex AI**: 프롬프트 최적화로 토큰 사용량 감소

### 프로덕션 비용 (높은 트래픽)

높은 트래픽의 프로덕션 환경:
- Cloud Run: $50-100 (다중 인스턴스)
- Cloud SQL: $50-100 (더 큰 인스턴스)
- Upstash Redis: $10-30 (Pro plan, 1M commands/일)
- **합계**: $120-250/월

## 리소스 정리

모든 리소스를 삭제하고 비용 발생을 중지하려면:

```bash
cd deployment/scripts
chmod +x destroy-resources.sh
./destroy-resources.sh
```

**경고**: 이 작업은 모든 데이터를 영구적으로 삭제합니다!

## 추가 자료

- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [Cloud SQL 문서](https://cloud.google.com/sql/docs)
- [Memorystore 문서](https://cloud.google.com/memorystore/docs)
- [Vertex AI 문서](https://cloud.google.com/vertex-ai/docs)

## 지원

문제나 질문이 있는 경우:
1. 위의 트러블슈팅 섹션 확인
2. 에러 세부 정보는 Cloud Run 로그 검토
3. GCP 문서 참조
4. DevOps 팀에 문의
