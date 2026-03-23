# Genova AI - 기술 스택 상세

## Backend

### 프레임워크 & 런타임
| 기술 | 버전 | 용도 |
|------|------|------|
| Python | 3.12+ | 런타임 |
| FastAPI | 0.104+ | 비동기 웹 프레임워크 |
| Uvicorn | 0.24+ | ASGI 서버 |
| uv | latest | Python 패키지 매니저 (pip 대체) |

### 데이터베이스 & 캐싱
| 기술 | 버전 | 용도 |
|------|------|------|
| PostgreSQL | 15 | 메인 데이터베이스 (Cloud SQL) |
| SQLAlchemy | 2.0+ | 비동기 ORM |
| Asyncpg | 0.29+ | 비동기 PostgreSQL 드라이버 |
| Alembic | 1.12+ | DB 마이그레이션 |
| Redis | 7 | 처리 상태 추적, 캐싱 (Upstash) |

### Google Cloud AI 서비스
| 기술 | 용도 |
|------|------|
| Vertex AI (Gemini) | 영상 분석, 요약, 스크립트 생성, 구간 분할 |
| Google GenAI SDK | Gemini API Key 방식 호출 |
| Cloud Translation API v2 | 다국어 번역 (ko, en, ja, zh) |

### 영상 & 미디어 처리
| 기술 | 용도 |
|------|------|
| FFmpeg | 영상 인코딩, 구간 분할 |
| yt-dlp | YouTube 영상 다운로드 |
| Pillow | 이미지 처리, 썸네일 생성 |
| python-magic | MIME 타입 감지 |

### 비동기 & 네트워크
| 기술 | 용도 |
|------|------|
| HTTPX | 비동기 HTTP 클라이언트 |
| aiohttp | 비동기 HTTP |
| aiofiles | 비동기 파일 I/O |

### 코드 품질
| 기술 | 용도 |
|------|------|
| Black | 코드 포맷팅 |
| isort | import 정렬 |
| flake8 | 린팅 |
| mypy | 타입 체크 |
| pytest + pytest-asyncio | 테스트 |

### 백엔드 아키텍처 레이어

```
API Layer (app/api/v1/)
  → video.py, health.py, monitoring.py
    │
Service Layer (app/services/)
  → video_processing_pipeline.py   # 파이프라인 오케스트레이터
  → ai_orchestrator_service.py     # AI 워크플로우 조정
  → genai_service.py               # Gemini API 호출
  → vertex_ai_service.py           # Vertex AI 호출
  → translation_service.py         # 번역 API 호출
  → video_splitting_service.py     # 영상 분할 (FFmpeg)
  → video_upload_service.py        # 업로드 처리
  → gcs_service.py                 # GCS 스토리지 관리
    │
Repository Layer (app/repositories/)
  → video_repository.py, segment_repository.py, gcs_repository.py
    │
Model Layer (app/models/)
  → video.py (Video, Segment), video_translation.py
    │
Schema Layer (app/schemas/)
  → video.py (Pydantic request/response 모델)
```

### 미들웨어 스택 (요청 처리 순서)
1. SecurityMiddleware — 보안 헤더
2. RequestSizeMiddleware — 요청 크기 제한 (2GB)
3. RateLimitMiddleware — 60 req/min (프로덕션)
4. ErrorHandlingMiddleware — 에러 포맷팅
5. HealthCheckMiddleware — 헬스체크 바이패스
6. RequestTimeoutMiddleware — 300초 타임아웃
7. CORSMiddleware — CORS 설정

---

## Frontend

### 프레임워크 & 런타임
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14.2.25 | App Router, SSR |
| React | 18 | UI 라이브러리 |
| TypeScript | 5 | 타입 안전성 |

### 상태 관리
| 기술 | 버전 | 용도 |
|------|------|------|
| Zustand | 5.0+ | 글로벌 상태 (모달, 언어, 서비스 타입) |
| React Query (TanStack) | 5.64+ | 서버 상태, 캐싱, 폴링 |
| react-hook-form | 7.54+ | 폼 상태 관리 |

### 스타일링
| 기술 | 버전 | 용도 |
|------|------|------|
| @emotion/styled | 11.14+ | CSS-in-JS 컴포넌트 스타일링 |
| @emotion/react | 11.14+ | css prop, Global 스타일 |

### UI 컴포넌트
| 기술 | 용도 |
|------|------|
| video.js + videojs-markers | 영상 플레이어 + 타임라인 마커 |
| react-dropzone | 파일 업로드 드롭존 |
| react-toastify | 토스트 알림 |
| react-modal | 모달 다이얼로그 |
| react-loading-skeleton | 스켈레톤 로딩 |
| @tabler/icons-react | 아이콘 |
| react-markdown | 마크다운 렌더링 |

### 인증
| 기술 | 용도 |
|------|------|
| Firebase Auth | Google Sign-in, 도메인 제한 |

### 유틸리티
| 기술 | 용도 |
|------|------|
| lodash-es | 유틸리티 함수 |
| dayjs | 날짜/시간 처리 |
| xlsx | 엑셀 파일 생성 |
| copy-to-clipboard | 클립보드 |

### 프론트엔드 디자인 시스템

**컬러 팔레트**:
- Primary: `rgba(26, 43, 89, 1)` (다크 네이비)
- Secondary: `rgb(73, 190, 255)` (라이트 블루)
- Success: `rgb(17, 223, 185)` (틸)
- Warning: `rgb(255, 175, 32)` (오렌지)
- Danger: `#ff0000`

**단위 시스템**: `unit(px)` 함수로 px → rem 변환 (base 16px)

**반응형**: 1025px 브레이크포인트 (데스크탑 우선)

**컴포넌트 패턴**: Transient props (`$prop`) 사용하여 DOM 전달 방지

---

## Infrastructure

### GCP 서비스
| 서비스 | 용도 |
|--------|------|
| Cloud Run | 프론트엔드/백엔드 서버리스 배포 |
| Cloud SQL | 관리형 PostgreSQL |
| Cloud Storage | 영상/파일 스토리지 |
| Cloud Build | CI/CD 파이프라인 |
| Artifact Registry | Docker 이미지 저장소 |
| Cloud Load Balancer | HTTPS 로드밸런싱 |
| Cloud Armor | Geo-blocking 보안 |
| Secret Manager | 환경 변수/시크릿 관리 |

### 컨테이너
| 기술 | 용도 |
|------|------|
| Docker | 멀티스테이지 빌드 (Python 3.12-slim) |
| Docker Compose | 로컬 개발 환경 (PostgreSQL + Redis) |

### 외부 서비스
| 서비스 | 용도 |
|--------|------|
| Upstash | 관리형 Redis |
| Firebase | 인증 서비스 |
| 가비아 | 도메인 등록/DNS |
