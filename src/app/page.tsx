import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LandingHome from '@/components/landing/LandingHome';
import type { PageSearch } from '@/lib/records-page';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.mavs.kr'),
  title: 'MAVS.KR — A home for Mavericks fans',
  description: '댈러스의 모든 순간, 우리의 시선으로. 매버릭스 팬들의 공간 MAVS.KR에서 영상, 인스타그램, 역대 기록을 만나보세요.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'MAVS.KR — A home for Mavericks fans',
    description: '댈러스의 모든 순간, 우리의 시선으로.',
    images: [{ url: '/images/mavs-kr-share.jpg', width: 1179, height: 788, alt: '흰 배경의 파란색 MAVS.KR 로고' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MAVS.KR — A home for Mavericks fans',
    description: '댈러스의 모든 순간, 우리의 시선으로.',
    images: [{ url: '/images/mavs-kr-share.jpg', alt: '흰 배경의 파란색 MAVS.KR 로고' }],
  },
};

export default async function HomePage({ searchParams }: { searchParams: PageSearch }) {
  const params = await searchParams;
  const tab = typeof params.tab === 'string' ? params.tab : '';
  if (tab === 'community') redirect('/comm');
  if (tab === 'column') redirect('/column');
  if (tab === 'stats') redirect('/stat/records');
  if (tab) redirect(`/fan?tab=${encodeURIComponent(tab)}`);
  // A channel URL can be configured without shipping an assumed third-party channel.
  const configured = process.env.NEXT_PUBLIC_MAVS_YOUTUBE_URL;
  let youtubeUrl: string | undefined;
  try {
    const url = new URL(configured ?? '');
    if (url.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname)) youtubeUrl = url.href;
  } catch { /* Until configured, the YouTube link opens the existing video hub. */ }
  return <LandingHome youtubeUrl={youtubeUrl} />;
}
