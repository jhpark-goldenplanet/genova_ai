# Genova AI - 시스템 아키텍처

## 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Cloud Platform                     │
│                        (asia-northeast3, Seoul)                  │
│                                                                  │
│  ┌──────────────┐     ┌──────────────────────────────────────┐  │
│  │ Cloud Load   │────▶│          Cloud Run                    │  │
│  │ Balancer     │     │                                      │  │
│  │ (SSL/HTTPS)  │     │  ┌─────────────┐  ┌──────────────┐  │  │
│  │              │     │  │  Frontend    │  │  Backend      │  │  │
│  └──────────────┘     │  │  Next.js 14  │  │  FastAPI      │  │  │
│        ▲              │  │  1 vCPU/1GB  │  │  4 vCPU/8GB   │  │  │
│        │              │  │  0-10 inst.  │  │  0-10 inst.   │  │  │
│        │              │  └─────────────┘  └──────┬───────┘  │  │
│  ┌─────┴──────┐       └──────────────────────────┼──────────┘  │
│  │ Cloud      │                                   │             │
│  │ Armor      │       ┌──────────────────────────┼──────────┐  │
│  │ (Geo-block)│       │      데이터 & AI 서비스    │          │  │
│  └────────────┘       │                           ▼          │  │
│                       │  ┌─────────────┐  ┌──────────────┐   │  │
│                       │  │ Cloud SQL   │  │ Vertex AI    │   │  │
│                       │  │ PostgreSQL  │  │ (Gemini)     │   │  │
│                       │  │ 15          │  └──────────────┘   │  │
│                       │  └─────────────┘                     │  │
│                       │  ┌─────────────┐  ┌──────────────┐   │  │
│                       │  │ Cloud       │  │ Translation  │   │  │
│                       │  │ Storage     │  │ API          │   │  │
│                       │  │ (GCS)       │  └──────────────┘   │  │
│                       │  └─────────────┘                     │  │
│                       │  ┌─────────────┐  ┌──────────────┐   │  │
│                       │  │ Redis       │  │ Secret       │   │  │
│                       │  │ (Upstash)   │  │ Manager      │   │  │
│                       │  └─────────────┘  └──────────────┘   │  │
│                       └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 핵심 서비스별 역할

### Frontend (Next.js 14)
- **역할**: 사용자 인터페이스, 인증, 상태 관리
- **리소스**: Cloud Run 1 vCPU / 1GB RAM
- **인증**: Firebase Auth (Google Sign-in, 도메인 제한: @goldenplanet.co.kr)

### Backend (FastAPI)
- **역할**: API 서버, AI 분석 오케스트레이션, 영상 처리
- **리소스**: Cloud Run 4 vCPU / 8GB RAM (영상 처리용)
- **타임아웃**: 요청 300초, 처리 파이프라인 900초
- **인증**: API Key 기반 (Secret Manager 저장)

### Cloud SQL (PostgreSQL 15)
- **역할**: 영상 메타데이터, 분석 결과, 번역 결과 영속 저장
- **연결**: Cloud Run → Cloud SQL Proxy (비공개 IP)

### Cloud Storage (GCS)
- **역할**: 원본 영상 파일, 분할된 영상 클립, 썸네일 저장
- **업로드**: Signed URL 방식 (Cloud Run 32MB 제한 우회)
- **버킷**: `genova-ai-project-genova-videos`

### Redis (Upstash)
- **역할**: 분석 진행 상태 실시간 추적, 캐싱
- **정책**: 512MB, LRU eviction

### Vertex AI (Gemini)
- **역할**: 핵심 AI 엔진
- **모델**: gemini-2.5-flash (또는 gemini-3-flash-preview)
- **기능**: 영상 분석, 요약 생성, 스크립트 추출, 구간 분할, 키워드 추출
- **설정**: temperature=0.1, JSON 응답 강제

### Google Translation API
- **역할**: 분석 결과 다국어 번역
- **지원 언어**: 한국어(기본), 영어, 일본어, 중국어

## 영상 처리 파이프라인

```
사용자 업로드
    │
    ▼
┌─────────────────┐
│ 1. 업로드       │  GCS Signed URL로 직접 업로드 (최대 2GB)
│    (UPLOADING)  │  또는 URL 다운로드 → GCS 전송
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. 요약 생성    │  Gemini가 영상 전체 분석
│ (SUMMARIZATION) │  → 전체 요약, 키워드, 구간 분할 결과 생성
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. 스크립트     │  Gemini가 영상에서 직접 transcript 생성
│  (TRANSCRIBE)   │  (Speech-to-Text API 미사용, Gemini 단독)
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. 마무리       │  결과 DB 저장, 상태 업데이트
│  (FINALIZING)   │  선택적: 다국어 번역 실행
└────────┬────────┘
         ▼
    분석 완료 (COMPLETE)
```

- 각 단계의 진행률은 Redis에 실시간 저장되며, 프론트엔드가 5초 간격으로 폴링
- 실패 시 최대 3회 재시도 (exponential backoff)
- 사용자가 처리 중 취소 가능

## 데이터베이스 구조 (PostgreSQL)

### 핵심 테이블

```
videos (영상)
├── id (UUID PK)
├── title, description
├── status (PENDING → IN_PROGRESS → COMPLETE / FAILED)
├── processing_progress (0-100%)
├── gcs_path, thumbnail_gcs_path
├── analysis_result (JSONB) ─ AI 분석 전체 결과
├── summary, keywords (JSONB)
├── source_language (default: 'ko')
└── created_at, updated_at

segments (구간)
├── id (UUID PK)
├── video_id (FK → videos, CASCADE DELETE)
├── segment_no, start_time, end_time
├── title, summary, keywords, scripts
├── class_type (introduction / content / conclusion)
└── source_language

video_translations (영상 번역)
├── id (UUID PK)
├── video_id + target_language (UNIQUE)
├── translated_title, translated_summary, translated_keywords
└── translation_status

segment_translations (구간 번역)
├── id (UUID PK)
├── segment_id + target_language (UNIQUE)
├── translated_title, translated_summary, translated_keywords, translated_scripts
└── translation_status
```

## 네트워크 & 보안

- **도메인**: genova.genaion.net (가비아 등록, A 레코드 → Static IP)
- **SSL**: Google Managed SSL 인증서
- **Cloud Armor**: 한국 외 지역 Geo-blocking
- **CORS**: genova.genaion.net, 개발 프론트엔드 URL 허용
- **API 인증**: 모든 보호 엔드포인트에 X-API-Key 헤더 필수
- **시크릿 관리**: GCP Secret Manager (DATABASE_URL, API_KEYS, GENAI_API_KEY, REDIS_URL)

## 배포

- **CI/CD**: Google Cloud Build
- **배포 명령**: `./deploy-dev.sh` (backend/frontend 각각)
- **이미지 저장소**: Artifact Registry (`asia-northeast3-docker.pkg.dev`)
- **배포 후 헬스체크 자동 실행**

## 알려진 제약사항

- **YouTube 다운로드**: Cloud Run의 데이터센터 IP가 YouTube에 차단됨 → 로컬 환경에서만 동작
- **Cloud Run 업로드 제한**: 32MB → GCS Signed URL 방식으로 우회
- **프론트엔드 일부 mock**: 워크스페이스 목록, 분석 버전, 프리셋 등은 현재 localStorage 기반
