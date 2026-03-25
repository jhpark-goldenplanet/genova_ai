# Branch 기반 자동 배포 가이드

## 목적

- `main` 브랜치에 push되면 운영 Cloud Run 서비스로 배포
- `develop` 브랜치에 push되면 develop Cloud Run 서비스로 배포

## 무엇을 어디에 왜

- `frontend/cloudbuild.yaml`
  - 운영 프론트 배포용 Cloud Build
  - 저장소 루트 기준 경로로 수정해서 수동 배포와 GitHub 트리거를 같이 지원
- `frontend/cloudbuild-develop-service.yaml`
  - develop 프론트 배포용 Cloud Build
  - develop 백엔드 주소를 바라보도록 수정
- `backend/cloudbuild.yaml`
  - 운영 백엔드 배포용 Cloud Build
  - 저장소 루트 기준 경로로 수정해서 GitHub 트리거에서도 정상 동작
- `backend/cloudbuild-develop-service.yaml`
  - develop 백엔드 전용 Cloud Run 서비스 `genova-ai-backend-develop` 배포
- `scripts/setup-branch-deploy-triggers.sh`
  - GCP Cloud Build GitHub 트리거를 생성 또는 갱신하는 스크립트

## 배포 대상

| 브랜치 | 프론트 서비스 | 백엔드 서비스 | 주소 |
|---|---|---|---|
| `main` | `genova-frontend` | `genova-ai-backend` | 기존 운영 주소 |
| `develop` | `genova-frontend-develop` | `genova-ai-backend-develop` | Cloud Run develop 주소 |

develop 기본 주소 예시:

- Frontend: `https://genova-frontend-develop-987680405347.asia-northeast3.run.app`
- Backend: `https://genova-ai-backend-develop-987680405347.asia-northeast3.run.app`

## 트리거 생성 방법

저장소 루트에서 실행:

```bash
chmod +x scripts/setup-branch-deploy-triggers.sh
./scripts/setup-branch-deploy-triggers.sh
```

선택적으로 서비스 계정을 지정할 수 있습니다:

```bash
SERVICE_ACCOUNT="projects/genova-ai-project/serviceAccounts/PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
./scripts/setup-branch-deploy-triggers.sh
```

## 동작 방식

- `genova-frontend-main`: `main` + `frontend/**` 변경 시 `frontend/cloudbuild.yaml`
- `genova-frontend-develop`: `develop` + `frontend/**` 변경 시 `frontend/cloudbuild-develop-service.yaml`
- `genova-backend-main`: `main` + `backend/**` 변경 시 `backend/cloudbuild.yaml`
- `genova-backend-develop`: `develop` + `backend/**` 변경 시 `backend/cloudbuild-develop-service.yaml`

## 주의사항

- 이 설정은 develop용 별도 Cloud Run URL을 만듭니다. 별도 커스텀 도메인이 필요하면 Cloud Run 도메인 매핑 또는 Load Balancer 추가 설정이 필요합니다.
- 현재 backend develop 서비스도 운영과 같은 Cloud SQL, Redis, GCS를 사용합니다. 완전히 분리된 개발 환경이 필요하면 secret, DB, bucket을 따로 만들어서 `backend/cloudbuild-develop-service.yaml`을 추가 수정해야 합니다.
