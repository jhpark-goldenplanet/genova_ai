# YouTube 다운로드 제한사항

---

## ⚠️ 핵심 요약

**YouTube 동영상 다운로드는 로컬 환경에서만 작동하며, Cloud Run에서는 불가능합니다.**

| 환경 | YouTube 다운로드 | 직접 링크 | GCS 업로드 |
|------|-----------------|----------|-----------|
| **로컬** | ✅ 가능 | ✅ 가능 | ✅ 가능 |
| **Cloud Run** | ❌ 불가 | ✅ 가능 | ✅ 가능 |

---

## 🔍 원인

YouTube는 Cloud Run의 IP를 데이터센터 IP로 인식하여 봇으로 간주, 자동으로 차단합니다.

- Cloud Run → Google 데이터센터 IP 사용
- YouTube → 데이터센터 IP 차단
- 로컬 → 일반 가정용 ISP IP 사용 → 정상 작동

---

## 🔧 시도했으나 실패한 방법

### 1. Cookies 인증 (실패)
- 브라우저 쿠키를 추출하여 Backend에 업로드
- **실패 이유**: 쿠키는 IP 주소와 연동됨. Cloud Run IP와 불일치로 무효화

### 2. OAuth 2.0 토큰 (실패)
- Google OAuth 토큰 생성 및 자동 갱신 구현
- **실패 이유**: OAuth도 IP 검증. Cloud Run IP가 차단됨

**구현 위치**: `backend/app/api/v1/youtube_cookies.py`

---

## 💡 해결 방안

### 방안 1: 로컬 다운로드 서버 운영 (권장 ⭐⭐⭐⭐)

별도의 로컬 서버에서 YouTube 다운로드 전담 처리

**아키텍처**:
```
[Cloud Run Backend]
    ↓ YouTube URL 전달
[로컬 다운로드 서버]
    ↓ YouTube 다운로드 (일반 IP)
    ↓ GCS 업로드
[Cloud Run Backend]
    ↓ 처리 시작
```

**필요 작업**:
1. 로컬에 간단한 Flask/FastAPI 서버 구축
2. Ngrok 또는 공인 IP로 외부 접근 설정
3. Cloud Run에서 로컬 서버로 요청 전달

**장점**: 안정적, YouTube 차단 없음
**단점**: 로컬 서버 24/7 운영 필요

### 방안 2: VPN/Proxy 사용 (복잡 ⭐⭐)

Cloud Run에서 VPN 연결하여 일반 IP로 위장

**단점**: 비용 발생, 설정 복잡, 속도 저하

### 방안 3: YouTube 기능 제거 (회피 ⭐⭐)

Frontend에서 YouTube URL 차단, GCS 직접 업로드만 허용

**장점**: 문제 완전 회피
**단점**: 기능 제거, 사용자 불편

---

## 📌 권장 조치

### 즉시 적용 (단기)
Frontend에서 YouTube URL 차단 및 안내 메시지 표시:

```typescript
if (url.includes('youtube.com') || url.includes('youtu.be')) {
  alert('⚠️ YouTube는 현재 지원하지 않습니다. 파일을 직접 업로드해주세요.');
  return;
}
```

### 중기 해결책 (1-2주)
로컬 다운로드 서버 구축 및 Cloud Run 연동

---

## 📞 관련 정보

- **API 문서**: [API_ENDPOINTS.md](./API_ENDPOINTS.md)
- **구현 코드**: `backend/app/api/v1/youtube_cookies.py`
- **다운로드 서비스**: `backend/app/services/video_download_service.py`

---

**최종 업데이트**: 2025-01-28
