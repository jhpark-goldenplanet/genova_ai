# 개발 가이드

이 문서는 로컬 개발 환경 설정, 코드 스타일, 개발 워크플로우를 설명합니다.

---

## 개발 환경 구성

### IDE 설정 (VS Code 권장)

#### 필수 확장 프로그램

**백엔드 (Python):**
- Python (ms-python.python)
- Pylance (ms-python.vscode-pylance)
- Black Formatter (ms-python.black-formatter)
- isort (ms-python.isort)

**프론트엔드 (TypeScript):**
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- TypeScript Vue Plugin (Volar)

**공통:**
- GitLens (eamodio.gitlens)
- Docker (ms-azuretools.vscode-docker)

#### VS Code 설정 (settings.json)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": "explicit"
    }
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "python.analysis.typeCheckingMode": "basic"
}
```

---

## 백엔드 개발

### 프로젝트 실행

```bash
cd ax-agriedu-back-v3

# Docker로 DB/Redis 실행
docker-compose up -d postgres redis

# 애플리케이션 실행 (핫 리로드)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 코드 포매팅

```bash
# Black으로 코드 포매팅
uv run black app tests

# isort로 import 정렬
uv run isort app tests

# 한 번에 실행
uv run black app tests && uv run isort app tests
```

### 타입 검사

```bash
# mypy로 타입 검사
uv run mypy app
```

### 린팅

```bash
# flake8 린팅
uv run flake8 app tests
```

### 테스트 실행

```bash
# 모든 테스트 실행
uv run pytest

# 특정 파일 테스트
uv run pytest tests/test_video.py

# 커버리지 포함
uv run pytest --cov=app --cov-report=html

# 상세 출력
uv run pytest -v
```

### 새 기능 추가 시 패턴

1. **API 엔드포인트**: `app/api/v1/`에 추가
2. **비즈니스 로직**: `app/services/`에 서비스 클래스 생성
3. **데이터 액세스**: `app/repositories/`에 레포지토리 추가
4. **스키마**: `app/schemas/`에 Pydantic 모델 정의
5. **DB 모델**: `app/models/`에 SQLAlchemy 모델 추가

---

## 프론트엔드 개발

### 프로젝트 실행

```bash
cd axmvp-agriedu-front

# 의존성 설치
yarn install

# 개발 서버 실행 (핫 리로드)
yarn dev
```

### 코드 포매팅

```bash
# Prettier로 포매팅
yarn format
# 또는
npx prettier --write "src/**/*.{ts,tsx}"
```

### 린팅

```bash
# ESLint 실행
yarn lint

# 자동 수정
yarn lint --fix
```

### 빌드

```bash
# 프로덕션 빌드
yarn build

# 빌드 결과 실행
yarn start
```

### 새 기능 추가 시 패턴

1. **페이지**: `src/app/`에 Next.js App Router 페이지 생성
2. **컴포넌트**: `src/components/`에 재사용 컴포넌트 추가
3. **API 호출**: `src/shared/apis/`에 함수 추가
4. **상태 관리**: `src/shared/store/`에 Zustand 스토어 추가
5. **React Query**: `src/shared/hooks/queries/`에 훅 추가

---

## 코드 스타일 가이드

### 백엔드 (Python)

```python
# 좋은 예시
class VideoService:
    def __init__(self, video_repo: VideoRepository):
        self.video_repo = video_repo

    async def get_video(self, video_id: str) -> Video:
        """비디오 조회"""
        video = await self.video_repo.get_by_id(video_id)
        if not video:
            raise VideoNotFoundError(video_id)
        return video

# 나쁜 예시 - 피해야 할 패턴
def get_video(id):  # 타입 힌트 없음
    video = db.query(Video).filter(Video.id == id).first()  # 직접 쿼리
    return video
```

**규칙:**
- 모든 함수에 타입 힌트 사용
- async/await 패턴 일관성 유지
- Repository 패턴으로 데이터 액세스 분리
- 의미 있는 변수/함수명 사용

### 프론트엔드 (TypeScript)

```typescript
// 좋은 예시
interface VideoProps {
  videoId: string;
  title: string;
  onSelect?: (id: string) => void;
}

const VideoCard: React.FC<VideoProps> = ({ videoId, title, onSelect }) => {
  const handleClick = () => {
    onSelect?.(videoId);
  };

  return (
    <div onClick={handleClick}>
      <h3>{title}</h3>
    </div>
  );
};

// 나쁜 예시
const VideoCard = (props: any) => {  // any 타입 사용
  return <div onClick={() => props.onSelect(props.videoId)}>{props.title}</div>;
};
```

**규칙:**
- 명시적 타입 정의 (any 사용 금지)
- 함수형 컴포넌트 + React.FC 사용
- 이벤트 핸들러는 handle* 명명
- Props 인터페이스 별도 정의

---

## Git 워크플로우

### 브랜치 전략

```
main          - 프로덕션 배포 브랜치
  └── develop - 개발 통합 브랜치
       ├── feature/xxx - 기능 개발
       ├── fix/xxx     - 버그 수정
       └── hotfix/xxx  - 긴급 수정
```

### 커밋 메시지 컨벤션

```
<type>(<scope>): <subject>

# 예시
feat(video): 비디오 분할 다운로드 기능 추가
fix(api): 상태 폴링 타임아웃 버그 수정
docs(readme): 설치 가이드 업데이트
refactor(service): VideoService 로직 분리
test(video): 비디오 업로드 테스트 추가
```

**Type:**
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 리팩토링
- `test`: 테스트
- `chore`: 기타 작업

---

## 디버깅 가이드

### 백엔드 디버깅

**1. 로그 레벨 변경**
```env
# .env
LOG_LEVEL=DEBUG
```

**2. SQL 쿼리 로깅**
```env
DATABASE_ECHO=true
```

**3. 특정 요청 디버깅**
```python
import logging
logger = logging.getLogger(__name__)

logger.debug(f"Processing video: {video_id}")
```

**4. VS Code 디버거**
`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload"],
      "jinja": true
    }
  ]
}
```

### 프론트엔드 디버깅

**1. React DevTools**
- Chrome 확장 프로그램 설치
- 컴포넌트 상태/Props 확인

**2. Network 탭 활용**
- API 요청/응답 확인
- 헤더, 페이로드 검사

**3. Console 로깅**
```typescript
console.log('API Response:', response);
console.table(segments);
```

---

## 로컬 테스트 시나리오

### 비디오 업로드 테스트

1. http://localhost:3000 접속
2. URL로 비디오 업로드 선택
3. 테스트 URL 입력 (짧은 비디오)
4. 업로드 시작
5. 상태 폴링 확인 (개발자 도구 Network 탭)
6. 완료 후 결과 확인

### API 직접 테스트 (curl)

```bash
# 비디오 업로드
curl -X POST http://localhost:8000/v1/video/upload/link \
  -H "X-API-Key: dev-api-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/video.mp4"}'

# 상태 확인
curl http://localhost:8000/v1/video/{video_id}/status \
  -H "X-API-Key: dev-api-key-12345"
```

---

## 참고 문서

- [API 레퍼런스](./06-API_REFERENCE.md)
- [코드베이스 가이드](./08-CODEBASE_GUIDE.md)
- [환경 변수 가이드](../ax-agriedu-back-v3/docs/completed/ENVIRONMENT_VARIABLES.md)
