# genova-ai-project 도메인 연결 가이드

## 목차
1. [개요](#개요)
2. [현재 상황 분석](#현재-상황-분석)
3. [목표 도메인 구성](#목표-도메인-구성)
4. [구현 계획](#구현-계획)
5. [상세 구현 단계](#상세-구현-단계)
6. [검증 및 테스트](#검증-및-테스트)
7. [비용 및 리소스](#비용-및-리소스)

---

## 개요

genova-ai-project의 두 개의 Cloud Run 서비스에 커스텀 도메인을 연결하는 작업입니다.

**작업 일정**: TBD
**작업자**: TBD
**예상 소요 시간**: 2-3시간 (DNS 전파 시간 포함 시 24-48시간)

---

## 현재 상황 분석

### mkt-yoitda-project 구성 (참고용)

이미 구축된 mkt-yoitda-project의 구성을 기반으로 genova-ai-project를 구성합니다.

#### 리소스 구성
```
도메인: genaion.net (가비아에서 관리)
고정 IP: 34.117.98.234 (mkt-lb-ip)
SSL 인증서: mkt-ssl-cert

서버리스 NEG:
  - neg-genaion-playground (asia-northeast3)
  - neg-synapse-canvas (asia-northeast3)

백엔드 서비스:
  - be-playground → neg-genaion-playground
  - be-artova → neg-synapse-canvas

URL 라우팅:
  - genaion.net → be-playground (Cloud Run: genaion-playground)
  - artova.genaion.net → be-artova (Cloud Run: synapse-canvas)

보안:
  - HTTP → HTTPS 자동 리디렉션
  - SSL/TLS 인증서 자동 관리
```

### genova-ai-project 현재 상태

#### Cloud Run 서비스
1. **genova-frontend**
   - 현재 URL: `https://genova-frontend-987680405347.asia-northeast3.run.app`
   - 목표 도메인: `genova.genaion.net`
   - 프로젝트: genova-ai-project
   - 리전: asia-northeast3
   - 컨테이너 이미지: `gcr.io/genova-ai-project/genova-frontend:latest`
   - 리소스: 512Mi 메모리, 1 CPU
   - 환경 변수:
     - NEXT_PUBLIC_API_URL
     - NEXT_PUBLIC_API_KEY

2. **genova-frontend-temp**
   - 현재 URL: `https://genova-frontend-temp-987680405347.asia-northeast3.run.app`
   - 목표 도메인: `agriedu.genaion.net`
   - 프로젝트: genova-ai-project
   - 리전: asia-northeast3
   - 컨테이너 이미지: 동일 이미지 사용 가능
   - 리소스: 512Mi 메모리, 1 CPU

---

## 목표 도메인 구성

### 도메인 매핑

| 서비스 | 현재 URL | 목표 도메인 | 용도 |
|--------|----------|-------------|------|
| genova-frontend | genova-frontend-987680405347.asia-northeast3.run.app | genova.genaion.net | 메인 Genova AI 프론트엔드 |
| genova-frontend-temp | genova-frontend-temp-987680405347.asia-northeast3.run.app | agriedu.genaion.net | AgriEdu 프론트엔드 |

### 인프라 아키텍처

```
                    Internet
                       |
                       v
              [가비아 DNS - genaion.net]
                       |
        +-------------+---------------+
        |                             |
        v                             v
genova.genaion.net            agriedu.genaion.net
        |                             |
        v                             v
   [Google LB IP]               [Google LB IP]
   34.XXX.XXX.XXX              (동일 IP 사용)
        |                             |
        v                             v
  [SSL 인증서]                  [SSL 인증서]
  genova-ssl-cert              (동일 인증서)
        |                             |
        v                             v
   [URL Map]                     [URL Map]
   genova-url-map               (동일 URL Map)
        |                             |
        v                             v
 [Backend Service]           [Backend Service]
 be-genova-frontend          be-genova-frontend-temp
        |                             |
        v                             v
[Serverless NEG]            [Serverless NEG]
neg-genova-frontend         neg-genova-frontend-temp
        |                             |
        v                             v
    [Cloud Run]                  [Cloud Run]
  genova-frontend           genova-frontend-temp
```

---

## 구현 계획

### Phase 1: 리소스 생성 및 설정 (1-2시간)
1. Serverless NEG 생성 (2개)
2. Backend Service 생성 (2개)
3. 고정 IP 주소 예약
4. SSL 인증서 생성
5. Load Balancer 구성

### Phase 2: DNS 설정 (30분)
1. 가비아 DNS에 A 레코드 추가
2. DNS 전파 대기

### Phase 3: 검증 및 테스트 (30분)
1. SSL 인증서 활성화 확인
2. 도메인 접속 테스트
3. HTTP → HTTPS 리디렉션 확인
4. 각 서비스 기능 테스트

---

## 상세 구현 단계

### 사전 준비

1. **Google Cloud SDK 설치 및 인증**
   ```bash
   # 프로젝트 설정
   gcloud config set project genova-ai-project

   # 현재 Cloud Run 서비스 확인
   gcloud run services list --region=asia-northeast3
   ```

2. **필요한 API 활성화**
   ```bash
   gcloud services enable compute.googleapis.com
   gcloud services enable run.googleapis.com
   ```

---

### Step 1: Serverless NEG 생성

Serverless Network Endpoint Group (NEG)는 Cloud Run 서비스를 Load Balancer에 연결하는 리소스입니다.

```bash
# genova-frontend용 NEG 생성
gcloud compute network-endpoint-groups create neg-genova-frontend \
  --region=asia-northeast3 \
  --network-endpoint-type=serverless \
  --cloud-run-service=genova-frontend

# genova-frontend-temp용 NEG 생성
gcloud compute network-endpoint-groups create neg-genova-frontend-temp \
  --region=asia-northeast3 \
  --network-endpoint-type=serverless \
  --cloud-run-service=genova-frontend-temp
```

**확인:**
```bash
gcloud compute network-endpoint-groups list
```

---

### Step 2: Backend Service 생성

Backend Service는 NEG를 Load Balancer에 연결하는 중간 계층입니다.

```bash
# genova-frontend용 백엔드 서비스 생성
gcloud compute backend-services create be-genova-frontend \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED

# NEG를 백엔드 서비스에 추가
gcloud compute backend-services add-backend be-genova-frontend \
  --global \
  --network-endpoint-group=neg-genova-frontend \
  --network-endpoint-group-region=asia-northeast3

# genova-frontend-temp용 백엔드 서비스 생성
gcloud compute backend-services create be-genova-frontend-temp \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED

# NEG를 백엔드 서비스에 추가
gcloud compute backend-services add-backend be-genova-frontend-temp \
  --global \
  --network-endpoint-group=neg-genova-frontend-temp \
  --network-endpoint-group-region=asia-northeast3
```

**확인:**
```bash
gcloud compute backend-services list
gcloud compute backend-services describe be-genova-frontend --global
gcloud compute backend-services describe be-genova-frontend-temp --global
```

---

### Step 3: 고정 IP 주소 예약

외부에서 접근 가능한 고정 IP 주소를 예약합니다.

```bash
# 전역 고정 IP 주소 생성
gcloud compute addresses create genova-lb-ip \
  --ip-version=IPV4 \
  --global

# 생성된 IP 주소 확인
gcloud compute addresses describe genova-lb-ip --global
```

**예상 출력:**
```
address: 34.XXX.XXX.XXX
```

**중요:** 이 IP 주소를 기록해두세요. DNS 설정에 사용됩니다.

---

### Step 4: SSL 인증서 생성

Google-managed SSL 인증서를 생성합니다. 자동으로 갱신되며 관리가 편리합니다.

```bash
# SSL 인증서 생성 (두 도메인 모두 포함)
gcloud compute ssl-certificates create genova-ssl-cert \
  --domains=genova.genaion.net,agriedu.genaion.net \
  --global
```

**확인:**
```bash
gcloud compute ssl-certificates describe genova-ssl-cert --global
```

**참고:** 인증서 활성화는 DNS 설정 후 15분~24시간 소요될 수 있습니다.

---

### Step 5: URL Map 생성

URL Map은 호스트 기반 라우팅을 설정합니다.

```bash
# 기본 백엔드로 URL Map 생성 (genova-frontend를 기본으로)
gcloud compute url-maps create genova-url-map \
  --default-service=be-genova-frontend \
  --global

# Path Matcher 추가 (호스트 기반 라우팅)
gcloud compute url-maps add-path-matcher genova-url-map \
  --default-service=be-genova-frontend \
  --path-matcher-name=genova-path-matcher \
  --global

# 호스트 규칙 추가
gcloud compute url-maps add-host-rule genova-url-map \
  --hosts=genova.genaion.net \
  --path-matcher-name=genova-path-matcher \
  --global

gcloud compute url-maps add-host-rule genova-url-map \
  --hosts=agriedu.genaion.net \
  --path-matcher-name=genova-path-matcher \
  --global

# agriedu.genaion.net의 기본 서비스 설정
gcloud compute url-maps add-path-matcher genova-url-map \
  --default-service=be-genova-frontend-temp \
  --path-matcher-name=agriedu-path-matcher \
  --global

# agriedu 호스트 규칙 업데이트
gcloud compute url-maps add-host-rule genova-url-map \
  --hosts=agriedu.genaion.net \
  --path-matcher-name=agriedu-path-matcher \
  --global
```

**대안 (YAML 파일 사용):**

`genova-url-map.yaml` 파일 생성:
```yaml
kind: compute#urlMap
name: genova-url-map
defaultService: https://www.googleapis.com/compute/v1/projects/genova-ai-project/global/backendServices/be-genova-frontend
hostRules:
- hosts:
  - genova.genaion.net
  pathMatcher: genova-matcher
- hosts:
  - agriedu.genaion.net
  pathMatcher: agriedu-matcher
pathMatchers:
- name: genova-matcher
  defaultService: https://www.googleapis.com/compute/v1/projects/genova-ai-project/global/backendServices/be-genova-frontend
- name: agriedu-matcher
  defaultService: https://www.googleapis.com/compute/v1/projects/genova-ai-project/global/backendServices/be-genova-frontend-temp
```

YAML로 생성:
```bash
gcloud compute url-maps import genova-url-map \
  --source=genova-url-map.yaml \
  --global
```

**확인:**
```bash
gcloud compute url-maps describe genova-url-map --global
```

---

### Step 6: HTTPS Target Proxy 생성

HTTPS 트래픽을 처리하는 프록시를 생성합니다.

```bash
gcloud compute target-https-proxies create genova-https-proxy \
  --ssl-certificates=genova-ssl-cert \
  --url-map=genova-url-map \
  --global
```

**확인:**
```bash
gcloud compute target-https-proxies describe genova-https-proxy --global
```

---

### Step 7: HTTPS Forwarding Rule 생성

외부 IP와 HTTPS 프록시를 연결합니다.

```bash
gcloud compute forwarding-rules create genova-https-forwarding-rule \
  --address=genova-lb-ip \
  --target-https-proxy=genova-https-proxy \
  --ports=443 \
  --global
```

**확인:**
```bash
gcloud compute forwarding-rules describe genova-https-forwarding-rule --global
```

---

### Step 8: HTTP → HTTPS 리디렉션 설정

HTTP 트래픽을 HTTPS로 자동 리디렉션합니다.

```bash
# URL Map for HTTP redirect
gcloud compute url-maps import genova-http-redirect \
  --source <(cat <<EOF
kind: compute#urlMap
name: genova-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF
) \
  --global

# HTTP Target Proxy
gcloud compute target-http-proxies create genova-http-proxy \
  --url-map=genova-http-redirect \
  --global

# HTTP Forwarding Rule
gcloud compute forwarding-rules create genova-http-forwarding-rule \
  --address=genova-lb-ip \
  --target-http-proxy=genova-http-proxy \
  --ports=80 \
  --global
```

**확인:**
```bash
gcloud compute forwarding-rules list
```

---

### Step 9: DNS 설정 (가비아)

가비아 DNS 관리 페이지에서 다음 레코드를 추가합니다.

1. **가비아 로그인**
   - https://www.gabia.com
   - My가비아 → 도메인 → DNS 정보 → DNS 관리

2. **A 레코드 추가**

   | 타입 | 호스트 | 값/위치 | TTL |
   |------|--------|---------|-----|
   | A | genova | 34.XXX.XXX.XXX (Step 3에서 생성한 IP) | 3600 |
   | A | agriedu | 34.XXX.XXX.XXX (동일 IP) | 3600 |

3. **설정 저장 및 적용**

**DNS 전파 확인:**
```bash
# genova.genaion.net DNS 확인
nslookup genova.genaion.net

# agriedu.genaion.net DNS 확인
nslookup agriedu.genaion.net

# dig 명령어로 더 상세한 정보 확인
dig genova.genaion.net
dig agriedu.genaion.net
```

**참고:** DNS 전파는 최대 24-48시간 소요될 수 있지만 보통 15분~2시간 내에 완료됩니다.

---

### Step 10: SSL 인증서 프로비저닝 대기

Google-managed SSL 인증서가 활성화될 때까지 기다립니다.

```bash
# SSL 인증서 상태 확인
gcloud compute ssl-certificates describe genova-ssl-cert --global

# 상태가 'ACTIVE'가 될 때까지 반복 확인
watch -n 60 'gcloud compute ssl-certificates describe genova-ssl-cert --global | grep -A 10 "managed:"'
```

**예상 상태 변화:**
- PROVISIONING → PENDING → ACTIVE

**활성화 조건:**
1. DNS A 레코드가 올바르게 설정되어야 함
2. Load Balancer가 정상 작동해야 함
3. Google이 도메인 소유권을 확인해야 함

**소요 시간:** 15분 ~ 24시간

---

## 검증 및 테스트

### 1. Load Balancer 구성 확인

```bash
# 모든 리소스 확인
echo "=== Network Endpoint Groups ==="
gcloud compute network-endpoint-groups list

echo "=== Backend Services ==="
gcloud compute backend-services list

echo "=== URL Maps ==="
gcloud compute url-maps list

echo "=== SSL Certificates ==="
gcloud compute ssl-certificates list

echo "=== Forwarding Rules ==="
gcloud compute forwarding-rules list
```

### 2. DNS 전파 확인

```bash
# 여러 DNS 서버에서 확인
dig @8.8.8.8 genova.genaion.net
dig @8.8.8.8 agriedu.genaion.net

dig @1.1.1.1 genova.genaion.net
dig @1.1.1.1 agriedu.genaion.net
```

### 3. SSL 인증서 확인

```bash
# 브라우저에서 확인
# https://genova.genaion.net
# https://agriedu.genaion.net

# 명령줄에서 확인
curl -I https://genova.genaion.net
curl -I https://agriedu.genaion.net

# SSL 인증서 상세 정보
openssl s_client -connect genova.genaion.net:443 -servername genova.genaion.net
openssl s_client -connect agriedu.genaion.net:443 -servername agriedu.genaion.net
```

### 4. HTTP → HTTPS 리디렉션 확인

```bash
# HTTP 요청 시 HTTPS로 리디렉션되는지 확인
curl -I http://genova.genaion.net
# 예상: Location: https://genova.genaion.net/

curl -I http://agriedu.genaion.net
# 예상: Location: https://agriedu.genaion.net/
```

### 5. 서비스 기능 테스트

**genova.genaion.net 테스트:**
- [ ] 메인 페이지 로드
- [ ] Firebase Google 로그인
- [ ] API 호출 정상 작동
- [ ] 모든 페이지 라우팅 정상

**agriedu.genaion.net 테스트:**
- [ ] 메인 페이지 로드
- [ ] Firebase Google 로그인
- [ ] API 호출 정상 작동
- [ ] 모든 페이지 라우팅 정상

### 6. 성능 테스트

```bash
# 응답 시간 측정
curl -w "@curl-format.txt" -o /dev/null -s https://genova.genaion.net
curl -w "@curl-format.txt" -o /dev/null -s https://agriedu.genaion.net
```

`curl-format.txt`:
```
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
```

---

## 비용 및 리소스

### 예상 월간 비용 (USD)

| 리소스 | 수량 | 예상 비용 | 비고 |
|--------|------|-----------|------|
| Load Balancer | 1개 | $18-25 | 트래픽에 따라 변동 |
| 고정 IP 주소 | 1개 | $3-5 | 사용 중인 경우 무료 |
| SSL 인증서 | 1개 | 무료 | Google-managed |
| Cloud Run (genova-frontend) | 1개 | 기존 비용 | 변동 없음 |
| Cloud Run (genova-frontend-temp) | 1개 | 기존 비용 | 변동 없음 |
| **총계** | - | **$21-30** | 월 예상 추가 비용 |

### 리소스 목록

**생성될 GCP 리소스:**
1. Network Endpoint Groups (NEG): 2개
2. Backend Services: 2개
3. URL Map: 1개
4. SSL Certificate: 1개 (2개 도메인 포함)
5. Target HTTPS Proxy: 1개
6. Target HTTP Proxy: 1개 (리디렉션용)
7. Forwarding Rules: 2개 (HTTPS, HTTP)
8. Global IP Address: 1개

**DNS 레코드 (가비아):**
1. genova.genaion.net (A 레코드)
2. agriedu.genaion.net (A 레코드)

---

## 트러블슈팅

### SSL 인증서가 ACTIVE 상태가 되지 않는 경우

**원인:**
- DNS가 올바르게 설정되지 않음
- DNS 전파가 완료되지 않음
- Load Balancer 구성 오류

**해결:**
```bash
# 1. DNS 확인
nslookup genova.genaion.net
nslookup agriedu.genaion.net

# 2. Load Balancer IP와 DNS IP 일치 확인
gcloud compute addresses describe genova-lb-ip --global

# 3. SSL 인증서 상세 에러 확인
gcloud compute ssl-certificates describe genova-ssl-cert --global --format=json

# 4. 필요시 인증서 재생성
gcloud compute ssl-certificates delete genova-ssl-cert --global
gcloud compute ssl-certificates create genova-ssl-cert \
  --domains=genova.genaion.net,agriedu.genaion.net \
  --global
```

### 502 Bad Gateway 에러

**원인:**
- Backend Service가 Cloud Run 서비스에 연결되지 않음
- Cloud Run 서비스가 실행되지 않음

**해결:**
```bash
# Cloud Run 서비스 상태 확인
gcloud run services describe genova-frontend --region=asia-northeast3
gcloud run services describe genova-frontend-temp --region=asia-northeast3

# Backend Service 확인
gcloud compute backend-services get-health be-genova-frontend --global
gcloud compute backend-services get-health be-genova-frontend-temp --global
```

### 특정 도메인만 작동하지 않는 경우

**원인:**
- URL Map의 호스트 규칙 오류

**해결:**
```bash
# URL Map 확인
gcloud compute url-maps describe genova-url-map --global

# URL Map 재설정 (YAML 파일 사용)
gcloud compute url-maps import genova-url-map \
  --source=genova-url-map.yaml \
  --global
```

### DNS 전파가 느린 경우

**임시 테스트 방법:**
```bash
# /etc/hosts 파일 수정 (Windows: C:\Windows\System32\drivers\etc\hosts)
# 다음 줄 추가 (Step 3에서 얻은 IP 사용)
34.XXX.XXX.XXX genova.genaion.net
34.XXX.XXX.XXX agriedu.genaion.net
```

---

## 롤백 계획

문제 발생 시 원래 상태로 복구하는 방법:

```bash
# 1. Forwarding Rules 삭제
gcloud compute forwarding-rules delete genova-https-forwarding-rule --global --quiet
gcloud compute forwarding-rules delete genova-http-forwarding-rule --global --quiet

# 2. Target Proxies 삭제
gcloud compute target-https-proxies delete genova-https-proxy --global --quiet
gcloud compute target-http-proxies delete genova-http-proxy --global --quiet

# 3. URL Maps 삭제
gcloud compute url-maps delete genova-url-map --global --quiet
gcloud compute url-maps delete genova-http-redirect --global --quiet

# 4. SSL 인증서 삭제
gcloud compute ssl-certificates delete genova-ssl-cert --global --quiet

# 5. Backend Services 삭제
gcloud compute backend-services delete be-genova-frontend --global --quiet
gcloud compute backend-services delete be-genova-frontend-temp --global --quiet

# 6. NEG 삭제
gcloud compute network-endpoint-groups delete neg-genova-frontend --region=asia-northeast3 --quiet
gcloud compute network-endpoint-groups delete neg-genova-frontend-temp --region=asia-northeast3 --quiet

# 7. 고정 IP 삭제 (선택)
gcloud compute addresses delete genova-lb-ip --global --quiet
```

**DNS 복구:**
- 가비아에서 추가한 A 레코드 삭제

---

## 참고 자료

- [Cloud Run 커스텀 도메인 매핑](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Google Cloud Load Balancing](https://cloud.google.com/load-balancing/docs)
- [SSL 인증서 관리](https://cloud.google.com/load-balancing/docs/ssl-certificates)
- [Serverless NEG 개요](https://cloud.google.com/load-balancing/docs/negs/serverless-neg-concepts)

---

## 체크리스트

### 작업 전
- [ ] Google Cloud SDK 설치 및 인증 완료
- [ ] genova-ai-project 프로젝트 접근 권한 확인
- [ ] 가비아 계정 접근 권한 확인
- [ ] 필요한 API 활성화 확인

### 작업 중
- [ ] Step 1: Serverless NEG 생성 완료
- [ ] Step 2: Backend Service 생성 완료
- [ ] Step 3: 고정 IP 주소 예약 완료
- [ ] Step 4: SSL 인증서 생성 완료
- [ ] Step 5: URL Map 생성 완료
- [ ] Step 6: HTTPS Target Proxy 생성 완료
- [ ] Step 7: HTTPS Forwarding Rule 생성 완료
- [ ] Step 8: HTTP 리디렉션 설정 완료
- [ ] Step 9: DNS 설정 완료
- [ ] Step 10: SSL 인증서 활성화 확인

### 작업 후
- [ ] genova.genaion.net HTTPS 접속 확인
- [ ] agriedu.genaion.net HTTPS 접속 확인
- [ ] HTTP → HTTPS 리디렉션 확인
- [ ] 두 서비스 모두 정상 작동 확인
- [ ] SSL 인증서 유효성 확인
- [ ] 성능 테스트 완료
- [ ] 문서 업데이트

---

## 작업 이력

| 날짜 | 작업자 | 작업 내용 | 상태 |
|------|--------|-----------|------|
| 2025-11-13 | - | 문서 작성 | 완료 |
| - | - | 실제 작업 시작 | 대기 중 |

---

## 연락처 및 에스컬레이션

**기술 지원:**
- Google Cloud Support: https://cloud.google.com/support
- 가비아 고객센터: 1544-4755

**프로젝트 담당자:**
- TBD
