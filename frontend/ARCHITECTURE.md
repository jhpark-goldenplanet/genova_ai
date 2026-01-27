# 시스템 아키텍처 (System Architecture)

## 개요
본 문서는 `genova-frontend` 애플리케이션의 아키텍처를 기술합니다. 이 시스템은 Genova AI 백엔드 서비스와 상호작용하는 Next.js 기반의 웹 프론트엔드 애플리케이션으로, Google Cloud Platform (GCP)의 Cloud Run을 통해 서버리스 환경에서 실행됩니다.

## 인프라스트럭처 (Infrastructure)

인프라스트럭처는 **Google Cloud Platform (GCP)** 의 `genova-ai-project` 프로젝트 내에 호스팅됩니다.

### 컴퓨팅 (Compute)
- **서비스**: Google Cloud Run (Managed)
- **서비스명**: `genova-frontend`
- **리전**: `asia-northeast3` (서울)
- **리소스**:
  - CPU: 1
  - Memory: 512Mi
- **스케일링**:
  - 최소 인스턴스: 0 (Scale to zero 활성화)
  - 최대 인스턴스: 10
- **인증**: 공개 접근 허용 (`--allow-unauthenticated`)

### 컨테이너 레지스트리 (Container Registry)
- **레지스트리**: Google Container Registry (GCR)
- **이미지 경로**: `gcr.io/genova-ai-project/genova-frontend`

## 네트워크 및 도메인 (Network & Domain)

애플리케이션은 Google Cloud Load Balancing을 통해 서비스되며, 커스텀 도메인이 연결되어 있습니다.

### 도메인 구성
- **프로덕션 도메인**: `genova.genaion.net`
- **SSL/TLS**: Google-managed SSL 인증서 (`genova-ssl-cert`)를 통해 HTTPS 보안 통신을 지원합니다.

### 네트워크 아키텍처
트래픽 흐름은 다음과 같습니다:

1.  **Cloud DNS / 외부 DNS**: `genova.genaion.net` 도메인을 Google Load Balancer IP로 라우팅
2.  **Global External Load Balancer**:
    - **Forwarding Rule**: 443 포트(HTTPS) 트래픽 수신
    - **Target HTTPS Proxy**: SSL 인증서 처리 및 종료
    - **URL Map** (`genova-url-map`): 호스트 기반 라우팅 처리
    - **Backend Service** (`be-genova-frontend`): 트래픽을 Serverless NEG로 전달
3.  **Serverless NEG** (`neg-genova-frontend`): Cloud Run 서비스와의 연결 담당
4.  **Cloud Run** (`genova-frontend`): 실제 애플리케이션 컨테이너 실행

### 아웃바운드 통신 (Outbound)
- **Cloud NAT**: Cloud Run 인스턴스가 외부 인터넷(또는 외부 API)으로 나가는 트래픽에 대해 안정적인 IP 주소를 제공하거나 보안을 강화하기 위해 Cloud NAT 및 VPC 커넥터(또는 Direct VPC Egress)가 구성되어 있을 수 있습니다.

## 소프트웨어 아키텍처 (Software Architecture)

### 프론트엔드 스택
애플리케이션은 **Next.js 14**와 **TypeScript**로 구축되었습니다.

- **프레임워크**: Next.js (React)
- **언어**: TypeScript
- **상태 관리**: 
  - `zustand` (전역 상태)
  - `@tanstack/react-query` (서버 상태 및 캐싱)
- **스타일링**: `@emotion/react`, `@emotion/styled`
- **폼 핸들링**: `react-hook-form`
- **유틸리티**: `lodash-es`, `dayjs`, `xlsx`
- **미디어 처리**: `video.js`, `sharp`

### 백엔드 통합
프론트엔드는 REST API를 통해 별도의 백엔드 서비스와 통신하며, Firebase 서비스와 통합되어 있습니다.

- **백엔드 서비스 URL**: `https://genova-ai-backend-987680405347.asia-northeast3.run.app`
- **인증**: API Key 기반 인증 및 Firebase Auth 사용

### Firebase 통합
애플리케이션은 다음과 같은 Firebase 서비스를 사용하도록 구성되어 있습니다:
- **Project ID**: `genova-ai-project`
- **Auth Domain**: `genova-ai-project.firebaseapp.com`
- **Storage Bucket**: `genova-ai-project.firebasestorage.app`

## 배포 파이프라인 (Deployment Pipeline)

배포 프로세스는 쉘 스크립트와 Google Cloud Build를 통해 자동화되어 있습니다.

1.  **빌드 (Build)**: 
    - `cloudbuild.yaml` 설정을 사용하여 Docker 이미지를 빌드합니다.
    - **Docker 전략**: 멀티 스테이지 빌드 (`deps` -> `builder` -> `runner`)를 사용하여 이미지 크기 최적화.
    - **결과물**: Next.js Standalone 빌드.
    - **보안**: non-root 유저 (`nextjs`)로 실행.
    - 명령: `gcloud builds submit`
2.  **푸시 (Push)**:
    - 빌드된 이미지는 Google Container Registry (`gcr.io`)에 푸시됩니다.
3.  **배포 (Deploy)**:
    - `gcloud run deploy` 명령을 통해 Cloud Run에 이미지를 배포합니다.
    - 배포 시점에 환경 변수가 주입됩니다.

## 구성 (Configuration)

### 환경 변수
애플리케이션은 빌드 타임 및 런타임에 주입되는 다음 환경 변수들에 의존합니다:

| 변수명 | 설명 | 값 (Production) |
|--------|------|-------------------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API 기본 URL | `https://genova-ai-backend-987680405347.asia-northeast3.run.app` |
| `NEXT_PUBLIC_API_KEY` | API 인증 키 | *[보안상 생략]* |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase 설정 키들 | *[cloudbuild.yaml에 구성됨]* |

### 빌드 구성
- **Dockerfile**: 멀티 스테이지 프로세스를 사용하여 Next.js 애플리케이션을 위한 컨테이너 이미지를 정의합니다.
- **cloudbuild.yaml**: Google Cloud Build를 위한 빌드 단계를 정의하며, 빌드 타임 변수 주입을 포함합니다.
