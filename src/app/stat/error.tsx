"use client";

import { usePathname } from 'next/navigation';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const english = /^\/stat\/en(?:\/|$)/.test(usePathname());
  return (
    <main style={{ minHeight: '80vh', background: '#f5f6f8', color: '#153252', padding: '80px 24px', textAlign: 'center' }}>
      <h1>{english ? 'Unable to load the archive' : '기록을 불러오지 못했습니다'}</h1>
      <p>{english ? 'Please try again. Your filters are preserved in the address.' : '다시 시도해 주세요. 주소에 저장된 검색 조건은 유지됩니다.'}</p>
      <button onClick={reset} style={{ padding: '12px 24px', background: '#174eb6', color: 'white', border: 0, borderRadius: 6, cursor: 'pointer' }}>{english ? 'Try again' : '다시 시도'}</button>
    </main>
  );
}
