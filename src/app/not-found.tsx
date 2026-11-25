import Link from 'next/link';
import {headers} from 'next/headers';

export default async function NotFound() {
  const english=(await headers()).get('x-mavs-language') === 'en';
  return <main style={{minHeight:'85vh',background:'#f5f6f8',color:'#153252',padding:'100px 24px',textAlign:'center'}}><p style={{fontFamily:'monospace'}}>MAVS.KR / 404</p><h1>{english ? 'Record not found' : '기록을 찾을 수 없습니다'}</h1><p>{english ? 'This address does not match a record in the loaded archive.' : '현재 적재된 기록에 해당 주소가 없습니다.'}</p><Link href={english ? '/en' : '/'}>{english ? 'Back to stats search' : '기록 검색으로 돌아가기'}</Link></main>;
}
