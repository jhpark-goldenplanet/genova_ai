'use client';

import { useEffect } from 'react';
import Button from '@/components/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 로깅 (프로덕션에서는 외부 서비스로 전송 가능)
    console.error('Global error caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#f5f5f5',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              padding: '40px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}
          >
            <h1 style={{ color: '#333', marginBottom: '16px' }}>
              문제가 발생했습니다
            </h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
            </p>
            <Button type="button" status="primary" onClick={() => reset()} width={120} height={44}>
              다시 시도
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
