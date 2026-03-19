'use client';

import { useEffect } from 'react';
import Button from '@/components/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 로깅
    console.error('Page error caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          padding: '40px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ color: '#333', marginBottom: '16px' }}>
          페이지 로드 중 오류 발생
        </h2>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          요청을 처리하는 중 문제가 발생했습니다.
        </p>
        <Button type="button" status="primary" onClick={() => reset()} width={120} height={44} style={{ marginRight: '8px' }}>
          다시 시도
        </Button>
        <Button type="button" status="neutral" onClick={() => (window.location.href = '/')} width={120} height={44}>
          홈으로
        </Button>
      </div>
    </div>
  );
}
