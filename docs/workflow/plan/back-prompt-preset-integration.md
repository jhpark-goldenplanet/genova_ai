# 백엔드 프롬프트 프리셋 연동 기획

## 목적

- 프론트에서 유저가 설정한 프리셋(요약 밀도/분석 관점/스크립트 정리/출력 톤)과 분할 개수를 Gemini 프롬프트에 실제 반영한다.
- Vertex AI 서비스로 통합하고, GenAI의 장점(duration 강제)을 병합한다.
- 재분석 시 유저 분할점 기반 프롬프트 모드를 추가한다.

## 결정 사항

- **Vertex AI만 사용** — GCS URI 직접 참조로 영상 다운로드/업로드 불필요
- GenAI 서비스는 추후 제거 또는 fallback으로만 유지
- STT 기반 Standard 모드 (2track)는 이후 단계에서 적용

## 현재 상태

### Vertex AI (`vertex_ai_service.py`)
- 프롬프트: `_create_analysis_prompt()` 메서드로 분리 (`:129`)
- 영상 접근: `Part.from_uri(gcs_uri)` — GCS 직접 참조
- JSON 응답 강제: `response_mime_type="application/json"`
- 언어별 지시: ko/en/ja/zh 분기
- **부족한 점**: 영상 duration을 프롬프트에 전달하지 않음 → 마지막 세그먼트가 영상 끝에 안 닿을 수 있음

### GenAI (`genai_service.py`)
- 프롬프트: `analyze_video()` 내 인라인
- 영상 접근: 다운로드 → Files API 업로드 → 분석 (비효율)
- **장점**: `duration_str`로 마지막 세그먼트 시간을 강제

## 구현 범위

### 1. `_create_analysis_prompt()` 파라미터 확장

현재:
```python
def _create_analysis_prompt(self, source_language: str = "ko") -> str:
```

변경:
```python
def _create_analysis_prompt(
    self,
    source_language: str = "ko",
    duration_seconds: int = None,
    split_count: int = None,
    preset: dict = None,
    user_segments: list = None,
) -> str:
```

| 파라미터 | 용도 | 기본값 |
|----------|------|--------|
| `duration_seconds` | 영상 길이 → 마지막 세그먼트 시간 강제 | None (GenAI에서 가져올 로직) |
| `split_count` | 유저 지정 분할 개수 | None (AI 자동) |
| `preset` | 프리셋 4차원 값 | None (기본 프롬프트) |
| `user_segments` | 재분석 시 유저 분할점 | None (AI 자동 분할) |

### 2. 프리셋 → 프롬프트 매핑

프론트에서 전달하는 프리셋 구조:
```json
{
  "summaryDensity": "brief | standard | detailed",
  "analysisFocus": "key_points | action_items | learning | qa",
  "scriptStyle": "verbatim | polished | condensed",
  "tone": "concise | formal | easy"
}
```

#### summaryDensity (요약 밀도)
```python
DENSITY_PROMPT = {
    "brief": "각 구간의 summary를 1-2문장으로 간략히 작성해주세요.",
    "standard": "각 구간의 summary를 3-5문장으로 작성해주세요.",
    "detailed": "각 구간의 summary를 문단 단위로 상세히 작성해주세요. 맥락과 근거를 포함합니다.",
}
```

#### analysisFocus (분석 관점)
```python
FOCUS_PROMPT = {
    "key_points": "핵심 내용과 주요 결론을 중심으로 요약해주세요.",
    "action_items": "실행해야 할 항목, 결정 사항, 담당자를 중심으로 요약해주세요.",
    "learning": "학습 목표, 핵심 개념, 이해해야 할 포인트를 중심으로 요약해주세요.",
    "qa": "주요 질문과 답변 형태로 요약해주세요.",
}
```

#### scriptStyle (스크립트 정리)
```python
SCRIPT_PROMPT = {
    "verbatim": "transcript는 음성을 있는 그대로 전사해주세요. 간투사(어..., 음...)도 포함합니다.",
    "polished": "transcript는 음성을 전사하되, 불필요한 간투사를 제거하고 문장을 자연스럽게 다듬어주세요.",
    "condensed": "transcript는 핵심 발화만 요약하여 간결하게 전사해주세요. 자막용으로 적합하게 작성합니다.",
}
```

#### tone (출력 톤)
```python
TONE_PROMPT = {
    "concise": "간결한 문체로 작성해주세요.",
    "formal": "보고서에 적합한 격식체로 작성해주세요.",
    "easy": "누구나 이해할 수 있는 쉬운 설명체로 작성해주세요.",
}
```

### 3. 분할 개수 반영

현재:
```
Divide the video into 2-10 meaningful sections (choose optimal number based on content)
```

변경 (split_count가 있을 때):
```
Divide the video into exactly {split_count} sections.
```

변경 (split_count가 없을 때 = AI 자동):
```
Divide the video into 2-10 meaningful sections (choose optimal number based on content)
```

### 4. duration 강제 (GenAI에서 가져올 로직)

GenAI의 duration 강제 로직을 Vertex AI 프롬프트에 병합:
```
**CRITICAL - Video Duration: {duration_str}**
- The LAST segment's end_time MUST be exactly {duration_str}
- Segments MUST cover the ENTIRE video from 0:00 to {duration_str}
- Do NOT stop analysis early - analyze the COMPLETE video
```

### 5. 재분석 모드 (유저 분할점)

`user_segments`가 전달되면 AI 자동 분할 대신 유저 구간 기준 분석:

```
Analyze the following user-defined time segments.
Do NOT change the segment boundaries - use exactly the times provided.

Segments:
- Segment 1: 0:00 - 2:30
- Segment 2: 2:30 - 5:15
- Segment 3: 5:15 - 8:00

For each segment provide: title, summary, keywords, transcript.
```

## API 변경

### 기존 분석 요청 확장

분석 시작 API에 프리셋 파라미터 추가:

```json
{
  "source_language": "ko",
  "split_count": 5,
  "preset": {
    "summaryDensity": "standard",
    "analysisFocus": "key_points",
    "scriptStyle": "polished",
    "tone": "concise"
  }
}
```

### 재분석 API (신규)

```
POST /v1/video/{video_id}/reanalyze
```

```json
{
  "segments": [
    { "segment_no": 1, "start_time": "00:00:00", "end_time": "00:02:30" },
    { "segment_no": 2, "start_time": "00:02:30", "end_time": "00:05:15" }
  ],
  "preset": {
    "summaryDensity": "detailed",
    "analysisFocus": "action_items",
    "scriptStyle": "polished",
    "tone": "formal"
  }
}
```

## 프롬프트 조합 예시

유저 설정: 밀도=상세, 관점=실행항목, 스크립트=다듬기, 톤=보고서, 분할=5개

```
Analyze this video and provide a comprehensive analysis in JSON format.

IMPORTANT: 한국어로 분석을 작성해주세요.

**CRITICAL - Video Duration: 12:34**
- The LAST segment's end_time MUST be exactly 12:34
- Segments MUST cover the ENTIRE video from 0:00 to 12:34

Divide the video into exactly 5 sections.

각 구간의 summary를 문단 단위로 상세히 작성해주세요. 맥락과 근거를 포함합니다.
실행해야 할 항목, 결정 사항, 담당자를 중심으로 요약해주세요.
transcript는 음성을 전사하되, 불필요한 간투사를 제거하고 문장을 자연스럽게 다듬어주세요.
보고서에 적합한 격식체로 작성해주세요.

Please provide:
1. A descriptive title (50-100 characters)
2. A comprehensive summary
3. 5-10 key keywords
4. Segments with: segment_no, start_time, end_time, title, summary, keywords, transcript

(이하 JSON 포맷 + 타이밍 규칙 그대로 유지)
```

## 작업 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `_create_analysis_prompt()` 파라미터 확장 + 프리셋 매핑 딕셔너리 추가 | `vertex_ai_service.py` |
| 2 | duration 강제 로직 병합 | `vertex_ai_service.py` |
| 3 | `analyze_video()` 호출부에서 프리셋/분할개수 전달 | `vertex_ai_service.py` |
| 4 | 분석 요청 API에 preset/split_count 파라미터 수신 | `video.py` (API) |
| 5 | 요청 스키마 확장 | `schemas/video.py` |
| 6 | AI orchestrator에서 프리셋 전달 | `ai_orchestrator_service.py` |
| 7 | 재분석 API 엔드포인트 추가 | `video.py` (API) |
| 8 | 재분석 시 유저 분할점 프롬프트 모드 | `vertex_ai_service.py` |

## 제외 범위

- GenAI 서비스 제거 (이후 판단)
- STT 기반 Standard 모드 (이후 단계)
- 프리셋 DB 영속 저장 (현재 프론트 localStorage)
- 토큰 사용량 실측 API
