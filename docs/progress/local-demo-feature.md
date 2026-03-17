# Local Demo Feature Integration

- 상태: in-progress
- 담당 역할: 역할 기능개발
- 담당 터미널: HK
- 관련 경로: `frontend/src/app/(root)/components/UploadContent.tsx`, `frontend/src/app/video`, `frontend/src/shared/apis`, `frontend/src/shared/hooks`, `backend/app/api/v1/video.py`
- 목적: 로컬 시연본에서 실제 업로드와 실제 분석 결과 표시가 가능한 최소 기능 연결 확보
- 작업 범위: 새 프로젝트 흐름에서 기존 업로드/분석 API 연결, 단일 결과 기준 상세 화면 연결, 분할 다운로드 점검
- 제외 범위: 다중 분석 버전 백엔드 설계, 프리셋 영속 저장, 재분석 실구현, 개발서버 mock 제거
- 선행 문서: `docs/plan/local-demo-build.md`, `docs/plan/service-roadmap.md`

## 최근 업데이트

- 2026-03-17 16:25: 로컬 시연본 전용 실제 기능 연결 작업을 별도 분리
- 2026-03-17 16:44: 새 프로젝트 업로드 화면이 `DEV_SKIP_UPLOAD_FLOW` mock 분기로 고정된 상태를 확인했고, 실제 GCS 업로드 경로를 기본값으로 전환하는 작업을 시작
- 2026-03-17 16:48: 새 프로젝트 업로드 화면을 실제 `getUploadUrl -> uploadToGCS -> confirmUpload` 경로로 전환했고, 업로드 요청에 프로젝트 제목을 함께 전달하도록 보정. `frontend/tsc --noEmit` 통과
- 2026-03-17 16:55: GCS 버킷 `gs://genova-ai-project-genova-videos` 의 CORS가 비어 있어 브라우저 `PUT` 업로드가 차단되는 문제를 확인. `backend/cors.json` 추가 후 버킷에 적용했고 `gsutil cors get`으로 `PUT/POST/OPTIONS` 및 `http://localhost:3000` 포함 상태를 검증
- 2026-03-17 17:03: 업로드 직후 화면에는 로컬 object URL 기반 원본 영상 미리보기를 추가했고, 상세 화면에는 백엔드 `gcs_view_link`를 사용해 실제 원본 재생이 가능하도록 연결. `frontend/tsc --noEmit` 재검증 통과
- 2026-03-17 17:11: 프리셋/항목 설정을 시연용 fake UI로 명시하고, `분석 시작` 클릭 시 fake 완료 상태를 만들지 않고 즉시 실제 결과 페이지로 이동하도록 변경. 실제 분석은 업로드 직후 서버에서 이미 진행되는 흐름으로 정리. `frontend/tsc --noEmit` 통과
- 2026-03-17 17:18: 시연 흐름에 맞춰 `분석 시작` 클릭 시 결과 페이지로 즉시 이동하지 않고 `분석` 단계로 유지하도록 수정. 기존 상태 조회 API(`statusProgressSummary`)의 실제 상태/단계/진행률을 표시하고, `COMPLETE` 수신 시에만 `완료` 단계로 자동 전환하도록 반영. `frontend/tsc --noEmit` 통과
- 2026-03-17 17:24: 업로드 직후 `analyze` 응답에서 `gcs_view_link`/`thumbnail_url`를 받아 워크스페이스 저장 데이터에 함께 기록하도록 보강. 이제 프로젝트가 생성되면 워크스페이스에서도 원본 영상 재생 영역이 비지 않도록 연결. `frontend/tsc --noEmit` 통과
- 2026-03-17 17:29: `blob:` object URL은 워크스페이스에 영속 저장할 수 없으므로 제거. 워크스페이스 진입 시 `videoUrl`이 비었거나 `blob:`이면 `analyze` API로 실제 `gcs_view_link`/`thumbnail_url`를 재수집해 교체하도록 보강. `frontend/tsc --noEmit` 통과
- 2026-03-17 17:36: `분석 결과` 화면에서 서버 저장 결과(`summary`, `keywords`, `segments`, `scripts`)를 우선 렌더링하도록 전환. 브라우저 console에 `videoInfo`와 상태 스냅샷을 출력해 실제 응답 구조를 바로 확인할 수 있게 추가. `frontend/tsc --noEmit` 통과
- 2026-03-17 17:43: `분할` 탭은 기존 레이아웃을 유지한 채 서버 `segments`를 레일/프리뷰 카드에 매핑하도록 조정. `분할 다운로드`는 현재 서버 세그먼트 기준으로 `splitDownload` API를 호출해 실제 다운로드를 시작하도록 연결. `frontend/tsc --noEmit` 통과
- 2026-03-17 18:32: 분할 탭 액션바에 기존 `썸네일 추가` 모달 기능을 재연결했고, 선택한 이미지를 `splitDownload.thumbnail_image`로 전달하도록 보강. 현재 분할 다운로드는 요청 시마다 FFmpeg 분할/업로드를 다시 수행하므로, 이후에는 분할 결과를 GCS/DB 기준으로 캐시하거나 재사용하는 구조 개편이 필요함. `frontend/tsc --noEmit` 통과

## 다음 액션

- 현재 새 프로젝트 흐름에서 기존 업로드 API 재사용 지점 확인
- 업로드 이후 분석 상태 조회와 완료 전환 경로 정리
- 결과 상세의 요약/분할 탭을 기존 실제 데이터 구조에 맞춰 연결
- 분할 다운로드 성공 경로 확인
