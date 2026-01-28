# Genova AI Frontend

Next.js 기반  동영상 분석 플랫폼 프론트엔드

## 🚀 빠른 시작

### 로컬 개발 환경

#### 1. 환경 변수 설정

`.env.local` 파일 생성:

```bash
cp .env.example .env.local
```

`.env.local` 편집:

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=your-api-key-here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=genova-ai-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=genova-ai-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=genova-ai-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987680405347
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
```

#### 2. 의존성 설치 및 개발 서버 실행

```bash
# 간편하게
./deploy-local.sh

# 또는 수동으로
yarn install
yarn dev
```

서버: http://localhost:3000

---

## 📦 빌드 및 배포

### 로컬 빌드

```bash
yarn build
yarn start
```

### Dev 환경 배포 (Cloud Run)

```bash
./deploy-dev.sh
```

Cloud Build를 통해 자동으로 빌드 및 배포됩니다.

---

## 🛠️ 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Emotion (CSS-in-JS)
- **State Management**: Zustand
- **Data Fetching**: React Query (TanStack Query)
- **Authentication**: Firebase Auth
- **Video Player**: Video.js
- **HTTP Client**: Axios

---

## 📁 프로젝트 구조

```
frontend/
├── public/              # 정적 파일
│   └── images/          # 이미지 리소스
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── layout.tsx   # 루트 레이아웃
│   │   └── video/       # 동영상 관련 페이지
│   ├── components/      # 공통 컴포넌트
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   └── Select/
│   └── shared/          # 유틸리티 및 훅
│       ├── hooks/       # Custom React Hooks
│       └── constants.ts # 상수
├── .env.example         # 환경 변수 예시
├── .env.local           # 로컬 환경 변수 (Git 무시)
├── cloudbuild.yaml      # Cloud Build 설정
├── Dockerfile           # 배포용 Docker 이미지
├── deploy-dev.sh        # Dev 배포 스크립트
└── deploy-local.sh      # 로컬 개발 스크립트
```

---

## 🎨 주요 기능

### 1. 동영상 업로드 및 관리
- 로컬 파일 업로드
- YouTube URL 입력
- 업로드 진행률 표시

### 2. AI 기반 자막 생성
- 자동 음성 인식 (STT)
- 타임스탬프 포함 자막
- 자막 편집 기능

### 3. 구간 분할
- 동영상 구간별 썸네일 생성
- 구간 편집 (시작/종료 시간 조정)
- 구간별 제목 및 설명 추가

### 4. AI 요약
- 동영상 전체 요약
- 구간별 요약
- 타임라인 기반 요약 뷰

### 5. 다국어 지원
- 한국어, 영어, 일본어, 중국어, 베트남어
- 자막 번역
- UI 다국어 지원

---

## 🔧 개발 가이드

### 코드 스타일

프로젝트는 다음 도구를 사용합니다:
- **ESLint**: 코드 린팅
- **Prettier**: 코드 포맷팅

```bash
# 린트 체크
yarn lint

# 포맷 자동 수정
yarn format
```

### 컴포넌트 작성 규칙

1. Functional Components 사용
2. TypeScript Props 타입 정의
3. Emotion styled components 사용
4. Custom Hooks로 로직 분리

예시:
```typescript
import styled from '@emotion/styled';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  onClick,
  children
}) => {
  return (
    <StyledButton variant={variant} onClick={onClick}>
      {children}
    </StyledButton>
  );
};

const StyledButton = styled.button<{ variant: string }>`
  padding: 12px 24px;
  background: ${props => props.variant === 'primary' ? '#007bff' : '#6c757d'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;
```

---

## 🐛 문제 해결

### 빌드 오류

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules .next
yarn install
yarn build
```

### 환경 변수 미적용

Next.js는 `NEXT_PUBLIC_` prefix가 있는 변수만 브라우저에 노출됩니다.
`.env.local` 파일 수정 후 개발 서버를 재시작하세요.

---

## 📝 API 통신

백엔드 API와의 통신은 `axios`를 사용합니다:

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'X-API-Key': API_KEY,
  },
});
```

---

## 🔗 관련 링크

- [백엔드 README](../backend/README.md)
- [인수인계 문서](../docs/todo.md)
- [Next.js 공식 문서](https://nextjs.org/docs)
