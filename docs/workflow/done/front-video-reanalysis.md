# 영상 재분석 기능 기획

- 상태: done
- 담당 역할: Planner
- 담당 터미널: 현재 세션
- 관련 경로:
  - `frontend/src/app/video/[videoId]/components/MockDetailContent.tsx` (분할 UI)
  - `frontend/src/app/video/[videoId]/split/page.tsx` (split 페이지)
- 목적: 유저가 설정한 분할점 기준으로 재분석/분할다운로드 API 호출 준비 (프론트 선행 작업)
- 작업 범위: 프론트엔드만 — 재분석/분할다운로드 버튼에 console.log 출력
- 제외 범위: 백엔드 API 구현 (별도 담당자 작업 중), 실제 API 연동
- 선행 문서: `docs/project/07-VIDEO-SPLIT-STATUS.md`

## 배경

- 현재 영상 분석 시 AI가 구간을 자동으로 결정함
- 유저가 UI에서 수동 분할점을 드래그로 설정할 수 있지만, 재분석 버튼은 placeholder 상태
- 분할 다운로드는 AI 세그먼트 기준으로 동작하며, 유저 분할점 미반영
- 백엔드 인프라(Vertex AI/GenAI 프롬프트, API)는 백엔드 담당자가 별도 작업 예정

## 핵심 판단

### 물리 분할 없이 분석 가능한가?

**가능하다.** Gemini는 영상 전체를 이해한 상태에서 특정 시간 구간의 내용을 분석할 수 있다.
프롬프트에 유저 분할점(시간 구간)을 전달하면 해당 구간별 요약/스크립트/키워드를 생성한다.

### 2단계 흐름

| 단계 | 트리거 | 동작 | 물리 분할 |
|------|--------|------|-----------|
| 재분석 | 재분석 버튼 | 유저 분할점 → API 전달 → 구간별 요약/스크립트/키워드 → DB 저장 | X |
| 다운로드 | 다운로드 버튼 | 선택 세그먼트 → 새 API 전달 → 물리 분할 → 다운로드 | O |

## 프론트엔드 구현 범위 (현재 작업 대상)

### 재분석 버튼

- 재분석 버튼 클릭 시, 유저가 설정한 분할점을 API 요청 형태로 변환
- **실제 API 호출 대신 `console.log`로 전달 데이터 출력**
- 출력 예시:
```js
console.log('[재분석 요청]', {
  video_id: 'xxx',
  segments: [
    { segment_no: 1, start_time: '00:00:00', end_time: '00:02:30' },
    { segment_no: 2, start_time: '00:02:30', end_time: '00:05:15' },
    { segment_no: 3, start_time: '00:05:15', end_time: '00:08:00' },
  ]
});
```

### 분할 다운로드 버튼

- 기존 splitDownload API 호출 로직 제거 (또는 비활성화)
- **클릭 시 `console.log('분할 영상 다운로드 요청')` 출력만**
- 새로운 다운로드 API가 나올 때까지 대기

## API 스펙 (백엔드 참고용)

### POST /v1/video/{video_id}/reanalyze (예정)

요청:
```json
{
  "segments": [
    { "segment_no": 1, "start_time": "00:00:00", "end_time": "00:02:30" },
    { "segment_no": 2, "start_time": "00:02:30", "end_time": "00:05:15" },
    { "segment_no": 3, "start_time": "00:05:15", "end_time": "00:08:00" }
  ]
}
```

응답:
```json
{
  "segments": [
    {
      "segment_no": 1,
      "start_time": "00:00:00",
      "end_time": "00:02:30",
      "title": "도입부",
      "summary": "영상의 주제를 소개하고...",
      "keywords": ["소개", "개요", "목표"],
      "scripts": "안녕하세요, 오늘은..."
    }
  ],
  "analysis_mode": "premium"
}
```

### 분할 다운로드 API (예정)

- 새 API 스펙 미정, 백엔드 담당자 작업 후 연동

## 최근 업데이트

- 2026-03-25: 프론트 구현 완료 — 재분석/분할다운로드 console.log 출력
- 2026-03-25: 기획 초안 작성, 물리 분할 없이 분석 가능 확인
- 2026-03-25: 프론트 작업 범위 확정 — console.log 선행 구현, 백엔드는 별도 담당

## 다음 액션

- 백엔드 재분석 API (POST /v1/video/{video_id}/reanalyze) 준비 후 연동
- 백엔드 분할 다운로드 새 API 준비 후 연동
