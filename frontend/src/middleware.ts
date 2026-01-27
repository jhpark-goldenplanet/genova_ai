import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 알려진 악성 스캐너 User-Agent 패턴
const BLOCKED_USER_AGENTS = [
  /zgrab/i,
  /Assetnote/i,
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /dirbuster/i,
  /gobuster/i,
  /nuclei/i,
  /wpscan/i,
  /burpsuite/i,
  /owasp/i,
  /acunetix/i,
  /nessus/i,
  /qualys/i,
];

// 알려진 취약점 스캔 경로 패턴
const BLOCKED_PATHS = [
  /autodiscover/i,
  /\.env/i,
  /wp-admin/i,
  /wp-login/i,
  /wp-content/i,
  /phpmyadmin/i,
  /admin\.php/i,
  /shell\.php/i,
  /\.git/i,
  /\.svn/i,
  /\.htaccess/i,
  /\.htpasswd/i,
  /web\.config/i,
  /\.aws/i,
  /\.ssh/i,
  /etc\/passwd/i,
  /Powershell/i,
];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';
  const method = request.method;
  const fullUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

  // 1. 악성 User-Agent 차단
  for (const pattern of BLOCKED_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      console.warn(`[BLOCKED] Malicious User-Agent: ${userAgent} - ${fullUrl}`);
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // 2. 취약점 스캔 경로 차단
  for (const pattern of BLOCKED_PATHS) {
    if (pattern.test(fullUrl)) {
      console.warn(`[BLOCKED] Suspicious path: ${fullUrl} - UA: ${userAgent}`);
      return new NextResponse('Not Found', { status: 404 });
    }
  }

  // 3. 루트 경로 POST 요청 제한 (정상적인 앱에서는 루트에 POST하지 않음)
  if (pathname === '/' && method === 'POST') {
    const contentLength = request.headers.get('content-length');
    const contentLengthNum = contentLength ? parseInt(contentLength, 10) : 0;

    // 큰 payload의 POST는 차단 (공격 시도 가능성)
    if (contentLengthNum > 10000) {
      console.warn(`[BLOCKED] Large POST to root: ${contentLengthNum} bytes - UA: ${userAgent}`);
      return new NextResponse('Bad Request', { status: 400 });
    }

    // 루트 경로 POST는 405 Method Not Allowed 반환
    console.warn(`[BLOCKED] POST to root path - UA: ${userAgent}`);
    return new NextResponse('Method Not Allowed', { status: 405 });
  }

  // 4. 비정상적으로 큰 요청 차단 (100KB 이상)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 100000) {
    // API 경로가 아닌 곳에 큰 요청이 오면 차단
    if (!pathname.startsWith('/api/')) {
      console.warn(`[BLOCKED] Large request to non-API path: ${pathname} - ${contentLength} bytes`);
      return new NextResponse('Payload Too Large', { status: 413 });
    }
  }

  return NextResponse.next();
}

// matcher 설정: 정적 파일, _next 내부 파일 제외
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
