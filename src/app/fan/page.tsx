import MavsApp from '@/components/mavs/MavsApp';
import Link from 'next/link';
import type { PageSearch } from '@/lib/records-page';

export const metadata = {title: 'MAVS.KR — 뉴스와 팬 커뮤니티'};
export default async function FanPage({searchParams}: {searchParams:PageSearch}) {
  const {tab} = await searchParams;
  const initialTab = tab === 'news' || tab === 'feed' ? 'feed' : tab === 'schedule' || tab === 'games' ? 'games' : tab === 'podcast' ? 'podcast' : 'home';
  return <><nav aria-label="기록 포털" style={{background:'#102744',color:'white',padding:'8px 24px',fontSize:13}}><Link href="/stat">← 기록 검색 / Records</Link></nav><MavsApp initialTab={initialTab} /></>;
}
