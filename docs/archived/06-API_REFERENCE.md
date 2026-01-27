# API 레퍼런스

이 문서는 Genova AI 백엔드 API의 주요 엔드포인트를 설명합니다.

---

## 기본 정보

### Base URL

| 환경 | URL |
|------|-----|
| 로컬 | http://localhost:8000 |
| 프로덕션 | https://genova-ai-backend-987680405347.asia-northeast3.run.app |

### 인증

모든 API 요청에는 API Key가 필요합니다.

```
Header: X-API-Key: your-api-key
```

### API 문서 (Swagger)

- **Swagger UI**: `{BASE_URL}/docs`
- **ReDoc**: `{BASE_URL}/redoc`

---

## 엔드포인트 요약

### 비디오 관리

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| POST | /v1/video/upload/link | URL로 비디오 업로드 |
| POST | /v1/video/upload/file | 파일로 비디오 업로드 |
| GET | /v1/video/{id}/status | 처리 상태 조회 |
| POST | /v1/video/{id}/analyze | 분석 결과 조회 |
| GET | /v1/video/info/{id} | 비디오 정보 조회 |
| DELETE | /v1/video/delete/{id} | 비디오 삭제 |
| POST | /v1/video/cancel/{id} | 처리 취소 |

### 세그먼트 관리

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /v1/video/split/{id} | 세그먼트 목록 조회 |
| POST | /v1/video/split/{id} | 세그먼트 분할 |
| GET | /v1/video/split/download/{id} | 분할 비디오 다운로드 |

### 스크립트/요약

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /v1/video/script/{id} | 스크립트 조회 |
| GET | /v1/video/summary/{id} | 요약 조회 |

### 시스템

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /health | 헬스체크 |
| GET | / | API 루트 |

---

## 주요 API 상세

### 1. URL로 비디오 업로드

비디오 URL을 입력하여 업로드합니다.

**Request:**
```http
POST /v1/video/upload/link
Content-Type: application/json
X-API-Key: your-api-key

{
  "url": "https://example.com/video.mp4"
}
```

**Response (200):**
```json
{
  "code": 200,
  "message": "Video upload started",
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_id": "file-123",
  "error_code": 0
}
```

**curl 예시:**
```bash
curl -X POST "http://localhost:8000/v1/video/upload/link" \
  -H "X-API-Key: dev-api-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/video.mp4"}'
```

---

### 2. 처리 상태 조회

비디오 처리 진행 상태를 확인합니다.

**Request:**
```http
GET /v1/video/{video_id}/status
X-API-Key: your-api-key
```

**Response (200):**
```json
{
  "code": 200,
  "message": "Status retrieved",
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "IN_PROGRESS",
  "progress": 45,
  "step": "SUMMARIZATION",
  "error_code": 0
}
```

**Status 값:**
| 상태 | 설명 |
|------|------|
| PENDING | 대기 중 |
| IN_PROGRESS | 처리 중 |
| COMPLETE | 완료 |
| FAILED | 실패 |
| CANCELED | 취소됨 |

**Step 값:**
| 단계 | 설명 | 진행률 |
|------|------|--------|
| UPLOADING | 업로드 중 | 0-30% |
| SUMMARIZATION | AI 분석 중 | 30-80% |
| TRANSCRIBE | 음성 인식 중 | 80-95% |
| FINALIZING | 마무리 중 | 95-100% |

**curl 예시:**
```bash
curl "http://localhost:8000/v1/video/550e8400-e29b-41d4-a716-446655440000/status" \
  -H "X-API-Key: dev-api-key-12345"
```

---

### 3. 분석 결과 조회

완료된 비디오의 분석 결과를 조회합니다.

**Request:**
```http
POST /v1/video/{video_id}/analyze
X-API-Key: your-api-key
```

**Response (200):**
```json
{
  "code": 200,
  "message": "Analysis retrieved",
  "file_id": "file-123",
  "title": "농업 교육 비디오",
  "summary": "이 비디오는 농업 기초에 대해 설명합니다...",
  "keywords": ["농업", "교육", "기초"],
  "segments": [
    {
      "segments_id": "seg-001",
      "segment_no": 1,
      "start_time": "00:00:00",
      "end_time": "00:02:30",
      "title": "소개",
      "summary": "비디오 소개 부분...",
      "keywords": ["소개"],
      "scripts": "안녕하세요, 오늘은...",
      "class": "introduction"
    }
  ],
  "gcs_view_link": "https://storage.googleapis.com/...",
  "source_language": "ko",
  "target_language": "en",
  "translated_summary": "This video explains...",
  "translated_keywords": ["agriculture", "education"]
}
```

---

### 4. 세그먼트 분할 다운로드

비디오를 세그먼트별로 분할하여 다운로드 URL을 받습니다.

**Request:**
```http
GET /v1/video/split/download/{video_id}
X-API-Key: your-api-key
```

**Response (200):**
```json
{
  "code": 200,
  "message": "Download URLs generated",
  "urls": [
    {
      "segment_no": 1,
      "file_name": "segment_001.mp4",
      "download_url": "https://storage.googleapis.com/signed-url..."
    },
    {
      "segment_no": 2,
      "file_name": "segment_002.mp4",
      "download_url": "https://storage.googleapis.com/signed-url..."
    }
  ]
}
```

> 다운로드 URL은 24시간 동안 유효합니다.

---

### 5. 비디오 삭제

비디오와 관련 데이터를 삭제합니다.

**Request:**
```http
DELETE /v1/video/delete/{video_id}
X-API-Key: your-api-key
```

**Response (200):**
```json
{
  "code": 200,
  "message": "Video deleted successfully"
}
```

---

### 6. 처리 취소

진행 중인 비디오 처리를 취소합니다.

**Request:**
```http
POST /v1/video/cancel/{video_id}
Content-Type: application/json
X-API-Key: your-api-key

{
  "cancel_reason": "사용자 요청으로 취소"
}
```

**Response (200):**
```json
{
  "code": 200,
  "message": "Video processing canceled",
  "cancel_reason": "사용자 요청으로 취소"
}
```

---

### 7. 헬스체크

시스템 상태를 확인합니다.

**Request:**
```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2025-01-09T10:00:00Z"
}
```

---

## 에러 코드

### HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

### 애플리케이션 에러 코드

| error_code | 설명 |
|------------|------|
| 0 | 성공 |
| 1001 | 비디오를 찾을 수 없음 |
| 1002 | 잘못된 URL 형식 |
| 1003 | 파일 크기 초과 |
| 2001 | 처리 중 오류 |
| 2002 | AI 분석 실패 |
| 2003 | 음성 인식 실패 |

---

## 상태 폴링 가이드

비디오 처리는 비동기로 진행되므로 상태 폴링이 필요합니다.

### 권장 폴링 주기

```javascript
// 2초 간격 폴링 예시
const pollStatus = async (videoId) => {
  const response = await fetch(`/v1/video/${videoId}/status`, {
    headers: { 'X-API-Key': 'your-api-key' }
  });
  const data = await response.json();

  if (data.status === 'COMPLETE') {
    // 완료 처리
  } else if (data.status === 'FAILED') {
    // 실패 처리
  } else {
    // 2초 후 재폴링
    setTimeout(() => pollStatus(videoId), 2000);
  }
};
```

### 진행률 표시

```javascript
// progress 값으로 진행률 표시
const progress = data.progress; // 0-100
const step = data.step; // UPLOADING, SUMMARIZATION, TRANSCRIBE, FINALIZING
```

---

## 참고 문서

- [상세 API 명세서](../ax-agriedu-back-v3/docs/completed/API_SPECIFICATION.md)
- [Swagger UI](https://genova-ai-backend-987680405347.asia-northeast3.run.app/docs)
- [개발 가이드](./04-DEVELOPMENT_GUIDE.md)
