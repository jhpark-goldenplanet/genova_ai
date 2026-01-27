# 운영 런북

이 문서는 프로덕션 환경 운영 중 발생하는 문제를 해결하기 위한 가이드입니다.

---

## 모니터링 대시보드

### GCP Console 링크

| 서비스 | URL |
|--------|-----|
| Cloud Run | https://console.cloud.google.com/run?project=genova-ai-project |
| Cloud SQL | https://console.cloud.google.com/sql?project=genova-ai-project |
| Cloud Storage | https://console.cloud.google.com/storage?project=genova-ai-project |
| Cloud Logging | https://console.cloud.google.com/logs?project=genova-ai-project |

### 외부 서비스

| 서비스 | URL |
|--------|-----|
| Upstash Redis | https://console.upstash.com |

### 주요 메트릭 확인

**Cloud Run:**
- 요청 수 (Requests/sec)
- 응답 시간 (Latency)
- 에러율 (Error rate)
- 인스턴스 수 (Instance count)
- CPU/메모리 사용률

**Cloud SQL:**
- 연결 수 (Connections)
- CPU 사용률
- 메모리 사용률
- 디스크 사용량

---

## 로그 확인

### Cloud Run 로그 조회

```bash
# 최근 로그 확인
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --limit=100

# 실시간 로그 추적
gcloud run services logs tail genova-ai-backend \
  --region=asia-northeast3

# 에러 로그만 필터링
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --log-filter='severity>=ERROR'

# 특정 시간대 로그
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --log-filter='timestamp>="2025-01-09T00:00:00Z"'
```

### 프론트엔드 로그

```bash
gcloud run services logs read genova-frontend \
  --region=asia-northeast3 \
  --limit=50
```

### Cloud Logging 콘솔에서 쿼리

```
resource.type="cloud_run_revision"
resource.labels.service_name="genova-ai-backend"
severity>=ERROR
```

---

## 트러블슈팅 가이드

### 1. 데이터베이스 연결 실패

**증상:**
- 헬스체크 실패
- `Connection refused` 에러 로그

**확인:**
```bash
# Cloud SQL 상태 확인
gcloud sql instances describe genova-postgres

# Cloud Run 환경 변수 확인
gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.containers[0].env)"

# VPC Connector 확인
gcloud compute networks vpc-access connectors describe genova-vpc-connector-v2 \
  --region=asia-northeast3
```

**해결:**
1. Cloud SQL 인스턴스가 실행 중인지 확인
2. DATABASE_URL 환경 변수 확인
3. Cloud SQL 연결 설정 확인
4. 필요시 Cloud Run 재배포

---

### 2. Redis 연결 타임아웃

**증상:**
- 상태 조회 지연
- `Redis connection timeout` 로그

**확인:**
```bash
# 환경 변수 확인
gcloud run services describe genova-ai-backend \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.containers[0].env)" | grep REDIS
```

**해결:**
1. Upstash Console에서 Redis 상태 확인
2. REDIS_URL 형식 확인 (`rediss://default:password@host:port`)
3. Upstash Redis 재시작 (Console에서)

---

### 3. 메모리 부족 (OOMKilled)

**증상:**
- 컨테이너 재시작
- `OOMKilled` 상태

**확인:**
```bash
# Cloud Run 리비전 상태 확인
gcloud run revisions list --service=genova-ai-backend --region=asia-northeast3
```

**해결:**
```bash
# 메모리 증가
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --memory=8Gi

# 또는 동시 요청 수 감소
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --concurrency=5
```

---

### 4. 요청 타임아웃 (900초)

**증상:**
- 긴 비디오 처리 시 타임아웃
- `Request timeout` 에러

**원인:**
- 비디오가 너무 길거나 해상도가 높음
- AI 분석 지연

**해결:**
- 비동기 처리로 설계되어 있으므로 상태 폴링 확인
- 긴 비디오의 경우 처리 시간이 15분 이상 걸릴 수 있음
- 타임아웃은 개별 HTTP 요청에만 적용됨

---

### 5. YouTube 다운로드 실패

**증상:**
- YouTube URL 업로드 실패
- `yt-dlp` 관련 에러

**확인:**
```bash
# 로그에서 yt-dlp 에러 확인
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --log-filter='textPayload=~"yt-dlp"'
```

**해결:**
1. YouTube 쿠키 업데이트 (yt-dlp 인증 필요)
2. Cloud NAT IP가 YouTube에 의해 차단되었는지 확인

---

### 6. AI 분석 실패

**증상:**
- `Vertex AI error` 로그
- 상태가 FAILED로 변경

**확인:**
```bash
# Vertex AI 관련 로그 확인
gcloud run services logs read genova-ai-backend \
  --region=asia-northeast3 \
  --log-filter='textPayload=~"vertex"'
```

**해결:**
1. GCP 프로젝트의 Vertex AI API 할당량 확인
2. 서비스 계정 권한 확인
3. 비디오 형식이 지원되는지 확인

---

## 긴급 대응 절차

### 서비스 재시작

```bash
# 새 리비전 배포로 재시작
gcloud run services update genova-ai-backend \
  --region=asia-northeast3 \
  --no-traffic

gcloud run services update-traffic genova-ai-backend \
  --region=asia-northeast3 \
  --to-latest
```

### 롤백

```bash
# 리비전 목록 확인
gcloud run revisions list --service=genova-ai-backend --region=asia-northeast3

# 이전 리비전으로 롤백
gcloud run services update-traffic genova-ai-backend \
  --region=asia-northeast3 \
  --to-revisions=genova-ai-backend-00015-abc=100
```

### 서비스 일시 중지

```bash
# 트래픽 0%로 설정
gcloud run services update-traffic genova-ai-backend \
  --region=asia-northeast3 \
  --to-revisions=genova-ai-backend-00001-abc=0
```

---

## 정기 운영 작업

### 로그 정리

Cloud Logging 보존 정책 확인 (기본 30일)

### 스토리지 관리

```bash
# GCS 버킷 사용량 확인
gcloud storage du -s gs://genova-ai-project-genova-videos

# 오래된 임시 파일 정리 (자동 수명 주기 설정됨)
# uploaded_tmp/ 폴더: 90일 후 자동 삭제
```

### 비용 모니터링

1. GCP Console > Billing > Reports
2. 서비스별 비용 확인
3. 비정상적인 비용 증가 모니터링

---

## 헬스체크 스크립트

```bash
#!/bin/bash
# health_check.sh

BACKEND_URL="https://genova-ai-backend-987680405347.asia-northeast3.run.app"
FRONTEND_URL="https://genova.genaion.net"

echo "Checking Backend..."
curl -s "$BACKEND_URL/health" | jq .

echo ""
echo "Checking Frontend..."
curl -s -o /dev/null -w "Status: %{http_code}\n" "$FRONTEND_URL"
```

---

## 참고 문서

- [배포 가이드](./05-DEPLOYMENT_GUIDE.md)
- [인프라 상세](./09-INFRASTRUCTURE_DETAILS.md)
- [배포 README](../ax-agriedu-back-v3/deployment/README.md)
