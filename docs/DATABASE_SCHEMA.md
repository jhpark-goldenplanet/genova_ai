# Database Schema

Genova AI 프로젝트의 PostgreSQL 데이터베이스 스키마 구조입니다.

---

## 📋 목차

1. [개요](#-개요)
2. [ERD (Entity Relationship Diagram)](#-erd-entity-relationship-diagram)
3. [테이블 상세](#-테이블-상세)
4. [인덱스 전략](#-인덱스-전략)
5. [데이터 흐름](#-데이터-흐름)
6. [주요 쿼리 패턴](#-주요-쿼리-패턴)

---

## 🌐 개요

### 데이터베이스 정보
- **DBMS**: PostgreSQL 15
- **위치**: Cloud SQL (asia-northeast3)
- **데이터베이스명**: `genova_ai`
- **사용자**: `genova_user`

### 테이블 구조
총 **4개 테이블**로 구성:
1. **videos**: 동영상 메타데이터 및 분석 결과
2. **segments**: 동영상 구간 정보
3. **video_translations**: 동영상 번역 데이터
4. **segment_translations**: 구간 번역 데이터

### 핵심 개념
- **Multi-language Support**: 소스 언어 + 다국어 번역 지원
- **Cascade Delete**: 동영상 삭제 시 관련 데이터 자동 삭제
- **JSONB Storage**: 복잡한 데이터는 JSONB로 저장 (키워드, AI 결과 등)
- **Automatic Timestamps**: `updated_at` 자동 업데이트 (Trigger)

---

## 📊 ERD (Entity Relationship Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│                         videos                              │
│─────────────────────────────────────────────────────────────│
│ PK  id (UUID)                                               │
│     title, description, summary                             │
│     status, processing_progress                             │
│     duration_seconds, file_size_bytes                       │
│     gcs_path, thumbnail_gcs_path                            │
│     analysis_result (JSONB)                                 │
│     keywords (JSONB)                                        │
│     source_language                                         │
│     created_at, updated_at                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ 1:N (cascade delete)
                   │
        ┌──────────┴──────────┬──────────────────┐
        │                     │                  │
        ▼                     ▼                  │
┌───────────────┐    ┌──────────────────┐       │
│   segments    │    │video_translations│       │
│───────────────│    │──────────────────│       │
│ PK  id (UUID) │    │ PK  id (UUID)    │       │
│ FK  video_id ────┐ │ FK  video_id ────────────┘
│     segment_no│  │ │     target_lang  │
│     start_time│  │ │     transl_title │
│     end_time  │  │ │     transl_summ  │
│     title     │  │ │     transl_keys  │
│     summary   │  │ │     status       │
│     keywords  │  │ └──────────────────┘
│     scripts   │  │
│     class_type│  │
└───────┬───────┘  │
        │          │
        │ 1:N      │
        │          │
        ▼          │
┌──────────────────┴──┐
│segment_translations │
│─────────────────────│
│ PK  id (UUID)       │
│ FK  segment_id      │
│     target_language │
│     transl_title    │
│     transl_summary  │
│     transl_keywords │
│     transl_scripts  │
│     status          │
└─────────────────────┘
```

**관계 요약**:
- `videos` → `segments`: 1:N (한 동영상에 여러 구간)
- `videos` → `video_translations`: 1:N (한 동영상에 여러 언어 번역)
- `segments` → `segment_translations`: 1:N (한 구간에 여러 언어 번역)
- 모든 외래키는 **ON DELETE CASCADE** (부모 삭제 시 자식도 삭제)

---

## 📋 테이블 상세

### 1. videos 테이블

**용도**: 동영상의 기본 정보와 AI 분석 결과 저장

**주요 컬럼**:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | UUID | Primary Key, 동영상 고유 ID |
| `title` | VARCHAR(255) | 동영상 제목 |
| `description` | TEXT | 동영상 설명 |
| `source_type` | VARCHAR(20) | 업로드 방식 (FILE_UPLOAD, YOUTUBE, URL) |
| `status` | VARCHAR(20) | 처리 상태 (아래 참조) |
| `processing_progress` | INTEGER | 진행률 (0-100) |
| `duration_seconds` | INTEGER | 동영상 길이 (초) |
| `file_size_bytes` | INTEGER | 파일 크기 (bytes) |
| `original_filename` | VARCHAR(255) | 원본 파일명 |
| `mime_type` | VARCHAR(100) | MIME 타입 (video/mp4 등) |
| `gcs_path` | VARCHAR(500) | GCS 저장 경로 |
| `thumbnail_gcs_path` | VARCHAR(500) | 썸네일 GCS 경로 |
| `analysis_result` | JSONB | AI 분석 전체 결과 (원본) |
| `raw_results` | JSONB | 원시 AI 응답 데이터 |
| `summary` | TEXT | 동영상 요약 |
| `keywords` | JSONB | 키워드 배열 |
| `source_language` | VARCHAR(10) | 소스 언어 (ko, en, ja 등) |
| `created_at` | TIMESTAMP | 생성 시간 |
| `updated_at` | TIMESTAMP | 수정 시간 (자동 업데이트) |

**status 값**:
- `PENDING`: 처리 대기 중
- `PROCESSING`: 처리 중
- `COMPLETE`: 완료
- `FAILED`: 실패

**source_type 값**:
- `FILE_UPLOAD`: GCS 직접 업로드
- `YOUTUBE`: YouTube URL
- `URL`: 직접 동영상 링크

**JSONB 컬럼 구조**:

`keywords`:
```json
["농업기술", "스마트팜", "IoT", "작물재배"]
```

`analysis_result`:
```json
{
  "title": "스마트팜 기술 소개",
  "summary": "최신 스마트팜 기술과 IoT 활용 방법",
  "keywords": ["스마트팜", "IoT"],
  "segments": [...]
}
```

---

### 2. segments 테이블

**용도**: 동영상을 의미 있는 구간으로 분할한 정보 저장

**주요 컬럼**:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | UUID | Primary Key, 구간 고유 ID |
| `video_id` | UUID | Foreign Key → videos.id (CASCADE) |
| `segment_no` | INTEGER | 구간 번호 (1부터 시작) |
| `start_time` | VARCHAR(8) | 시작 시간 (HH:MM:SS 형식) |
| `end_time` | VARCHAR(8) | 종료 시간 (HH:MM:SS 형식) |
| `title` | VARCHAR(255) | 구간 제목 |
| `summary` | TEXT | 구간 요약 |
| `keywords` | JSONB | 구간 키워드 배열 |
| `scripts` | TEXT | 자막/스크립트 (전체 텍스트) |
| `class_type` | VARCHAR(20) | 구간 분류 (아래 참조) |
| `source_language` | VARCHAR(10) | 소스 언어 |
| `created_at` | TIMESTAMP | 생성 시간 |
| `updated_at` | TIMESTAMP | 수정 시간 (자동 업데이트) |

**class_type 값**:
- `introduction`: 도입부 (인사, 주제 소개)
- `content`: 본문 (핵심 내용)
- `conclusion`: 결론 (요약, 마무리)

**시간 형식**:
- `start_time`, `end_time`: "00:01:30" (1분 30초)
- 문자열로 저장하여 사용자 친화적 표시

**예시**:
```
segment_no: 1
start_time: "00:00:00"
end_time: "00:02:15"
title: "스마트팜 개요"
class_type: "introduction"
```

---

### 3. video_translations 테이블

**용도**: 동영상 전체의 다국어 번역 데이터 저장

**주요 컬럼**:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | UUID | Primary Key |
| `video_id` | UUID | Foreign Key → videos.id (CASCADE) |
| `target_language` | VARCHAR(10) | 대상 언어 (en, ja, zh 등) |
| `translated_title` | VARCHAR(255) | 번역된 제목 |
| `translated_summary` | TEXT | 번역된 요약 |
| `translated_keywords` | JSONB | 번역된 키워드 배열 |
| `translation_status` | VARCHAR(20) | 번역 상태 (PENDING, COMPLETE, FAILED) |
| `translation_provider` | VARCHAR(50) | 번역 제공자 (google_translate) |
| `translation_model` | VARCHAR(100) | 사용된 모델 (현재 미사용, 향후 LLM 기반 번역 시 사용 예정) |
| `created_at` | TIMESTAMP | 생성 시간 |
| `updated_at` | TIMESTAMP | 수정 시간 |

**Unique Constraint**:
- `(video_id, target_language)`: 동일 동영상-언어 조합은 1개만 존재

**언어 코드** (ISO 639-1):
- `ko`: 한국어
- `en`: 영어
- `ja`: 일본어
- `zh`: 중국어
- `es`: 스페인어
- `fr`: 프랑스어

---

### 4. segment_translations 테이블

**용도**: 동영상 구간별 다국어 번역 데이터 저장

**주요 컬럼**:

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | UUID | Primary Key |
| `segment_id` | UUID | Foreign Key → segments.id (CASCADE) |
| `target_language` | VARCHAR(10) | 대상 언어 |
| `translated_title` | VARCHAR(255) | 번역된 구간 제목 |
| `translated_summary` | TEXT | 번역된 구간 요약 |
| `translated_keywords` | JSONB | 번역된 키워드 배열 |
| `translated_scripts` | TEXT | 번역된 자막 |
| `translation_status` | VARCHAR(20) | 번역 상태 |
| `translation_provider` | VARCHAR(50) | 번역 제공자 |
| `translation_model` | VARCHAR(100) | 사용된 모델 (현재 미사용, 향후 LLM 기반 번역 시 사용 예정) |
| `created_at` | TIMESTAMP | 생성 시간 |
| `updated_at` | TIMESTAMP | 수정 시간 |

**Unique Constraint**:
- `(segment_id, target_language)`: 동일 구간-언어 조합은 1개만 존재

**번역 흐름**:
1. 사용자가 `/analyze?language=en` 호출
2. Backend가 번역 필요 여부 확인
3. 번역 없으면 Google Translate API 호출 (일괄 처리)
4. 번역 결과를 DB에 저장
5. 이후 요청은 캐시된 번역 반환

**현재 구현 상태**:
- **번역 제공자**: Google Translate API만 사용 중
- **translation_model 컬럼**: 현재 NULL (미사용)
- **향후 확장**: LLM 기반 번역 추가 시 모델 정보 저장 가능
- **TRANSLATOR_MODEL_ID 환경변수**: 제거됨 (2026-01-28)

---

## 🚀 인덱스 전략

### videos 테이블 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `idx_videos_status` | status | 상태별 필터링 (진행 중인 동영상 조회) |
| `idx_videos_source_type` | source_type | 업로드 방식별 필터링 |
| `idx_videos_created_at` | created_at | 시간순 정렬 (최근 동영상) |
| `idx_videos_gcs_path` | gcs_path | GCS 경로 검색 |
| `idx_videos_thumbnail_gcs_path` | thumbnail_gcs_path | 썸네일 경로 검색 |

### segments 테이블 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `idx_segments_video_id` | video_id | 특정 동영상의 구간 조회 |
| `idx_segments_video_segment` | (video_id, segment_no) | 특정 동영상의 구간 번호로 조회 |
| `idx_segments_class_type` | class_type | 구간 분류별 필터링 |

### video_translations 테이블 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `idx_video_translations_video_id` | video_id | 특정 동영상의 번역 조회 |
| `idx_video_translations_language` | target_language | 특정 언어의 번역 조회 |
| `idx_video_translations_status` | translation_status | 번역 상태별 필터링 |

### segment_translations 테이블 인덱스

| 인덱스명 | 컬럼 | 용도 |
|----------|------|------|
| `idx_segment_translations_segment_id` | segment_id | 특정 구간의 번역 조회 |
| `idx_segment_translations_language` | target_language | 특정 언어의 번역 조회 |
| `idx_segment_translations_status` | translation_status | 번역 상태별 필터링 |

---

## 🔄 데이터 흐름

### 1. 동영상 업로드 및 처리

```
[1단계: 초기 생성]
videos 테이블에 레코드 생성
├─ status: PENDING
├─ gcs_path: NULL
└─ processing_progress: 0

[2단계: GCS 업로드]
videos 업데이트
├─ gcs_path: "videos/{video_id}/original.mp4"
└─ status: PROCESSING

[3단계: AI 분석]
videos 업데이트
├─ summary: "AI가 생성한 요약"
├─ keywords: ["키워드1", "키워드2"]
├─ analysis_result: {...}
└─ processing_progress: 50

[4단계: 구간 생성]
segments 테이블에 여러 레코드 생성
├─ segment 1: 00:00:00 - 00:02:15
├─ segment 2: 00:02:15 - 00:05:30
└─ segment 3: 00:05:30 - 00:08:00

[5단계: 완료]
videos 업데이트
├─ status: COMPLETE
├─ processing_progress: 100
└─ thumbnail_gcs_path: "thumbnails/{video_id}/thumb.jpg"
```

### 2. 번역 요청 및 생성

```
[사용자 요청]
POST /v1/video/{video_id}/analyze?language=en

[Backend 처리]
1. video_translations 조회
   └─ (video_id, target_language='en') 존재?

2-1. 존재하면: 저장된 번역 반환
2-2. 없으면: 번역 생성 프로세스 시작

[번역 생성 프로세스]
1. video_translations 레코드 생성 (status: PENDING)

2. segment_translations 레코드 생성 (각 구간별)

3. Google Translate API 일괄 호출
   ├─ 동영상 제목, 요약, 키워드
   └─ 모든 구간의 제목, 요약, 키워드, 자막

4. 번역 결과 저장
   ├─ video_translations 업데이트 (status: COMPLETE)
   └─ segment_translations 업데이트 (status: COMPLETE)

5. 번역된 데이터 반환
```

### 3. 동영상 삭제

```
DELETE videos WHERE id = {video_id}

[Cascade Delete 자동 실행]
├─ segments 삭제 (모든 구간)
│   └─ segment_translations 삭제 (모든 구간 번역)
└─ video_translations 삭제 (모든 동영상 번역)
```

---

## 📝 주요 쿼리 패턴

### 1. 동영상 상세 조회 (원본)

**목적**: 특정 동영상의 기본 정보와 모든 구간 조회 (원본 언어)

**단계**:
1. videos 테이블에서 동영상 조회
2. segments 테이블에서 구간 목록 조회 (segment_no 순)

**성능**:
- `idx_segments_video_id` 인덱스 사용
- JOIN 없이 2번의 쿼리로 처리

---

### 2. 동영상 상세 조회 (번역)

**목적**: 특정 언어로 번역된 동영상 및 구간 조회

**단계**:
1. videos 테이블에서 동영상 조회
2. video_translations에서 번역 조회
3. segments 테이블에서 구간 조회
4. segment_translations에서 각 구간별 번역 조회

**성능**:
- `idx_video_translations_video_id` 인덱스 사용
- `idx_segment_translations_segment_id` 인덱스 사용

---

### 3. 처리 중인 동영상 목록

**목적**: 현재 처리 중인 모든 동영상 조회

**조건**:
- status = 'PROCESSING'

**성능**:
- `idx_videos_status` 인덱스 사용

---

### 4. 최근 업로드 동영상

**목적**: 최근 업로드된 동영상 목록 (페이지네이션)

**조건**:
- created_at 기준 내림차순 정렬
- LIMIT, OFFSET 사용

**성능**:
- `idx_videos_created_at` 인덱스 사용

---

### 5. 특정 언어 번역 상태 확인

**목적**: 특정 동영상의 특정 언어 번역 존재 여부

**조건**:
- video_id, target_language

**성능**:
- Unique constraint가 인덱스 역할
- 빠른 조회 가능

---

## 🔧 데이터베이스 관리

### 백업 전략
- **자동 백업**: 매일 새벽 2시 (KST)
- **보관 기간**: 7일
- **백업 방법**: Cloud SQL 자동 백업

### 용량 관리
- **videos.analysis_result**: 동영상당 ~10KB
- **segments.scripts**: 구간당 ~2-5KB (자막 전체 텍스트)
- **예상 크기**: 동영상 1개당 약 50-100KB (메타데이터만)

### 주의사항
1. **JSONB 컬럼**: 복잡한 쿼리 피하기 (인덱싱 제한적)
2. **Cascade Delete**: videos 삭제 시 모든 관련 데이터 삭제됨
3. **번역 데이터**: 언어별로 별도 저장되므로 다국어 지원 시 용량 증가

---

## 📞 추가 정보

### 관련 문서
- [API Endpoints](./API_ENDPOINTS.md)
- [Backend Dev 가이드](./DEV_BACKEND_GUIDE.md)
- [로컬 셋업 가이드](./LOCAL_SETUP_GUIDE.md)

### 스키마 파일 위치
- SQL 스키마: `backend/sql/init-schema.sql`
- 마이그레이션: (현재 미사용, 수동 관리)

### 데이터베이스 접속
로컬에서 Cloud SQL 접속:
```bash
gcloud sql connect genova-postgres \
  --user=genova_user \
  --project=genova-ai-project
```

---

**최종 업데이트**: 2025-01-28
**스키마 버전**: 1.0.0
