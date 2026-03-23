# API 엔드포인트 명세

Genova AI Backend의 전체 API 엔드포인트 목록과 동영상 처리 플로우입니다.

---

## 📋 목차

1. [API 개요](#-api-개요)
2. [인증 방식](#-인증-방식)
3. [Video API](#-video-api)
4. [Health & Monitoring API](#-health--monitoring-api)
5. [YouTube Authentication API](#-youtube-authentication-api)
6. [동영상 처리 플로우](#-동영상-처리-플로우)
7. [에러 코드](#-에러-코드)

---

## 🌐 API 개요

### Base URL
- **Dev 환경**: `https://genova-ai-backend-987680405347.asia-northeast3.run.app`
- **로컬 환경**: `http://localhost:8000`

### API 버전
- 현재 버전: `v1`
- Prefix: `/v1`

### API 문서
- Swagger UI: `{BASE_URL}/docs`
- ReDoc: `{BASE_URL}/redoc`

---

## 🔐 인증 방식

### API Key 인증
대부분의 엔드포인트는 API Key 인증이 필요합니다.

**인증 방법**:
- Header에 `x-api-key` 추가
- 값: Backend 환경 변수 `API_KEYS`에 설정된 키

**예시**:
```
x-api-key: dev-test-key-123
```

**인증 필요 없는 엔드포인트**:
- GET `/v1/video/{video_id}/status`
- GET `/v1/video/{video_id}/analyze`
- GET `/v1/health/*` (모든 Health Check 엔드포인트)
- GET `/v1/monitoring/*` (모든 Monitoring 엔드포인트)

---

## 🎬 Video API

### 1. 동영상 업로드 (GCS 직접 업로드)

#### 1-1. Signed URL 요청
**Endpoint**: `POST /v1/video/getUploadUrl`
**인증**: 필요
**용도**: GCS 직접 업로드를 위한 Signed URL 생성

**요청 파라미터**:
- `filename`: 파일명 (예: "my_video.mp4")
- `file_size`: 파일 크기 (bytes)
- `content_type`: MIME 타입 (예: "video/mp4")
- `title`: 동영상 제목 (선택)
- `description`: 설명 (선택)

**응답**:
- `video_id`: 생성된 동영상 ID (UUID)
- `upload_url`: GCS Signed URL
- `gcs_path`: GCS 저장 경로
- `expires_at`: URL 만료 시간 (2시간)

**제한사항**:
- 최대 파일 크기: 2GB
- 지원 형식: MP4, MOV, AVI, WMV, FLV, WebM, MKV

#### 1-2. GCS 업로드 (클라이언트에서 수행)
클라이언트가 Signed URL로 직접 PUT 요청을 보내 파일 업로드

#### 1-3. 업로드 확인 및 처리 시작
**Endpoint**: `POST /v1/video/confirmUpload`
**인증**: 필요
**용도**: 업로드 확인 및 처리 파이프라인 시작

**요청 파라미터**:
- `video_id`: 동영상 ID
- `language`: 소스 언어 (기본값: "ko")

**응답**:
- 동영상 메타데이터
- 처리 상태 (PROCESSING)
- 메시지: "Upload confirmed. Processing started."

**처리 파이프라인**:
1. GCS에서 파일 다운로드
2. 동영상 메타데이터 추출 (길이, 해상도 등)
3. AI 분석 및 요약 생성
4. 음성-텍스트 변환 (자막 생성)
5. 동영상 구간 분할
6. 완료 처리

### 2. URL 업로드

**Endpoint**: `POST /v1/video/uploadByLink`
**인증**: 필요
**용도**: URL에서 직접 동영상 다운로드 및 처리

> ⚠️ **YouTube 제한사항**: YouTube URL은 **로컬 환경에서만 작동**합니다. Cloud Run 환경에서는 YouTube의 봇 차단으로 인해 다운로드가 불가능합니다. 자세한 내용은 [YouTube 제한사항 문서](./YOUTUBE_LIMITATIONS.md)를 참조하세요.

**요청 파라미터**:
- `url`: 동영상 URL (직접 링크, ~~YouTube~~)
- `title`: 동영상 제목 (선택)
- `description`: 설명 (선택)

**응답**:
- 동영상 메타데이터
- 처리 상태 (PROCESSING)
- 메시지: "Video upload initiated"

**지원 플랫폼**:
- ~~YouTube~~ (로컬 환경 전용 - [제한사항 문서](./YOUTUBE_LIMITATIONS.md) 참조)
- 직접 동영상 링크 (MP4, MOV 등)

### 3. 처리 상태 조회

**Endpoint**: `GET /v1/video/{video_id}/status`
**인증**: 불필요
**용도**: 실시간 처리 상태 확인 (Redis 기반)

**응답**:
- `status`: 처리 상태
  - `PENDING`: 처리 대기 중
  - `IN_PROGRESS`: 처리 중
  - `COMPLETE`: 완료
  - `FAILED`: 실패
  - `CANCELED`: 취소됨
- `progress`: 진행률 (0-100)
- `step`: 현재 단계 (IN_PROGRESS일 때)
  - `UPLOADING`: 업로드 중
  - `UPLOADING_TO_GCS`: GCS 업로드 중
  - `SUMMARIZATION`: AI 분석 중
  - `TRANSCRIBE`: 자막 생성 중
  - `FINALIZING`: 마무리 중
- `segments`: 완료 시 구간 정보 (COMPLETE일 때)
- `error_message`: 실패 시 에러 메시지

**별칭 엔드포인트** (동일 기능):
- `GET /v1/video/{video_id}/statusProgressSummary` - 요약 단계 상태
- `GET /v1/video/{video_id}/statusProgressTranscribe` - 자막 단계 상태

### 4. 분석 결과 조회

**Endpoint**: `POST /v1/video/{video_id}/analyze?language={lang}`
**인증**: 불필요
**용도**: 완전한 분석 결과 조회 (번역 지원)

**쿼리 파라미터**:
- `language`: 대상 언어 (선택, 예: "en", "ja", "zh")
  - 미지정 시 원본 언어 반환
  - 지정 시 자동 번역 (Google Translate API)

**응답**:
- `title`: 동영상 제목
- `summary`: 요약
- `keywords`: 키워드 배열
- `segments`: 구간 목록
  - `segment_no`: 구간 번호
  - `start_time`: 시작 시간 (HH:MM:SS)
  - `end_time`: 종료 시간 (HH:MM:SS)
  - `title`: 구간 제목
  - `summary`: 구간 요약
  - `scripts`: 자막
  - `class_type`: 구간 분류 (introduction, content, conclusion)
- `processing_status`: 처리 상태
- `source_language`: 소스 언어
- `gcs_view_link`: 동영상 재생 URL (Signed URL, 7일 유효)
- `thumbnail_url`: 썸네일 이미지 URL (Signed URL, 7일 유효)

### 5. 동영상 분할 다운로드

**Endpoint**: `POST /v1/video/{video_id}/splitDownload`
**인증**: 필요
**용도**: 동영상을 구간별로 분할하여 다운로드 URL 생성

**요청 파라미터**:
- `segments`: 분할할 구간 목록
  - `start_time`: 시작 시간 (HH:MM:SS)
  - `end_time`: 종료 시간 (HH:MM:SS)
  - `title`: 구간 제목 (선택)
- `thumbnail_image`: Base64 인코딩된 썸네일 (선택)

**응답**:
- `download_urls`: 각 구간별 다운로드 URL 배열 (Signed URL, 24시간 유효)
- `expires_at`: URL 만료 시간

**제한사항**:
- 최대 10개 구간
- 동영상 상태가 COMPLETE여야 함

**보조 엔드포인트**:
- `GET /v1/video/{video_id}/segments`: AI가 생성한 구간 목록 조회

### 6. 처리 취소

**Endpoint**: `POST /v1/video/{video_id}/cancel`
**인증**: 필요
**용도**: 진행 중인 처리 취소

**응답**:
- `cancelled`: true/false
- `message`: 결과 메시지

### 7. 전체 처리 상태 개요

**Endpoint**: `GET /v1/video/processing/status`
**인증**: 불필요
**용도**: 전체 파이프라인 상태 및 활성 작업 확인

**응답**:
- `pipeline_health`: 파이프라인 헬스 상태
- `active_processing_count`: 처리 중인 동영상 수
- `active_video_ids`: 처리 중인 동영상 ID 목록

---

## 🏥 Health & Monitoring API

### 1. Health Check

**Endpoint**: `GET /v1/health/`
**용도**: 전체 시스템 헬스 체크

**응답**:
- `status`: "healthy", "degraded", "unhealthy"
- `timestamp`: 체크 시간
- `version`: API 버전
- `environment`: 환경 (production, development)
- `uptime_seconds`: 가동 시간
- `checks`: 각 서비스별 상태
  - `database`: PostgreSQL 연결 상태
  - `redis`: Redis 연결 상태
  - `google_cloud`: GCP 서비스 상태
  - `disk_space`: 디스크 공간

**헬스 상태 판단**:
- `healthy`: 모든 서비스 정상
- `degraded`: 일부 비핵심 서비스 문제
- `unhealthy`: Database 또는 Redis 다운

### 2. Liveness Probe

**Endpoint**: `GET /v1/health/live`
**용도**: 컨테이너 Liveness 확인 (Kubernetes용)

**응답**:
- `status`: "alive"
- `uptime_seconds`: 가동 시간

### 3. Readiness Probe

**Endpoint**: `GET /v1/health/ready`
**용도**: 트래픽 수신 준비 상태 확인 (Kubernetes용)

**응답**:
- `status`: "ready"
- `checks`: Database, Redis 상태

**실패 시**: HTTP 503 반환

### 4. Metrics

**Endpoint**: `GET /v1/health/metrics`
**용도**: 애플리케이션 메트릭 조회

**응답**:
- `service`: 서비스 이름
- `version`: 버전
- `environment`: 환경
- `uptime_seconds`: 가동 시간
- `metrics`:
  - `active_video_processing_tasks`: 활성 처리 작업 수

### 5. Error Monitoring

**Endpoint**: `GET /v1/monitoring/health`
**용도**: 에러 기반 헬스 상태 조회

**응답**:
- `status`: 헬스 상태
- `metrics`: 에러 메트릭
- `active_alerts`: 활성 알림 수

**Endpoint**: `GET /v1/monitoring/metrics`
**용도**: 상세 에러 메트릭

**응답**:
- `total_errors`: 총 에러 수
- `error_rate_per_minute`: 분당 에러율
- `severity_distribution`: 심각도별 에러 분포
- `top_errors`: 최다 발생 에러 코드

**Endpoint**: `GET /v1/monitoring/statistics`
**용도**: 종합 모니터링 통계

### 6. Video Error History

**Endpoint**: `GET /v1/monitoring/video/{video_id}/errors?limit=50`
**용도**: 특정 동영상의 에러 이력 조회

**응답**:
- `video_id`: 동영상 ID
- `error_count`: 에러 개수
- `errors`: 에러 목록 (시간 순)

### 7. Recovery Management

**실패 작업 목록**:
- `GET /v1/monitoring/recovery/failed-operations?video_id={id}&step={step}`

**복구 통계**:
- `GET /v1/monitoring/recovery/statistics`

**수동 재시도**:
- `POST /v1/monitoring/recovery/retry`

**복구 예약**:
- `POST /v1/monitoring/recovery/schedule`

**실패 작업 삭제**:
- `DELETE /v1/monitoring/recovery/failed-operations/{operation_id}`

**오래된 작업 정리**:
- `POST /v1/monitoring/recovery/cleanup?max_age_hours=24`

### 8. Alert 관리

**오래된 알림 제거**:

**Endpoint**: `POST /v1/monitoring/alerts/clear?max_age_hours=24`
**용도**: 오래된 알림 제거로 알림 목록 관리

**쿼리 파라미터**:
- `max_age_hours`: 삭제할 알림의 최대 나이 (1-168 시간, 기본값: 24)

**응답**:
```json
{
  "status": "alerts_cleared",
  "message": "Cleared 5 old alerts",
  "cleared_count": 5,
  "max_age_hours": 24
}
```

### 9. Gemini 연결 테스트

**Endpoint**: `GET /v1/monitoring/gemini-test`
**용도**: Gemini API 연결 및 설정 확인

**응답**:
- `env_vars`: 환경 변수 설정 상태
- `config`: AI 클라이언트 설정
- `api_test`: 실제 API 호출 테스트 결과

---

## 🔑 YouTube Authentication API

> ⚠️ **중요**: 이 섹션의 모든 기능은 **로컬 환경 전용**입니다. Cloud Run에서는 YouTube 봇 차단으로 인해 작동하지 않습니다. 자세한 내용은 [YouTube 제한사항 문서](./YOUTUBE_LIMITATIONS.md)를 참조하세요.

### 1. Cookies 업로드 (로컬 전용)

**Endpoint**: `POST /v1/youtube/upload-cookies`
**인증**: 필요
**용도**: YouTube 쿠키 파일 업로드 (연령 제한/멤버 전용 동영상 다운로드)
**환경**: 로컬 개발 환경 전용

**요청**:
- `file`: Netscape 형식 쿠키 파일 (.txt)

**쿠키 추출 방법**:
- Chrome/Firefox 확장: "Get cookies.txt LOCALLY"
- 파일 형식: Netscape HTTP Cookie File

### 2. Cookies 상태 조회 (로컬 전용)

**Endpoint**: `GET /v1/youtube/cookies-status`
**용도**: 쿠키 파일 설정 상태 확인
**환경**: 로컬 개발 환경 전용

**응답**:
- `configured`: true/false
- `cookie_file`: 파일 경로
- `file_size`: 파일 크기
- `last_modified`: 마지막 수정 시간

### 3. Cookies 삭제 (로컬 전용)

**Endpoint**: `DELETE /v1/youtube/cookies`
**인증**: 필요
**환경**: 로컬 개발 환경 전용

### 4. OAuth Token 업로드 (로컬 전용)

**Endpoint**: `POST /v1/youtube/upload-oauth-token`
**인증**: 필요
**용도**: OAuth 2.0 토큰 업로드 (자동 갱신 지원)
**환경**: 로컬 개발 환경 전용

**요청 파라미터**:
- `access_token`: 액세스 토큰
- `refresh_token`: 리프레시 토큰 (선택)
- `expires_at`: 만료 시간 (Unix timestamp)
- `token_type`: 토큰 타입 (기본값: "Bearer")

**토큰 생성 방법**:
```
yt-dlp --username oauth2 --password "" <youtube_url>
```

### 5. OAuth Token 상태 조회 (로컬 전용)

**Endpoint**: `GET /v1/youtube/oauth-status`
**용도**: OAuth 토큰 설정 상태 확인
**환경**: 로컬 개발 환경 전용

**응답**:
- `configured`: true/false
- `has_refresh_token`: 리프레시 토큰 존재 여부
- `expires_at`: 만료 시간
- `is_expired`: 만료 여부
- `can_auto_refresh`: 자동 갱신 가능 여부

### 6. OAuth Token 삭제 (로컬 전용)

**Endpoint**: `DELETE /v1/youtube/oauth-token`
**인증**: 필요
**환경**: 로컬 개발 환경 전용

---

## 🔄 동영상 처리 플로우

### A. GCS 직접 업로드 플로우 (권장)

```
1. [클라이언트] POST /v1/video/getUploadUrl
   → video_id, upload_url 받기

2. [클라이언트] PUT {upload_url}
   → GCS에 직접 파일 업로드

3. [클라이언트] POST /v1/video/confirmUpload
   → 백엔드 처리 시작

4. [백엔드 자동 처리]
   ├─ GCS에서 파일 다운로드
   ├─ 메타데이터 추출 (길이, 해상도 등)
   ├─ AI 분석 (Gemini): 제목, 요약, 키워드 생성
   ├─ 음성-텍스트 변환: 자막 생성
   ├─ 동영상 구간 분할: 세그먼트 생성
   └─ 상태 업데이트: COMPLETE

5. [클라이언트] GET /v1/video/{video_id}/status
   → 진행률 확인 (폴링)

6. [클라이언트] POST /v1/video/{video_id}/analyze
   → 완료 후 전체 결과 조회
```

### B. URL 업로드 플로우

> ⚠️ **주의**: YouTube URL은 로컬 환경에서만 작동합니다.

```
1. [클라이언트] POST /v1/video/uploadByLink
   → video_id 받기

2. [백엔드 자동 처리]
   ├─ URL에서 동영상 다운로드 (yt-dlp)
   │  └─ YouTube: 로컬 환경 전용
   │  └─ 직접 링크: 모든 환경 가능
   ├─ GCS에 업로드
   └─ 위 A 플로우의 4단계와 동일

3. [클라이언트] 위 A 플로우의 5-6단계와 동일
```

### C. 분할 다운로드 플로우

```
1. [클라이언트] GET /v1/video/{video_id}/segments
   → AI 생성 구간 목록 조회 (선택)

2. [클라이언트] POST /v1/video/{video_id}/splitDownload
   → 원하는 구간 지정

3. [백엔드]
   ├─ GCS에서 원본 다운로드
   ├─ FFmpeg로 구간별 분할
   ├─ 썸네일 적용 (선택)
   ├─ GCS에 업로드
   └─ Signed URL 생성 (24시간 유효)

4. [클라이언트] download_urls 사용하여 다운로드
```

### 처리 단계 (Step) 상세

| Step | 설명 | 소요 시간 (예상) |
|------|------|-----------------|
| `UPLOADING` | 파일 업로드 중 | 파일 크기 의존 |
| `UPLOADING_TO_GCS` | GCS 업로드 중 | 파일 크기 의존 |
| `SUMMARIZATION` | AI 분석 및 요약 생성 | 1-3분 |
| `TRANSCRIBE` | 음성-텍스트 변환 | 동영상 길이 의존 |
| `FINALIZING` | 최종 처리 | 30초-1분 |

---

## ❌ 에러 코드

### 표준 에러 응답 형식

모든 에러는 다음 형식으로 반환됩니다:

```json
{
  "error_code": 1001,
  "message": "에러 메시지",
  "timestamp": "2024-01-28T10:00:00Z"
}
```

### 에러 코드 목록

| 코드 | HTTP | 이름 | 설명 |
|------|------|------|------|
| **0** | 200 | SUCCESS | 성공 (에러 없음) |
| **1001** | 400 | INVALID_REQUEST | 잘못된 요청 파라미터 |
| **1002** | 400 | FILE_TOO_LARGE | 파일 크기 초과 (2GB 제한) |
| **1003** | 400 | UNSUPPORTED_FILE_TYPE | 지원하지 않는 파일 형식 |
| **1004** | 404 | VIDEO_NOT_FOUND | 동영상을 찾을 수 없음 |
| **1005** | 500 | PROCESSING_FAILED | 동영상 처리 실패 |
| **1006** | 400 | INVALID_VIDEO_DURATION | 동영상 길이 부적합 (최소 1분) |
| **1400** | 500 | SERVER_ERROR | 내부 서버 오류 |

### 자주 발생하는 에러

#### 1. INVALID_REQUEST (1001)
**원인**:
- 필수 파라미터 누락
- 잘못된 형식의 데이터
- 유효하지 않은 Base64 썸네일

**해결**:
- 요청 파라미터 확인
- API 문서 참조

#### 2. VIDEO_NOT_FOUND (1004)
**원인**:
- 존재하지 않는 video_id
- 삭제된 동영상

**해결**:
- video_id 재확인
- 새로운 업로드 시도

#### 3. PROCESSING_FAILED (1005)
**원인**:
- AI API 호출 실패 (Gemini)
- FFmpeg 처리 오류
- GCS 업로드 실패
- 네트워크 타임아웃

**해결**:
- 로그 확인 (`GET /v1/monitoring/video/{video_id}/errors`)
- 재시도 (`POST /v1/monitoring/recovery/retry`)
- 원본 파일 확인 (손상 여부)

#### 4. SERVER_ERROR (1400)
**원인**:
- 예상치 못한 내부 오류
- 서비스 다운

**해결**:
- Health Check 확인 (`GET /v1/health/`)
- 시스템 관리자에게 문의

---

## 📞 추가 정보

### 관련 문서
- [Backend Dev 가이드](./DEV_BACKEND_GUIDE.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [로컬 셋업 가이드](../infra/LOCAL_SETUP_GUIDE.md)

### API 사용 팁

1. **업로드 방식 선택**:
   - 2GB 이하 파일: GCS 직접 업로드 권장 (빠름)
   - ~~YouTube 동영상: URL 업로드 사용~~ (Cloud Run에서 불가 - [제한사항](./YOUTUBE_LIMITATIONS.md))
   - 직접 동영상 링크: URL 업로드 사용 가능

2. **상태 확인 폴링**:
   - 5-10초 간격으로 `/status` 호출
   - `step` 필드로 현재 단계 파악

3. **번역 사용**:
   - `/analyze?language=en`으로 영어 번역
   - 처음 요청 시 자동 번역 생성 (1-2분 소요)
   - 이후 요청은 캐시된 번역 반환 (즉시)

4. **에러 처리**:
   - 모든 API 호출에 에러 처리 구현
   - `error_code` 기반으로 재시도 로직 작성
   - 타임아웃: 업로드 30초, 처리 상태 조회 10초

5. **Signed URL 관리**:
   - `getUploadUrl`: 2시간 유효 (업로드용)
   - `analyze` 결과: 7일 유효 (재생/썸네일)
   - `splitDownload`: 24시간 유효 (다운로드용)

### 성능 고려사항

- **Cold Start**: 첫 요청은 5-20초 소요 (Cloud Run, CPU Boost 활성화)
- **동시 처리**: 최대 5개 동영상 동시 처리
- **타임아웃**: Cloud Run 최대 3600초 (1시간)
- **파일 크기**: 2GB 제한
- **리소스**: CPU 4 vCPU, Memory 8Gi

---

**최종 업데이트**: 2025-01-28
**API 버전**: v1
