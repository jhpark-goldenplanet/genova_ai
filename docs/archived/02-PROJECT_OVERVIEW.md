# 프로젝트 개요

이 문서는 Genova AI (AgriEdu) 프로젝트의 비즈니스 배경, 핵심 기능, 기술 스택을 설명합니다.

---

## 프로젝트 배경

### 비즈니스 목적

Genova AI는 **농업 교육용 비디오 콘텐츠를 효율적으로 관리하고 가공**하기 위한 플랫폼입니다.

기존에는 교육 비디오의 요약, 자막 생성, 구간 분할 등의 작업을 수동으로 진행해야 했습니다. 이 플랫폼은 AI 기술을 활용하여 이러한 작업을 자동화합니다.

### 주요 사용자

- **콘텐츠 관리자**: 농업 교육 비디오를 업로드하고 관리
- **교육 담당자**: AI가 생성한 요약/스크립트를 검토하고 편집

### 주요 사용 시나리오

1. **비디오 업로드**: 관리자가 교육 비디오를 업로드 (파일/URL/YouTube)
2. **자동 분석**: AI가 비디오를 분석하여 요약, 스크립트, 세그먼트 생성
3. **검토 및 편집**: 담당자가 AI 결과물을 검토하고 필요시 수정
4. **다국어 번역**: 콘텐츠를 다른 언어로 번역하여 활용

---

## 핵심 기능

### 1. 비디오 업로드

세 가지 방식으로 비디오를 업로드할 수 있습니다:

| 방식 | 설명 |
|------|------|
| **파일 업로드** | 로컬 비디오 파일을 직접 업로드 |
| **URL 업로드** | 비디오 URL을 입력하여 다운로드 |
| **YouTube** | YouTube 링크로 비디오 가져오기 |

- 최대 파일 크기: 2GB
- 4K 비디오는 자동으로 1080p로 다운샘플링

### 2. AI 기반 비디오 분석

Google Vertex AI (Gemini)를 활용한 자동 분석:

- **자동 요약**: 비디오 전체 내용 요약
- **키워드 추출**: 주요 키워드 자동 추출
- **세그먼트 분할**: 비디오를 의미 단위로 자동 분할
- **구간별 요약**: 각 세그먼트별 요약 및 키워드

### 3. 음성-텍스트 변환 (STT)

Google Speech-to-Text API 기반:

- **자동 스크립트 생성**: 음성을 텍스트로 변환
- **타임스탬프**: 각 문장에 시간 정보 포함
- **다국어 지원**: 한국어, 영어 등 다양한 언어 인식

### 4. 다국어 번역

Google Translation API 기반:

| 지원 언어 | 코드 |
|-----------|------|
| 한국어 | ko |
| 영어 | en |
| 일본어 | ja |
| 중국어 | zh |
| 베트남어 | vi |

### 5. 비디오 세그먼트 관리

- 세그먼트 시작/종료 시간 편집
- 세그먼트별 제목, 요약 수정
- 세그먼트별 비디오 다운로드

---

## 기술 스택

### 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14 | React 프레임워크 |
| TypeScript | - | 타입 안전성 |
| React | 18 | UI 라이브러리 |
| Zustand | - | 전역 상태 관리 |
| React Query | - | 서버 상태 관리 |
| Emotion | - | CSS-in-JS 스타일링 |
| Video.js | - | 비디오 플레이어 |

### 백엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| FastAPI | - | 웹 프레임워크 |
| Python | 3.12 | 프로그래밍 언어 |
| SQLAlchemy | 2.0 | ORM (비동기) |
| PostgreSQL | 15 | 메인 데이터베이스 |
| Redis (Upstash) | - | 캐시 및 상태 관리 |
| FFmpeg | - | 비디오 처리 |
| yt-dlp | - | YouTube 다운로드 |

### Google Cloud Platform (GCP)

| 서비스 | 용도 |
|--------|------|
| Cloud Run | 서버리스 컨테이너 실행 |
| Cloud SQL | 관리형 PostgreSQL |
| Cloud Storage | 비디오 파일 저장 |
| Vertex AI | AI/ML 모델 (Gemini) |
| Speech-to-Text | 음성 인식 |
| Translation API | 번역 서비스 |
| Cloud NAT | 외부 API 호출용 고정 IP |

### 외부 서비스

| 서비스 | 용도 |
|--------|------|
| Upstash Redis | 서버리스 Redis 캐시 |
| Firebase Auth | 사용자 인증 |

---

## 프로젝트 구조

```
ax-agriedu-handover/
│
├── ax-agriedu-back-v3/          # 백엔드 프로젝트
│   ├── app/
│   │   ├── api/v1/              # API 엔드포인트
│   │   ├── core/                # 핵심 설정 및 유틸리티
│   │   ├── models/              # SQLAlchemy 모델
│   │   ├── repositories/        # 데이터 액세스 레이어
│   │   ├── schemas/             # Pydantic 스키마
│   │   ├── services/            # 비즈니스 로직
│   │   └── main.py              # FastAPI 앱 진입점
│   ├── deployment/              # 배포 스크립트
│   ├── docs/                    # 백엔드 문서
│   └── tests/                   # 테스트 코드
│
├── axmvp-agriedu-front/         # 프론트엔드 프로젝트
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── (root)/          # 홈 페이지 (업로드)
│   │   │   └── video/           # 비디오 관련 페이지
│   │   │       └── [videoId]/
│   │   │           ├── script/  # 스크립트 페이지
│   │   │           ├── split/   # 세그먼트 분할 페이지
│   │   │           └── summary/ # 요약 페이지
│   │   ├── components/          # 공통 컴포넌트
│   │   └── shared/              # 공유 유틸리티
│   │       ├── apis/            # API 호출 함수
│   │       ├── hooks/           # React 훅
│   │       └── store/           # Zustand 스토어
│   └── public/                  # 정적 파일
│
└── docs/                        # 인수인계 문서 (현재 위치)
```

---

## 비디오 처리 파이프라인

```
[사용자] 비디오 업로드
        ↓
[백엔드] 파일 수신 / URL 다운로드
        ↓
[GCS] Cloud Storage에 저장
        ↓
[백엔드] 비디오 메타데이터 추출 (FFmpeg)
        ↓
[Vertex AI] 비디오 분석 (요약, 세그먼트, 키워드)
        ↓
[Speech-to-Text] 음성 인식 (스크립트 생성)
        ↓
[Translation API] 다국어 번역 (선택적)
        ↓
[DB] 분석 결과 저장
        ↓
[사용자] 결과 확인 및 편집
```

---

## 데이터베이스 스키마 (요약)

### videos 테이블
- 비디오 메타데이터 (제목, 설명, 상태)
- AI 분석 결과 (요약, 키워드)
- GCS 저장 경로

### segments 테이블
- 세그먼트 정보 (시작/종료 시간, 제목)
- 세그먼트별 요약, 키워드, 스크립트

### video_translations 테이블
- 비디오 전체 번역 (요약, 키워드)

### segment_translations 테이블
- 세그먼트별 번역 (제목, 요약, 스크립트)

> 상세 스키마: [ax-agriedu-back-v3/docs/completed/DATABASE.md](../ax-agriedu-back-v3/docs/completed/DATABASE.md)

---

## 환경 구분

| 환경 | 용도 | 특징 |
|------|------|------|
| **Development** | 로컬 개발 | Docker로 DB/Redis 실행 |
| **Production** | 실서비스 | GCP Cloud Run 배포 |

---

## 참고 문서

- [시스템 아키텍처](./03-SYSTEM_ARCHITECTURE.md) - 상세 아키텍처
- [빠른 시작 가이드](./01-QUICK_START_GUIDE.md) - 로컬 환경 구축
- [통합 아키텍처](../ax-agriedu-back-v3/INTEGRATED_ARCHITECTURE.md) - 백엔드 상세
