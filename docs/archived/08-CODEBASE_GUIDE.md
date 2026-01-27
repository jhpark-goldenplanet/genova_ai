# 코드베이스 가이드

이 문서는 백엔드와 프론트엔드의 코드 구조 및 주요 모듈을 설명합니다.

---

## 백엔드 코드 구조

### 전체 구조

```
ax-agriedu-back-v3/
├── app/
│   ├── api/v1/              # API 엔드포인트
│   ├── core/                # 핵심 설정 및 유틸리티
│   ├── models/              # SQLAlchemy 모델
│   ├── repositories/        # 데이터 액세스 레이어
│   ├── schemas/             # Pydantic 스키마
│   ├── services/            # 비즈니스 로직
│   ├── utils/               # 유틸리티
│   └── main.py              # FastAPI 앱 진입점
├── deployment/              # 배포 스크립트
├── tests/                   # 테스트 코드
├── docker-compose.yml       # Docker 설정
├── Dockerfile               # Docker 이미지
└── pyproject.toml           # 의존성
```

---

### API 레이어 (app/api/v1/)

API 엔드포인트 정의.

| 파일 | 역할 |
|------|------|
| `video.py` | 비디오 관련 모든 엔드포인트 |
| `health.py` | 헬스체크 엔드포인트 |
| `monitoring.py` | 모니터링 엔드포인트 |
| `error_management.py` | 에러 관리 API |
| `youtube_cookies.py` | YouTube 쿠키 관리 |

**예시 - video.py:**
```python
@router.post("/upload/link")
async def upload_by_link(
    payload: UploadByLinkRequest,
    session: AsyncSession = Depends(get_db_session),
    api_key: str = Depends(verify_api_key)
):
    """URL로 비디오 업로드"""
    service = VideoUploadService(session)
    return await service.upload_by_link(payload.url)
```

---

### 서비스 레이어 (app/services/)

비즈니스 로직 구현. 가장 중요한 레이어.

#### 주요 서비스 모듈

| 서비스 | 파일 | 역할 |
|--------|------|------|
| VideoService | `video_service.py` | 비디오 CRUD |
| VideoUploadService | `video_upload_service.py` | 업로드 처리 |
| VideoProcessingPipeline | `video_processing_pipeline.py` | 전체 처리 파이프라인 |
| VertexAIService | `vertex_ai_service.py` | AI 분석 (Gemini) |
| SpeechToTextService | `speech_to_text_service.py` | 음성 인식 |
| TranslationService | `translation_service.py` | 번역 |
| VideoStatusService | `video_status_service.py` | 상태 관리 |
| GCSService | `gcs_service.py` | Cloud Storage |
| YouTubeDownloadService | `youtube_download_service.py` | YouTube 다운로드 |

#### 핵심 플로우 - VideoProcessingPipeline

```python
# video_processing_pipeline.py
class VideoProcessingPipeline:
    async def process(self, video_id: str):
        # 1. 비디오 다운로드
        await self._download_video()

        # 2. GCS 업로드
        await self._upload_to_gcs()

        # 3. AI 분석 (Vertex AI)
        await self._analyze_with_ai()

        # 4. 음성 인식 (Speech-to-Text)
        await self._transcribe_audio()

        # 5. 결과 저장
        await self._save_results()
```

#### VertexAIService

```python
# vertex_ai_service.py
class VertexAIService:
    async def analyze_video(self, video_path: str) -> AnalysisResult:
        """비디오 분석 및 요약/세그먼트 생성"""
        # Gemini 모델로 비디오 분석
        # 결과: 요약, 키워드, 세그먼트
```

---

### Repository 레이어 (app/repositories/)

데이터베이스 접근 로직.

| 레포지토리 | 역할 |
|------------|------|
| VideoRepository | 비디오 CRUD |
| SegmentRepository | 세그먼트 CRUD |
| GCSRepository | GCS 파일 관리 |
| VideoTranslationRepository | 비디오 번역 |
| SegmentTranslationRepository | 세그먼트 번역 |

**예시:**
```python
# video_repository.py
class VideoRepository:
    async def get_by_id(self, video_id: str) -> Video | None:
        result = await self.session.execute(
            select(Video).where(Video.id == video_id)
        )
        return result.scalar_one_or_none()

    async def create(self, video_data: VideoCreate) -> Video:
        video = Video(**video_data.dict())
        self.session.add(video)
        await self.session.commit()
        return video
```

---

### Model 레이어 (app/models/)

SQLAlchemy ORM 모델.

| 모델 | 역할 |
|------|------|
| Video | 비디오 메타데이터 |
| Segment | 세그먼트 정보 |
| VideoTranslation | 비디오 번역 |
| SegmentTranslation | 세그먼트 번역 |

**예시 - Video 모델:**
```python
class Video(Base):
    __tablename__ = "videos"

    id = Column(UUID, primary_key=True, default=uuid4)
    title = Column(String, nullable=True)
    status = Column(String, default="PENDING")
    processing_progress = Column(Integer, default=0)
    summary = Column(Text, nullable=True)
    keywords = Column(ARRAY(String), nullable=True)
    gcs_path = Column(String, nullable=True)

    segments = relationship("Segment", back_populates="video")
```

---

### Core 레이어 (app/core/)

핵심 설정 및 유틸리티.

| 파일 | 역할 |
|------|------|
| `config.py` | 환경 변수 설정 |
| `database.py` | DB 연결 관리 |
| `redis.py` | Redis 연결 |
| `auth.py` | API 키 인증 |
| `exceptions.py` | 커스텀 예외 |
| `gcs_config.py` | GCS 설정 |
| `ai_config.py` | AI 서비스 설정 |

---

## 프론트엔드 코드 구조

### 전체 구조

```
axmvp-agriedu-front/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (root)/          # 홈 페이지
│   │   ├── video/           # 비디오 페이지
│   │   ├── layout.tsx       # 루트 레이아웃
│   │   └── error.tsx        # 에러 페이지
│   ├── components/          # 공통 컴포넌트
│   ├── shared/              # 공유 유틸리티
│   │   ├── apis/            # API 호출
│   │   ├── hooks/           # React 훅
│   │   └── store/           # Zustand 스토어
│   └── styles/              # 전역 스타일
├── public/                  # 정적 파일
└── package.json
```

---

### 페이지 구조 (src/app/)

| 경로 | 파일 | 기능 |
|------|------|------|
| `/` | `(root)/page.tsx` | 비디오 업로드 |
| `/video/[id]/script` | `video/[videoId]/script/page.tsx` | 스크립트 확인/편집 |
| `/video/[id]/split` | `video/[videoId]/split/page.tsx` | 세그먼트 분할 |
| `/video/[id]/summary` | `video/[videoId]/summary/page.tsx` | AI 요약 확인 |

---

### 상태 관리

#### Zustand 스토어 (src/shared/store/)

| 스토어 | 역할 |
|--------|------|
| `flag.ts` | UI 플래그 상태 |
| `language.ts` | 언어 설정 |
| `modals.ts` | 모달 상태 |
| `service_type.ts` | 서비스 타입 |

**예시:**
```typescript
// language.ts
import { create } from 'zustand';

interface LanguageStore {
  language: 'ko' | 'en' | 'ja' | 'zh' | 'vi';
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: 'ko',
  setLanguage: (lang) => set({ language: lang }),
}));
```

#### React Query (src/shared/hooks/queries/)

서버 상태 관리.

```typescript
// useVideoStatus.ts
export const useVideoStatus = (videoId: string) => {
  return useQuery({
    queryKey: ['videoStatus', videoId],
    queryFn: () => getVideoStatus(videoId),
    refetchInterval: 2000, // 2초마다 폴링
    enabled: !!videoId,
  });
};
```

---

### API 호출 (src/shared/apis/)

| 파일 | 역할 |
|------|------|
| `apiActions.ts` | API 호출 함수 |
| `video.ts` | 비디오 관련 API |

**예시:**
```typescript
// apiActions.ts
export const uploadVideoByLink = async (url: string) => {
  const response = await fetch('/v1/video/upload/link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.NEXT_PUBLIC_API_KEY,
    },
    body: JSON.stringify({ url }),
  });
  return response.json();
};
```

---

### 컴포넌트 (src/components/)

| 폴더 | 컴포넌트 |
|------|----------|
| `auth/` | 인증 관련 (GoogleSignIn, LoginPage) |
| `Button/` | 버튼 컴포넌트 |
| `Input/` | 입력 컴포넌트 (Text, TextArea, File, Check, Radio) |

---

## 코드 패턴 및 컨벤션

### 백엔드 패턴

**1. Dependency Injection**
```python
@router.get("/{video_id}")
async def get_video(
    video_id: str,
    session: AsyncSession = Depends(get_db_session),
    api_key: str = Depends(verify_api_key)
):
    repo = VideoRepository(session)
    return await repo.get_by_id(video_id)
```

**2. Repository 패턴**
- 모든 DB 접근은 Repository를 통해
- Service는 Repository를 주입받아 사용

**3. 비동기 처리**
- 모든 I/O는 async/await 사용
- SQLAlchemy async 세션 사용

### 프론트엔드 패턴

**1. Server/Client Component 분리**
```typescript
// page.tsx (Server Component)
export default async function Page() {
  return <ClientComponent />;
}

// ClientComponent.tsx (Client Component)
'use client';
export default function ClientComponent() {
  const [state, setState] = useState();
  // ...
}
```

**2. 커스텀 훅 패턴**
```typescript
// useVideoInfo.ts
export const useVideoInfo = (videoId: string) => {
  const { data, isLoading, error } = useQuery({...});
  return { videoInfo: data, isLoading, error };
};
```

---

## 참고 문서

- [개발 가이드](./04-DEVELOPMENT_GUIDE.md)
- [API 레퍼런스](./06-API_REFERENCE.md)
- [백엔드 README](../ax-agriedu-back-v3/README.md)
