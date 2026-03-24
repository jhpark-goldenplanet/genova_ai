# 분석 모드 이중화 (Standard / Premium) 기획

## 목적

- 영상 분석 시 토큰 비용을 절감할 수 있는 STT 기반 경로(Standard)와 영상 전체 분석 경로(Premium)를 사용자에게 선택지로 제공한다.
- 사용자가 영상 길이에 따른 예상 토큰 사용량을 사전에 확인하고 모드를 선택할 수 있도록 한다.
- 분석 시작 전에 조직의 토큰 잔량과 내 사용량을 확인하여, 모드 선택의 근거를 제공한다.

## 분석 모드 정의

### Standard 모드 (STT 기반)
- 영상 음성을 STT로 텍스트 추출 → 텍스트를 Gemini에 전달하여 요약/구간 분할
- 토큰 사용량: 낮음 (텍스트만 전달)
- 적합 콘텐츠: 음성 중심 (강의, 발표, 인터뷰)
- 제약: 화면 내 텍스트(OCR), 시각 정보는 분석 불가

### Premium 모드 (영상 전체 분석)
- 영상 전체를 Gemini에 직접 전달하여 시청·분석
- 토큰 사용량: 높음 (영상 프레임 + 오디오 전체)
- 적합 콘텐츠: 시각 정보가 중요한 영상 (실습, 자료 화면, PPT 강의)
- 장점: OCR, 장면 전환, 시각 컨텍스트까지 분석

## 사용자 흐름 변경

### 현재 (AS-IS)
```
UPLOAD → CONFIGURE(작업명, AI자동/커스텀, 분할개수, 프리셋) → READY → DONE
```

### 변경 후 (TO-BE)
```
UPLOAD → CONFIGURE → READY → DONE
              │
              ├── 1. 분석 모드 선택 (Standard / Premium)  ← 신규
              ├── 2. 예상 토큰 사용량 표시                  ← 신규 (구현 완료)
              ├── 3. 조직 토큰 현황 (잔량/한도/내 사용량)   ← 신규
              ├── 4. 작업명
              ├── 5. AI 자동 / 커스텀
              ├── 6. 분할 개수
              └── 7. 프리셋 설정 (커스텀 시)
```

## CONFIGURE 화면 설계

### 좌측 컬럼 변경

#### 영상 정보 (기존 유지)
- 파일명, 영상 길이, 포맷, 파일 크기

#### 분석 모드 선택 (신규, 영상 정보 바로 아래)

```
┌─────────────────────────────────────────────────┐
│  분석 모드                                       │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   ⚡ Standard    │  │   🎬 Premium         │  │
│  │                  │  │                      │  │
│  │  음성 기반 분석   │  │  영상 전체 분석       │  │
│  │  STT → AI 요약   │  │  OCR + 시각 분석     │  │
│  │                  │  │                      │  │
│  │  토큰 절약       │  │  고품질 결과          │  │
│  └──────────────────┘  └──────────────────────┘  │
│                                                  │
│  💡 Standard: 음성 중심 강의에 적합              │
│     Premium: 화면 자료가 포함된 영상에 적합       │
└─────────────────────────────────────────────────┘
```

- 카드형 2열 선택 (라디오 버튼 아닌 카드 클릭)
- 기본 선택: Standard (토큰 절약 유도)
- 선택 시 카드 하이라이트 + 하단 도움말 텍스트 변경

#### 예상 토큰 사용량 (신규, 모드 선택 바로 아래)

```
┌─────────────────────────────────────────────────┐
│  예상 토큰 사용량                                │
│                                                  │
│  영상 길이: 12분 34초                            │
│                                                  │
│  Standard (STT)    ████░░░░░░  ~2,500 토큰      │
│  Premium (영상)    █████████░  ~25,000 토큰     │
│                                          ← 현재 │
│                                                  │
│  ℹ️ 예상치이며 실제 사용량은 영상 내용에 따라     │
│     달라질 수 있습니다.                           │
└─────────────────────────────────────────────────┘
```

- 영상 길이 기반 추정 (프론트에서 계산)
- 두 모드 모두 바 그래프로 비교 표시
- 현재 선택된 모드에 화살표 또는 하이라이트
- 하단 안내 문구: 예상치 면책

#### 토큰 추정 계산식 (프론트 로컬 계산)

```
Standard 예상 토큰:
  = 영상길이(분) × 200 (STT 텍스트 평균 토큰/분)
  + 고정 프롬프트 오버헤드 (~500)

Premium 예상 토큰:
  = 영상길이(초) × 258 (Gemini 영상 토큰 ~258/초)
  + 고정 프롬프트 오버헤드 (~500)
```

※ 이 계산식은 초기 추정용이며, 백엔드에서 정확한 토큰 카운트 API가 준비되면 교체

#### 조직 토큰 현황 (신규, 예상 토큰 사용량 아래)

사용자가 "이 분석을 돌리면 토큰이 충분한가?"를 판단할 수 있도록, 분석 시작 전에 조직 토큰 현황을 표시한다.

```
┌─────────────────────────────────────────────────┐
│  조직 토큰 현황                                  │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  잔여 토큰                                   │ │
│  │  4,280,000 / 6,000,000                      │ │
│  │  ████████████████████░░░░░░  71.3%          │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  내 사용량      1,200,000 토큰 (이번 달)         │
│  갱신일         2026-04-01                       │
│  현재 플랜      Plus                             │
│                                                  │
│  ⚠️ 이 분석 예상 소모: ~2,500 토큰 (Standard)    │
│     분석 후 잔여: ~4,277,500 토큰                │
└─────────────────────────────────────────────────┘
```

**표시 항목:**
- 조직 잔여 토큰 / 월 한도 (프로그레스 바)
- 내 이번 달 사용량
- 토큰 갱신일
- 현재 플랜명
- 이 분석 예상 소모량 (선택한 모드 기준) + 분석 후 예상 잔여

**동작:**
- 분석 모드(Standard/Premium) 전환 시 "이 분석 예상 소모" 값이 실시간 변경
- 잔여 토큰이 예상 소모량보다 적으면 경고 표시 (빨간색 바 + 경고 문구)
- 현재는 mock 데이터 (구독 관리 페이지의 `SUBSCRIPTION_INFO`와 동일한 값 사용)
- 백엔드 API 준비 후 실시간 조회로 교체

**데이터 소스 (시연 단계):**

토큰 데이터를 localStorage에 통합 관리하여 3개 페이지에서 일관되게 표시한다.

```typescript
// localStorage key: genova_token_state_v1
interface TokenState {
  org: {
    monthlyLimit: number;       // 월 한도 (예: 6,000,000)
    resetDate: string;          // 갱신일 (예: '2026-04-01')
    plan: string;               // 플랜명 (예: 'Plus')
  };
  usage: {
    orgTotal: number;           // 조직 전체 사용량 (누적)
    byMember: {                 // 멤버별 사용량
      [userId: string]: number;
    };
  };
  history: {                    // 분석별 토큰 소모 기록
    analysisId: string;
    track: AnalysisTrack;
    estimatedTokens: number;
    createdAt: string;
  }[];
}
```

**3페이지 일관성 규칙:**
- 구독 관리 페이지: `org.monthlyLimit`, `org.monthlyLimit - usage.orgTotal` (잔여), `org.resetDate`, `org.plan` 표시
- 회원 관리 페이지: `usage.byMember` 멤버별 사용량, `usage.orgTotal / org.monthlyLimit` 조직 현황
- 분석 모드 설정 (CONFIGURE): 잔여 토큰, 내 사용량, 이 분석 예상 소모, 분석 후 잔여 표시

**토큰 차감 흐름:**
1. 분석 시작 시 `estimatedTokens`를 `usage.orgTotal`과 `usage.byMember[currentUser]`에 즉시 차감
2. `history`에 소모 기록 추가
3. 3개 페이지 모두 동일한 localStorage 값을 읽으므로 자동 동기화
4. 백엔드 연동 후에는 API 응답으로 교체 (localStorage → API)

#### 작업명, 분석방식, 분할개수, 프리셋 (기존 유지)
- 현재 구조 그대로 유지
- `analysisMode`(AUTO/CUSTOM)는 분석 모드(Standard/Premium)와 별개 개념으로 유지

### 우측 컬럼 (기존 유지)
- 프리셋 설정 영역 그대로

## 데이터 구조 변경

### 신규 타입

```typescript
type AnalysisTrack = 'STANDARD' | 'PREMIUM';
```

### 상태 추가

```typescript
const [analysisTrack, setAnalysisTrack] = useState<AnalysisTrack>('STANDARD');
```

### WorkspaceAnalysisItem 확장

```typescript
interface WorkspaceAnalysisItem {
  // ... 기존 필드
  track?: AnalysisTrack;  // 'STANDARD' | 'PREMIUM'
}
```

### API 요청 확장 (백엔드 연동 시)

```typescript
// 분석 시작 요청에 track 파라미터 추가
analyzeVideo(videoId, { language, track: 'STANDARD' | 'PREMIUM' })
```

## 구현 범위

### 프론트엔드 (이번 작업)

| 순서 | 작업 | 파일 | 설명 | 상태 |
|------|------|------|------|------|
| 1 | AnalysisTrack 타입 추가 | `UploadContent.tsx` | 타입, 상태, draft 저장에 반영 | 완료 |
| 2 | 분석 모드 선택 카드 UI | `UploadContent.tsx` | CONFIGURE 좌측 컬럼, 영상 정보 아래 | 완료 |
| 3 | 토큰 추정 계산 유틸 | `shared/utils/tokenEstimate.ts` | 영상 길이 → 토큰 추정 함수 | 완료 |
| 4 | 예상 토큰 사용량 표시 UI | `UploadContent.tsx` | 바 그래프 + 수치 + 비교 | 완료 |
| 5 | 모드 선택 도움말 | `UploadContent.tsx` | 모드별 안내 텍스트 | 완료 |
| 6 | draft/storage 반영 | `UploadContent.tsx` | localStorage draft에 track 포함 | 완료 |
| 7 | executeAnalysisStart 수정 | `UploadContent.tsx` | analysisItem에 track 포함 | 완료 |
| 8 | 토큰 상태 localStorage 통합 | `shared/utils/tokenState.ts` | `TokenState` 인터페이스, read/write/차감 유틸 | 미구현 |
| 9 | 조직 토큰 현황 컴포넌트 | `UploadContent.tsx` | 잔여/한도 프로그레스 바, 내 사용량, 갱신일 | 미구현 |
| 10 | 분석 시 토큰 차감 | `UploadContent.tsx` | 분석 시작 → localStorage 차감 + history 기록 | 미구현 |
| 11 | 분석 예상 소모 연동 | `UploadContent.tsx` | 모드 전환 시 예상 소모량 + 분석 후 잔여 실시간 계산 | 미구현 |
| 12 | 토큰 부족 경고 | `UploadContent.tsx` | 잔여 < 예상 소모 시 경고 UI | 미구현 |
| 13 | 구독 관리 페이지 연동 | `subscription/page.tsx` | 하드코딩 mock → localStorage `TokenState` 읽기 | 미구현 |
| 14 | 회원 관리 페이지 연동 | `MemberManagementPage.tsx` | 하드코딩 mock → localStorage `TokenState` 읽기 | 미구현 |

### 백엔드 (백엔드 개발자)

- 분석 요청 API에 `track` 파라미터 수신
- `track` 값에 따라 파이프라인 분기 (STT 경로 / 영상 전체 경로)
- STT 서비스 통합
- 토큰 사용량 실측 API (선택, 고도화 단계)

## 제외 범위

- STT 서비스 백엔드 구현
- 실제 토큰 카운트 API 연동 (프론트 추정치로 시작)
- 토큰 충전/결제 기능 (구독/과금 체계 이후)
- 분석 결과 화면에서 모드별 차이 표시 (이후 단계)
- 토큰 사용 이력 상세 (분석별 소모량 기록 — 백엔드 연동 후)

## 의존성

- 백엔드 API에 `track` 파라미터 추가 전까지는 프론트에서 값만 저장하고 API 호출 시에는 기존 방식 유지
- 백엔드 준비 완료 후 API 호출부만 수정하면 연동 가능하도록 설계

## 완료 기준

### Phase 1 (완료)
- [x] CONFIGURE 화면에서 Standard/Premium 모드 카드 선택 가능
- [x] 영상 길이 기반 예상 토큰 사용량이 두 모드 비교로 표시됨
- [x] 선택한 모드가 draft와 workspace 데이터에 저장됨
- [x] 분석 시작 시 선택한 track 값이 포함된 상태로 진행됨
- [x] 기존 AUTO/CUSTOM 분석 방식 선택은 그대로 동작

### Phase 2 (이번 작업 — 목요일 시연 대상)
- [ ] localStorage 기반 `TokenState` 통합 관리 유틸 작성
- [ ] 분석 시작 시 예상 토큰을 localStorage에 차감 + history 기록
- [ ] CONFIGURE: 조직 토큰 잔여/한도 프로그레스 바 표시
- [ ] CONFIGURE: 내 이번 달 사용량 표시
- [ ] CONFIGURE: 모드 전환 시 "예상 소모 → 분석 후 잔여" 실시간 계산
- [ ] CONFIGURE: 잔여 토큰 부족 시 경고 UI
- [ ] 구독 관리 페이지: 하드코딩 → localStorage 토큰 상태 읽기
- [ ] 회원 관리 페이지: 하드코딩 → localStorage 토큰 상태 읽기
- [ ] 3페이지 토큰 수치 일관성 확인
