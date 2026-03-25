# 분석 프리셋 구조 재설계

- 상태: done
- 담당 역할: Planner → 기능개발/화면개발로 전달
- 담당 터미널: 현재 세션 (기획), 별도 터미널 (구현)
- 관련 경로:
  - `frontend/src/app/(root)/components/UploadContent.tsx` (CONFIGURE 화면, 프리셋 UI)
  - `frontend/src/app/video/[videoId]/settings/page.tsx` (설정·재생성 페이지)
  - `frontend/src/app/video/[videoId]/components/MockDetailContent.tsx` (재분석 버튼)
  - `frontend/src/components/Tooltip/index.tsx` (공통 Tooltip 컴포넌트)
- 목적: 시연용 태그를 실제 프롬프트에 반영 가능한 프리셋 구조로 재설계
- 작업 범위: 프론트엔드 프리셋 데이터 구조 + UI 변경, 백엔드 프롬프트 전달 준비
- 제외 범위: 백엔드 프롬프트 엔지니어링 구현 (별도 담당)
- 선행 문서: `docs/plan/analysis-mode-dual-track.md`, `docs/progress/video-reanalysis.md`

## 배경

현재 프리셋 태그(전체 요약 밀도, 타임라인 기준, 강조 포인트, 표현 방식)는 시연용으로 만든 것이며, 실제 Gemini 프롬프트에 반영되지 않는다. 태그 조합이 결과에 영향을 주지 않으므로 유저에게 의미 없는 UI 상태.

## 프리셋 구조 재설계

### 프리셋 차원 (4개)

| 차원 | key | 선택지 | 프롬프트 반영 방식 |
|------|-----|--------|-------------------|
| 요약 밀도 | `summaryDensity` | 간략 / 표준 / 상세 | summary 길이 지시 (1-2줄 / 3-5문장 / 문단) |
| 분석 관점 | `analysisFocus` | 핵심 정리 / 실행 항목 / 학습 포인트 / Q&A 추출 | summary에서 뽑는 초점 |
| 스크립트 정리 | `scriptStyle` | 원문 그대로 / 다듬기 / 요약 전사 | transcript 후처리 수준 |
| 출력 톤 | `tone` | 간결 / 보고서 톤 / 쉬운 설명 | 전체 출력 말투 |

### 데이터 구조

```typescript
// 프리셋 차원 타입
type SummaryDensity = 'brief' | 'standard' | 'detailed';
type AnalysisFocus = 'key_points' | 'action_items' | 'learning' | 'qa';
type ScriptStyle = 'verbatim' | 'polished' | 'condensed';
type OutputTone = 'concise' | 'formal' | 'easy';

// 프리셋 구조
interface AnalysisPreset {
  name: string;
  summaryDensity: SummaryDensity;
  analysisFocus: AnalysisFocus;
  scriptStyle: ScriptStyle;
  tone: OutputTone;
  isDefault?: boolean;       // 기본 제공 프리셋 여부
  updatedAt: string;
}
```

### 기본 제공 프리셋 (4개)

| 프리셋명 | summaryDensity | analysisFocus | scriptStyle | tone |
|----------|---------------|---------------|-------------|------|
| 빠른 요약 | brief | key_points | verbatim | concise |
| 회의록 정리 | detailed | action_items | polished | formal |
| 강의 노트 | standard | learning | polished | easy |
| 자막용 | standard | key_points | condensed | concise |

### 기존 태그 방식과의 차이

| | 기존 (태그 토글) | 변경 (차원별 선택) |
|---|---|---|
| 선택 방식 | 태그 자유 조합 (다중 선택) | 차원별 1개씩 선택 (라디오) |
| 조합 수 | 불명확 (태그 조합 폭발) | 명확 (3×4×3×3 = 108가지) |
| 프롬프트 매핑 | 불가능 (규칙 없음) | 가능 (차원별 프롬프트 조각 매핑) |
| 유저 체감 | 뭘 선택해도 결과 동일 | 차원마다 결과가 달라짐 |

### 프롬프트 매핑 예시 (백엔드 참고용)

```python
# summaryDensity
DENSITY_PROMPT = {
    'brief': '각 구간을 1-2문장으로 간략히 요약해주세요.',
    'standard': '각 구간을 3-5문장으로 요약해주세요.',
    'detailed': '각 구간을 문단 단위로 상세히 설명해주세요. 맥락과 근거를 포함합니다.',
}

# analysisFocus
FOCUS_PROMPT = {
    'key_points': '핵심 내용과 주요 결론을 중심으로 정리해주세요.',
    'action_items': '실행해야 할 항목, 결정 사항, 담당자를 중심으로 정리해주세요.',
    'learning': '학습 목표, 핵심 개념, 이해해야 할 포인트를 중심으로 정리해주세요.',
    'qa': '주요 질문과 답변 형태로 내용을 정리해주세요.',
}

# scriptStyle
SCRIPT_PROMPT = {
    'verbatim': 'transcript는 음성을 있는 그대로 전사해주세요.',
    'polished': 'transcript는 음성을 전사하되, 불필요한 간투사(어..., 음...)를 제거하고 문장을 다듬어주세요.',
    'condensed': 'transcript는 핵심 발화만 요약하여 간결하게 전사해주세요.',
}

# tone
TONE_PROMPT = {
    'concise': '간결한 문체로 작성해주세요.',
    'formal': '보고서에 적합한 격식체로 작성해주세요.',
    'easy': '누구나 이해할 수 있는 쉬운 설명체로 작성해주세요.',
}
```

## 구현 플랜

### Step 1. 프리셋 데이터 구조 교체

- 파일: `UploadContent.tsx`
- 작업:
  - `PromptTagGroup`, `PROMPT_TAG_GROUPS`, `VALID_PROMPT_TAGS` 제거
  - `AnalysisPreset` 인터페이스 및 차원 타입 추가
  - `DEFAULT_PRESETS` 상수 (빠른 요약, 회의록 정리, 강의 노트, 자막용)
  - localStorage 키 유지 (`genova_prompt_tag_presets_v1` → `genova_analysis_presets_v1`로 변경)
  - 상태 변수 교체: `selectedTags` → `presetConfig` (각 차원 값)

### Step 2. 프리셋 선택 UI 변경

- 파일: `UploadContent.tsx`
- 작업:
  - 기존 태그 토글 UI → 차원별 라디오/셀렉트 UI로 교체
  - 프리셋 드롭다운: 기본 4개 + 사용자 저장 프리셋
  - 프리셋 선택 시 4개 차원 값이 자동 세팅
  - 차원 값 개별 수정 가능 (커스텀 모드)
  - 프리셋 저장/삭제 로직 유지 (구조만 변경)

### Step 3. settings 페이지 연동

- 파일: `settings/page.tsx`
- 작업:
  - 기존 프롬프트 텍스트 입력 → 차원별 선택 UI로 교체
  - 프리셋 선택 드롭다운 추가
  - 저장 시 `AnalysisPreset` 구조로 저장

### Step 4. 재분석 요청에 프리셋 포함

- 파일: `MockDetailContent.tsx`
- 작업:
  - 재분석 console.log에 프리셋 정보 추가
  - 출력 예시:
```js
console.log('[재분석 요청]', {
  video_id: 'xxx',
  segments: [
    { segment_no: 1, start_time: '00:00:00', end_time: '00:02:30' },
  ],
  preset: {
    name: '회의록 정리',
    summaryDensity: 'detailed',
    analysisFocus: 'action_items',
    scriptStyle: 'polished',
    tone: 'formal',
  }
});
```

### Step 5. API 전달 구조 준비

- 분석 시작 시 `AnalysisPreset` 값을 API 요청 body에 포함할 수 있도록 구조 준비
- 백엔드 API 준비 전까지는 localStorage 저장 + console.log 출력

## 작업 순서 및 담당

| 순서 | 작업 | 담당 역할 | 의존성 |
|------|------|-----------|--------|
| 1 | 프리셋 데이터 구조 교체 | 기능개발 | 없음 |
| 2 | 프리셋 선택 UI 변경 | 화면개발 | Step 1 |
| 3 | settings 페이지 연동 | 화면개발 | Step 1 |
| 4 | 재분석 요청에 프리셋 포함 | 기능개발 | Step 1 |
| 5 | API 전달 구조 준비 | 기능개발 | Step 4 |
| 6 (백엔드) | 프롬프트 매핑 구현 | 백엔드 담당 | Step 5 완료 후 |

## 최근 업데이트

- 2026-03-25: 공통 Tooltip 컴포넌트 분리 (`components/Tooltip/index.tsx`), 프리셋 차원별 예시 툴팁 추가
- 2026-03-25: Step 1~3 구현 완료 (데이터 구조, UI, settings 연동)
- 2026-03-25: 프리셋 구조 재설계 기획 완료

## 다음 액션

- Step 4: 재분석 요청에 프리셋 포함 (MockDetailContent.tsx)
- Step 5: API 전달 구조 준비
- Step 6: 백엔드 프롬프트 매핑 구현 (백엔드 담당)
