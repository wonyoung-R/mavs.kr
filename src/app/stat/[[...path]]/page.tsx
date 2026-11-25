import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '준비중입니다 | MAVS.KR',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', padding: 'clamp(24px, 5vw, 64px)', background: '#f9f9f6', color: '#0f68fc' }}>
      <Link href="/" style={{ alignSelf: 'flex-start', color: 'inherit', textDecoration: 'none', fontSize: 22, fontWeight: 700 }}>MAVS.KR</Link>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 28 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(32px, 7vw, 72px)', fontWeight: 600, letterSpacing: '-0.04em' }}>준비중입니다</h1>
        <Link href="/" style={{ color: 'inherit', fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>홈으로 돌아가기 ↗</Link>
      </div>
    </main>
  );
}
