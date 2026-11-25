import type { Metadata } from 'next';
import MatzipPage from '@/components/matzip/MatzipPage';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.mavs.kr'),
  title: 'MFFL 맛집 지도 | MAVS.KR',
  description: 'MFFL이 추천하는 전국 맛집. 지역별로 찾고, 방문 후기를 읽고, 티맵과 카카오맵으로 출발하세요.',
  alternates: { canonical: '/matzip' },
  openGraph: {
    title: 'MFFL 맛집 지도 | MAVS.KR',
    description: '팬들이 함께 채워가는 전국 맛집 지도.',
    url: '/matzip',
    images: [{ url: '/images/mavs-kr-share.jpg', width: 1179, height: 788, alt: '흰 배경의 파란색 MAVS.KR 로고' }],
  },
  twitter: { card: 'summary_large_image', images: ['/images/mavs-kr-share.jpg'] },
};

export default function Page() {
  return <MatzipPage />;
}
