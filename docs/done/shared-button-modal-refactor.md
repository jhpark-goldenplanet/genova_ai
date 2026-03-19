# Shared Button Modal Refactor

- 완료일: 2026-03-17
- 담당 역할: 역할 리팩토링
- 담당 브랜치: `refactor-shared-button-modal`
- 관련 경로: `frontend/src/components/Button`, `frontend/src/components/Modal`, `frontend/src/app/(root)/components`, `frontend/src/app/(root)/settings/page.tsx`, `frontend/src/app/(root)/workspace/page.tsx`, `frontend/src/app/video/components`, `frontend/src/app/video/[videoId]/split/components`, `frontend/src/app/video/[videoId]/settings/page.tsx`, `frontend/src/components/auth/LoginPage.tsx`, `frontend/src/app/error.tsx`, `frontend/src/app/global-error.tsx`

## 무엇을

- 공통 `Button` 컴포넌트에 `children`, `size`, `fullWidth`, 확장 variant, `className` 기반 재사용성을 추가했다.
- 공통 모달 스타일 레이어(`SharedModalOverlay`, `SharedModalPanel`, `SharedModalHeader`, `SharedModalFooter` 등)를 추가했다.
- 경고/확인 모달과 주요 페이지 모달/CTA 버튼을 공통 컴포넌트 기반으로 수렴했다.

## 어디를

- `frontend/src/components/Button/*`
- `frontend/src/components/Modal/*`
- `frontend/src/app/(root)/components/ProfileModal.tsx`
- `frontend/src/app/(root)/components/InsertLinkModal.tsx`
- `frontend/src/app/(root)/components/MemberManagementPage.tsx`
- `frontend/src/app/(root)/settings/page.tsx`
- `frontend/src/app/(root)/workspace/page.tsx`
- `frontend/src/app/video/components/NewVideoModal.tsx`
- `frontend/src/app/video/[videoId]/split/components/AddThumbnailModal.tsx`
- `frontend/src/app/video/[videoId]/settings/page.tsx`
- `frontend/src/components/auth/LoginPage.tsx`
- `frontend/src/app/error.tsx`
- `frontend/src/app/global-error.tsx`

## 왜

- 페이지별 `styled.button`, 수제 모달 overlay/card, 액션 버튼 스타일 중복이 누적되어 새 모달 추가 시 UI 불일치가 반복되고 있었다.
- 공통 primitive를 넓혀 두면 이후 신규 모달/버튼은 페이지 로컬 스타일을 다시 만들지 않고 같은 레이어 위에서 구현할 수 있다.

## 검증

- `cd frontend && yarn tsc --noEmit`

## 후속 작업

- `frontend/src/app/(root)/components/UploadContent.tsx`의 모달 액션 버튼도 같은 공통 버튼으로 수렴
- `frontend/src/app/video/[videoId]/components/MockDetailContent.tsx`의 split 액션 버튼군 정리
- 더 이상 쓰지 않는 페이지 로컬 버튼/모달 스타일 export 정리
