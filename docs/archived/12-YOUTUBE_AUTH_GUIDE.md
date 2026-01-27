# YouTube 인증 가이드

## 개요

YouTube 영상 다운로드 시 Cloud Run 환경에서는 Google 데이터센터 IP가 봇으로 인식되어 403 Forbidden 에러가 발생합니다. 이를 해결하기 위해 YouTube 쿠키 인증이 필요합니다.

## 문제 상황

```
ERROR: unable to download video data: HTTP Error 403: Forbidden
```

- **원인**: YouTube가 Cloud Run의 데이터센터 IP를 봇으로 인식
- **증상**: 로컬에서는 정상 동작하지만 Cloud Run에서 403 에러 발생

## 해결 방법: 쿠키 인증

### 방법 1: 브라우저 확장 프로그램 사용 (권장)

1. **Chrome 확장 프로그램 설치**
   - "Get cookies.txt LOCALLY" 확장 프로그램 설치
   - https://chrome.google.com/webstore/detail/get-cookiestxt-locally/

2. **YouTube 쿠키 내보내기**
   - YouTube.com에 로그인
   - 확장 프로그램 클릭 → "Export" 클릭
   - `www.youtube.com_cookies.txt` 파일 저장

3. **Cloud Run에 업로드**
   ```bash
   curl -X POST https://genova-ai-backend-987680405347.asia-northeast3.run.app/v1/youtube/upload-cookies \
     -H "X-API-Key: <API_KEY>" \
     -F "file=@www.youtube.com_cookies.txt"
   ```

### 방법 2: 자동화 스크립트 사용

```bash
cd ax-agriedu-back-v3
uv run python scripts/youtube_cookie_setup.py --browser chrome --no-test
```

**주의**: 스크립트 실행 전 Chrome 브라우저를 완전히 종료해야 합니다.

## API 엔드포인트

### 쿠키 업로드
```
POST /v1/youtube/upload-cookies
Content-Type: multipart/form-data
X-API-Key: <API_KEY>

file: cookies.txt (Netscape 형식)
```

### 쿠키 상태 확인
```
GET /v1/youtube/cookies-status
```

응답 예시:
```json
{
  "configured": true,
  "cookie_file": "/tmp/youtube_cookies.txt",
  "file_size": 2955,
  "last_modified": 1768554835.33
}
```

### 쿠키 삭제
```
DELETE /v1/youtube/cookies
X-API-Key: <API_KEY>
```

## 쿠키 만료 및 갱신

### 쿠키 유효 기간
- YouTube 쿠키는 보통 **2주 ~ 1개월** 유효
- 만료되면 403 에러가 다시 발생

### 갱신 방법
1. 브라우저에서 YouTube에 다시 로그인
2. 쿠키 내보내기 후 재업로드

### 자동화 권장
- 쿠키 만료 전 알림 시스템 구축 권장
- 또는 주기적으로 쿠키 갱신 (예: 주 1회)

## Cloud Run 재배포 시 주의사항

Cloud Run은 **stateless**이므로 재배포 시 `/tmp` 디렉토리가 초기화됩니다.

### 해결 방법
1. **재배포 후 쿠키 재업로드** (현재 방식)
2. **Secret Manager 사용** (권장)
   - 쿠키를 Secret Manager에 저장
   - 시작 스크립트에서 자동 로드
3. **GCS 사용**
   - 쿠키 파일을 GCS에 저장
   - 시작 시 다운로드

## 트러블슈팅

### 쿠키 추출 실패
```
ERROR: Could not copy Chrome cookie database
```
- 브라우저가 실행 중일 때 발생
- 작업 관리자에서 Chrome/Edge 프로세스 모두 종료 후 재시도

### 쿠키 업로드 실패
```
Invalid cookie format. Please use Netscape format cookies
```
- Netscape 형식이 아닌 쿠키 파일
- "Get cookies.txt LOCALLY" 확장 프로그램으로 재내보내기

### 403 에러 지속
1. 쿠키 상태 확인: `GET /v1/youtube/cookies-status`
2. 쿠키가 만료되었을 수 있음 → 재업로드
3. YouTube 계정 로그인 상태 확인

## 관련 파일

- `app/api/v1/youtube_cookies.py` - 쿠키 관리 API
- `app/services/youtube_download_service.py` - YouTube 다운로드 서비스
- `scripts/youtube_cookie_setup.py` - 쿠키 설정 스크립트

## 대안 검토 (향후)

### OAuth 2.0
- yt-dlp 2025.10.22 버전부터 **지원 중단**
- 쿠키 방식만 사용 가능

### 프록시 서비스
- 주거용 IP 프록시 사용 시 봇 감지 우회 가능
- Bright Data, Oxylabs 등 유료 서비스 필요

### 별도 다운로드 서버
- Cloud Run 대신 Compute Engine VM 사용
- 고정 IP + 쿠키 영구 저장 가능
