# 영상 분할 기능 현황 (2026-03-25 기준)

## 완전히 동작하는 기능

### 백엔드
- AI 구간 분할 (Gemini 기반 또는 영상 길이 기반 fallback)
- FFmpeg 영상 자르기 (병렬 처리, 최대 3개 동시)
- 썸네일 → 1초 영상 변환 → 세그먼트 앞에 붙이기 (코덱/해상도/비트레이트 자동 매칭)
- GCS 업로드 + Signed URL 생성 (24시간 만료)
- 코덱 호환성 체크 + 자동 트랜스코딩 (VP9/Opus → H.264/AAC)
- 세그먼트 DB CRUD (생성/조회/수정/삭제/번역)
- Redis 락으로 동일 영상 동시 분할 방지
- 세그먼트 검증 (시간 겹침, 최소/최대 길이, 최대 10개)

### 프론트엔드
- 영상 플레이어 + 타임라인 마커 (10색 컬러)
- AI 생성 세그먼트 표시 (제목, 시간, 키워드, 요약)
- 세그먼트 선택 (체크박스, 전체선택/해제)
- 분할 다운로드 요청 → 파일 순차 다운로드
- 썸네일 업로드 모달 (드래그앤드롭, PNG/JPG, 50MB 제한)
- 드래그 가능한 수동 분할점 (추가/삭제/리셋, 최소 8% 간격)

## Mock / 미연동 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| 수동 분할점 저장 | UI만 존재 | 드래그로 분할점 조정 가능하지만 DB에 저장 안 됨 |
| 세그먼트 제목/시간 수정 저장 | UI만 존재 | 편집은 되지만 백엔드에 반영 안 됨 |
| 재분석 버튼 | placeholder | 버튼 있지만 동작 없음 |
| split 페이지 구조 | 최소 | MockDetailContent에 위임, 독립 페이지 구조 아님 |

## 데이터 흐름 (분할 다운로드)

```
사용자: 세그먼트 선택 + 썸네일(선택)
  │
  ▼
프론트: handleConfirmSplitDownload()
  │  payload: { segments: [{segment_no, start_time, end_time, title}], thumbnail_image: base64 }
  │
  ▼
API: POST /v1/video/{video_id}/splitDownload
  │
  ▼
백엔드: split_video_and_generate_urls()
  ├── 1. GCS에서 원본 영상 다운로드
  ├── 2. 썸네일 있으면 → 1초 영상으로 변환 (원본 코덱/해상도 매칭)
  ├── 3. 세그먼트별 병렬 처리 (최대 3동시):
  │      ├── FFmpeg stream copy (또는 트랜스코딩)
  │      ├── 썸네일 영상 concat
  │      └── GCS 업로드
  ├── 4. Signed URL 생성 (24시간)
  └── 5. 임시 파일 정리
  │
  ▼
응답: { download_urls: [{segment_no, title, download_url, file_size_bytes}], expires_at }
  │
  ▼
프론트: fetch(url) → blob → 브라우저 다운로드
```

## API 스펙

### POST /v1/video/{video_id}/splitDownload

요청:
```json
{
  "segments": [
    { "segment_no": 1, "start_time": "00:00:00", "end_time": "00:01:30", "title": "도입부" }
  ],
  "thumbnail_image": "data:image/jpeg;base64,..."
}
```

응답:
```json
{
  "download_urls": [
    {
      "segment_no": 1,
      "title": "도입부",
      "download_url": "https://storage.googleapis.com/...",
      "file_size_bytes": 1234567,
      "gcs_path": "gs://bucket/..."
    }
  ],
  "expires_at": "2026-03-26T12:00:00Z"
}
```

제약:
- 영상 상태가 COMPLETE여야 함
- 최소 1개, 최대 10개 세그먼트
- 썸네일은 PNG/JPEG/GIF만 허용 (base64)

### GET /v1/video/{video_id}/segments

AI가 생성한 세그먼트 목록 조회 (splitDownload에 참조용)

## DB 모델 (segments 테이블)

```
id: UUID (PK)
video_id: UUID (FK → videos, CASCADE DELETE)
segment_no: int
start_time: str ("HH:MM:SS")
end_time: str ("HH:MM:SS")
title: str (255자)
summary: text (nullable)
keywords: JSON list (nullable)
scripts: text (nullable)
class_type: str (introduction / content / conclusion)
source_language: str (default: "ko")
created_at, updated_at: datetime
```

## 주요 파일 위치

### 프론트엔드
- `frontend/src/app/video/[videoId]/split/page.tsx` — split 페이지
- `frontend/src/app/video/[videoId]/split/styled.ts` — 타임라인, 분할점 스타일
- `frontend/src/app/video/[videoId]/split/components/AddThumbnailModal.tsx` — 썸네일 업로드
- `frontend/src/app/video/[videoId]/components/MockDetailContent.tsx` — 분할 UI 메인 로직
- `frontend/src/components/VideoPlayer/index.tsx` — Video.js 플레이어
- `frontend/src/shared/apis/video.ts` — splitDownload API 호출
- `frontend/src/shared/hooks/queries/video.ts` — useSplitDownload 훅

### 백엔드
- `backend/app/api/v1/video.py` — splitDownload 엔드포인트
- `backend/app/services/video_splitting_service.py` — FFmpeg 분할 + GCS 업로드
- `backend/app/services/video_segmentation_service.py` — AI/시간 기반 세그먼트 생성
- `backend/app/models/video.py` — Segment 모델
- `backend/app/repositories/segment_repository.py` — 세그먼트 CRUD
- `backend/app/schemas/video.py` — 요청/응답 스키마
