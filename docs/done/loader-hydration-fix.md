# Loader Hydration Fix

- 완료일: 2026-03-19
- 담당 역할: 역할 리팩토링
- 관련 경로: `frontend/src/components/Loader.tsx`

## 무엇을

- `Loader`가 mount 이전에는 포털을 열지 않도록 수정했다.

## 어디를

- `frontend/src/components/Loader.tsx`

## 왜

- 서버 렌더에서는 `document`가 없어 `null`이 나오고, 클라이언트 첫 렌더에서는 즉시 `createPortal(...)`이 실행되어 hydration mismatch가 발생하고 있었다.

## 검증

- `cd frontend && yarn tsc --noEmit`
