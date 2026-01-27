# 인프라 상세

이 문서는 GCP 인프라 구성 및 리소스 상세 정보를 설명합니다.

---

## GCP 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 프로젝트 ID | genova-ai-project |
| 프로젝트 번호 | 987680405347 |
| 리전 | asia-northeast3 (서울) |
| 결제 계정 | 프로젝트 관리자 문의 |

---

## 리소스 목록

### Cloud Run 서비스

#### 백엔드 (genova-ai-backend)

| 항목 | 값 |
|------|-----|
| 서비스 URL | https://genova-ai-backend-987680405347.asia-northeast3.run.app |
| 메모리 | 4Gi |
| CPU | 2 vCPU (CPU Boost 활성화) |
| 최소 인스턴스 | 0 (Scale to zero) |
| 최대 인스턴스 | 10 |
| 동시성 | 인스턴스당 10 요청 |
| 타임아웃 | 900초 (15분) |
| 이미지 | asia-northeast3-docker.pkg.dev/genova-ai-project/genova-ai/backend:latest |

#### 프론트엔드 (genova-frontend)

| 항목 | 값 |
|------|-----|
| 서비스 URL | (Load Balancer 뒤에 있음) |
| 메모리 | 512Mi |
| CPU | 1 vCPU |
| 최소 인스턴스 | 0 |
| 최대 인스턴스 | 10 |
| 이미지 | gcr.io/genova-ai-project/genova-frontend |

---

### Cloud SQL (PostgreSQL)

| 항목 | 값 |
|------|-----|
| 인스턴스 이름 | genova-postgres |
| 버전 | PostgreSQL 15 |
| 연결 이름 | genova-ai-project:asia-northeast3:genova-postgres |
| 티어 | db-custom (사양 확인 필요) |
| 스토리지 | SSD, 자동 증가 |
| 백업 | 자동 백업 활성화 |
| 고가용성 | 비활성화 (비용 절감) |

**연결 정보:**
```
Host: /cloudsql/genova-ai-project:asia-northeast3:genova-postgres (Unix Socket)
Database: genova_ai
User: genova_user
```

---

### Cloud Storage

| 버킷 | 용도 |
|------|------|
| genova-ai-project-genova-videos | 비디오 파일 저장 |
| genova-ai-project.firebasestorage.app | Firebase 스토리지 |

#### 버킷 설정 (genova-ai-project-genova-videos)

| 항목 | 값 |
|------|-----|
| 위치 | ASIA-NORTHEAST3 |
| 스토리지 클래스 | Standard |
| 수명 주기 | uploaded_tmp/: 90일 후 삭제 |
| 공개 액세스 | 비공개 (Signed URL 사용) |

---

### 네트워크

#### VPC Connector

| 항목 | 값 |
|------|-----|
| 이름 | genova-vpc-connector-v2 |
| 네트워크 | default |
| IP 범위 | 10.8.0.0/28 |
| 용도 | Cloud Run → Cloud SQL 연결 |

#### Cloud NAT

| 항목 | 값 |
|------|-----|
| 이름 | genova-nat |
| Cloud Router | genova-router |
| 고정 IP | 34.22.78.155 |
| 용도 | 외부 API 호출 (YouTube 등) |

#### Load Balancer

| 항목 | 값 |
|------|-----|
| 이름 | genova-lb |
| 타입 | Global External HTTP(S) |
| SSL 인증서 | genova-ssl-cert (Google-managed) |

---

### AI 서비스

| 서비스 | 용도 | 모델 |
|--------|------|------|
| Vertex AI | 비디오 분석 | gemini-2.5-flash |
| Speech-to-Text | 음성 인식 | - |
| Translation API | 번역 | - |

---

### 외부 서비스

#### Upstash Redis

| 항목 | 값 |
|------|-----|
| 서비스 | Upstash (서버리스 Redis) |
| 리전 | Global |
| 프로토콜 | rediss:// (TLS) |
| 용도 | 캐싱, 상태 관리 |
| 콘솔 | https://console.upstash.com |

#### Firebase

| 항목 | 값 |
|------|-----|
| 프로젝트 | genova-ai-project |
| 서비스 | Firebase Auth |
| 용도 | 사용자 인증 |

---

## 환경별 URL

| 환경 | 프론트엔드 | 백엔드 |
|------|------------|--------|
| 프로덕션 | https://genova.genaion.net | https://genova-ai-backend-987680405347.asia-northeast3.run.app |
| 로컬 | http://localhost:3000 | http://localhost:8000 |

---

## 비용 정보

### 예상 월간 비용 (낮은 트래픽)

| 서비스 | 사양 | 예상 비용 |
|--------|------|----------|
| Cloud Run (백엔드) | 4GB RAM, 2 vCPU, ~100 요청/일 | $5-10 |
| Cloud Run (프론트엔드) | 512MB RAM, 1 vCPU | $2-5 |
| Cloud SQL | db-f1-micro, 10GB SSD | $10-15 |
| Cloud Storage | 100GB, 중간 액세스 | $2-5 |
| VPC Connector | f1-micro | $10-15 |
| Upstash Redis | 무료 티어 | $0 |
| AI 서비스 | 사용량 기반 | 가변 |
| **합계** | | **~$30-50/월** |

### 비용 최적화 팁

1. **Scale to zero**: 최소 인스턴스 0 유지
2. **적절한 인스턴스 크기**: 필요에 맞게 조정
3. **스토리지 수명 주기**: 임시 파일 자동 삭제
4. **AI 서비스**: 프롬프트 최적화로 토큰 절감
5. **Upstash 무료 티어**: 10K commands/day 이내 사용

---

## IAM 및 보안

### 서비스 계정

| 서비스 계정 | 용도 | 역할 |
|-------------|------|------|
| Cloud Run 기본 | 백엔드/프론트엔드 실행 | Cloud Run Invoker, Storage Admin |
| Cloud SQL | DB 접근 | Cloud SQL Client |

### 필요 권한

**배포용:**
- Cloud Run Admin
- Cloud Build Editor
- Artifact Registry Writer
- Storage Admin

**운영용:**
- Cloud Run Viewer
- Logging Viewer
- Monitoring Viewer

---

## 리소스 확인 명령어

```bash
# Cloud Run 서비스 목록
gcloud run services list --region=asia-northeast3

# Cloud SQL 인스턴스
gcloud sql instances describe genova-postgres

# Storage 버킷
gcloud storage buckets describe gs://genova-ai-project-genova-videos

# VPC Connector
gcloud compute networks vpc-access connectors describe genova-vpc-connector-v2 \
  --region=asia-northeast3

# Cloud NAT
gcloud compute routers nats describe genova-nat \
  --router=genova-router \
  --region=asia-northeast3
```

---

## 참고 문서

- [배포 가이드](./05-DEPLOYMENT_GUIDE.md)
- [운영 런북](./07-OPERATIONS_RUNBOOK.md)
- [GCP 배포 상태](../ax-agriedu-back-v3/docs/completed/GCP_DEPLOYMENT_CURRENT.md)
