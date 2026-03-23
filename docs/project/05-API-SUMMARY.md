# Genova AI - API 엔드포인트 요약

## Base URL

- 로컬: `http://localhost:8000`
- 개발서버: Cloud Run 내부 URL
- API 문서 (Swagger): `{BASE_URL}/docs`
- 모든 보호 엔드포인트에 `X-API-Key` 헤더 필수

## 영상 업로드 흐름

대용량 영상은 3단계 Signed URL 방식으로 업로드한다 (Cloud Run 32MB 제한 우회).

```
Step 1: POST /v1/video/getUploadUrl
  → { filename, content_type, file_size }
  ← { upload_url (GCS Signed URL), gcs_path, video_id }

Step 2: PUT {upload_url} (클라이언트가 GCS에 직접 업로드)
  → 영상 바이너리

Step 3: POST /v1/video/confirmUpload
  → { video_id, gcs_path, title }
  ← { video_id, status: "processing" }
  → 백엔드 비동기 처리 파이프라인 자동 시작
```

URL 업로드 (소규모):
```
POST /v1/video/uploadByLink
  → { url, title }
  ← { video_id, status }
```

## 처리 상태 조회

```
GET /v1/video/{video_id}/status
  ← { status, progress, current_step }

GET /v1/video/{video_id}/statusProgressSummary
  ← { step: "summarization", progress: 45 }

GET /v1/video/{video_id}/statusProgressTranscribe
  ← { step: "transcribe", progress: 80 }

GET /v1/video/processing/status
  ← 전체 활성 처리 작업 목록
```

처리 상태 값: `PENDING` → `UPLOADING` → `UPLOADING_TO_GCS` → `SUMMARIZATION` → `TRANSCRIBE` → `FINALIZING` → `COMPLETE` / `FAILED`

프론트엔드는 5초 간격으로 폴링하여 진행률을 표시한다.

## 분석 결과 조회

```
POST /v1/video/{video_id}/analyze
  → { language: "ko" }  (선택적, 번역 언어)
  ← {
      title, summary, keywords,
      segments: [{
        segment_no, start_time, end_time,
        title, summary, scripts, keywords,
        class_type
      }],
      translation: { ... }  (language 지정 시)
    }
```

## 구간 정보 조회

```
GET /v1/video/{video_id}/segments
  ← [{ segment_no, start_time, end_time, title, summary, class_type }]
```

## 분할 다운로드

```
POST /v1/video/{video_id}/splitDownload
  → {
      segments: [{ start_time, end_time, title }],
      include_thumbnail: true
    }
  ← {
      download_urls: [{ segment_title, video_url, thumbnail_url }]
    }
```

## 처리 취소

```
POST /v1/video/{video_id}/cancel
  ← { status: "cancelled" }
```

## 헬스체크 & 모니터링

```
GET /v1/health         # 종합 (DB, Redis, GCP, 디스크)
GET /v1/health/live    # Liveness probe
GET /v1/health/ready   # Readiness probe
GET /v1/health/metrics # 애플리케이션 메트릭
```

## 에러 응답 형식

```json
{
  "success": false,
  "error": {
    "code": 1001,
    "message": "Video not found",
    "request_id": "uuid"
  }
}
```

주요 에러 코드 범위:
- 1000번대: 비디오 관련
- 1100번대: 업로드 관련
- 1200번대: 처리 관련
- 1300번대: AI 서비스 관련
- 1400번대: 스토리지 관련
