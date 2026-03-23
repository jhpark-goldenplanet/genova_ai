# Conventions

프론트엔드/백엔드 공통 개발 컨벤션.
납품 단계에서 최소한으로 지키는 규칙만 정리한다.

---

## 1. Git

### 커밋 메시지

```
<type>: <설명>
```

| type | 용도 |
|------|------|
| feat | 새 기능 |
| fix | 버그 수정 |
| refactor | 동작 변경 없는 구조 개선 |
| docs | 문서 |
| chore | 빌드, 설정, 의존성 |
| perf | 성능 개선 |
| ci | CI/CD 변경 |

- 한글 또는 영어 모두 허용, 팀 내 통일하면 됨
- 본문은 선택, 필요하면 빈 줄 후 작성

### 브랜치

- `main`: 운영 배포 기준
- `develop`: 개발 통합 (develop 서비스 자동 배포 대상)
- `feat/<기능명>`, `fix/<이슈명>`: 작업 브랜치
- PR 단위로 develop에 머지

### PR

- 제목은 커밋 타입과 동일한 prefix 사용
- 본문에 변경 요약과 확인 방법 포함
- 가능하면 작은 단위로 올림

---

## 2. 코딩 원칙

### 불변성 우선

```javascript
// X
user.name = newName

// O
const updated = { ...user, name: newName }
```

```python
# X
data["name"] = new_name

# O
updated = {**data, "name": new_name}
```

단순 로컬 변수나 성능이 중요한 경우는 예외 허용.

### 파일 크기

- 목표: 400~800줄
- 상한: 1200줄
- 넘으면 분리 검토

### 네이밍

| 대상 | 프론트 (TS/React) | 백엔드 (Python) |
|------|-------------------|-----------------|
| 파일명 | camelCase / PascalCase(컴포넌트) | snake_case |
| 함수/변수 | camelCase | snake_case |
| 상수 | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE |
| 타입/클래스 | PascalCase | PascalCase |

### 에러 핸들링

- 외부 호출(API, DB, 파일)은 반드시 try-catch/try-except
- 에러 메시지에 민감 정보 노출 금지
- 사용자에게 보여줄 메시지와 로그용 메시지 분리

---

## 3. API 계약

### 응답 포맷

모든 API 응답은 아래 구조를 따른다.

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VIDEO_NOT_FOUND",
    "message": "요청한 영상을 찾을 수 없습니다."
  }
}
```

목록 응답에 페이지네이션이 필요한 경우:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

### 에러 코드 규칙

- UPPER_SNAKE_CASE
- `{도메인}_{에러}` 형태 (예: `VIDEO_NOT_FOUND`, `AUTH_INVALID_KEY`)
- HTTP 상태 코드와 함께 사용

### 버전

- API prefix: `/v1`
- 호환성 깨지는 변경은 버전 올림

---

## 4. 입력 검증

경계(boundary)에서 반드시 검증한다.

### 프론트엔드 (zod)

```typescript
import { z } from 'zod'

const uploadSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().optional(),
})

const validated = uploadSchema.parse(input)
```

### 백엔드 (pydantic)

```python
from pydantic import BaseModel, Field

class UploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    url: str | None = None
```

- 프론트 검증은 UX용, 백엔드 검증이 최종 방어선

---

## 5. 환경변수와 시크릿

- 시크릿(API 키, 토큰)은 절대 코드에 하드코딩하지 않음
- 로컬: `.env` / `.env.local`
- 배포: GCP Secret Manager
- `.env.example`에 키 이름과 설명만 기록, 실제 값은 넣지 않음
- 상세 설정은 `docs/infra/LOCAL_SETUP_GUIDE.md` 참고

---

## 6. 현재 단계에서 하지 않는 것

아래 항목은 SaaS 서비스화 단계에서 도입 예정이며, 납품 단계에서는 강제하지 않는다.

| 항목 | 이유 |
|------|------|
| TDD + 80% 커버리지 | 일정 우선, 핵심 경로 수동 확인으로 대체 |
| 풀 코드리뷰 프로세스 | 소규모 팀, PR 설명으로 대체 |
| Repository/Service 계층 분리 강제 | 백엔드 구조 리팩토링은 서비스화 때 |
| E2E 테스트 자동화 | Playwright 셋업은 서비스화 때 |
| 보안 감사 체크리스트 | 기본만 지키고, 정식 보안 검토는 서비스화 때 |
| CI/CD 자동 품질 게이트 | 수동 배포로 운영 중 |

---

## 7. 참고

- 레거시 패턴 원본: `claude-legacy/` (보존용 아카이브)
- API 상세 명세: `docs/backend/API_ENDPOINTS.md`
- DB 스키마: `docs/backend/DATABASE_SCHEMA.md`
- 인프라/배포: `docs/infra/`
