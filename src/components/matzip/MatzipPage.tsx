'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { KakaoSearchPlace, Place, Region } from '@/lib/matzip/types';
import MatzipMap from './MatzipMap';
import { matzipRequest } from './client';
import styles from './matzip.module.css';

function withinRegion(place: Place, regionId: string, regions: Map<string, Region>) {
  let current = place.region_id;
  for (let depth = 0; current && depth < 6; depth++) {
    if (current === regionId) return true;
    current = regions.get(current)?.parent_id;
  }
  return false;
}

export default function MatzipPage() {
  const { user, isAdmin, signInWithGoogle } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const regionMap = useMemo(() => new Map(regions.map(region => [region.id, region])), [regions]);
  const visible = useMemo(() => path.length ? places.filter(place => withinRegion(place, path[path.length - 1], regionMap)) : places, [places, path, regionMap]);
  const choose = useCallback((id: string) => setSelected(id), []);
  const active = visible.find(place => place.id === selected);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await matzipRequest<{ places: Place[]; regions: Region[] }>('/api/matzip');
      setPlaces(data.places); setRegions(data.regions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '맛집을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filters = [];
  for (let depth = 0; depth < 4; depth++) {
    const parent = depth === 0 ? null : path[depth - 1];
    if (depth > 0 && !parent) break;
    const options = regions.filter(region => region.parent_id === parent).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    if (!options.length) break;
    const localAreas = options.every(region => /[읍면동가]$/.test(region.name));
    const label = depth === 0 ? '시·도' : localAreas ? '읍·면·동' : depth === 1 ? '시·군·구' : '구·읍·면·동';
    filters.push(<label className={styles.filter} key={depth}><span>{label}</span><select value={path[depth] || ''} onChange={event => {
      setPath([...path.slice(0, depth), ...(event.target.value ? [event.target.value] : [])]); setSelected(null);
    }}><option value="">전체</option>{options.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>);
  }

  async function copyAddress(address: string) {
    try { await navigator.clipboard.writeText(address); setNotice('주소를 복사했습니다.'); }
    catch { setNotice(`주소: ${address}`); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>MAVS.KR</Link><div>{isAdmin && <Link href="/admin/matzip">등록 승인</Link>}<span>FANS KNOW THE GOOD SPOTS.</span></div></header>
    <section className={styles.intro}><p className={styles.eyebrow}>MAVERICKS FANS FOR LIFE</p><h1>MFFL 맛집 지도<span>함께 응원하고,<br />함께 맛있게.</span></h1><p className={styles.description}>팬들이 직접 추천하고, 함께 채워가는 전국 맛집.</p></section>
    <div className={styles.toolbar}><div className={styles.filters}>{filters.length ? filters : <span className={styles.muted}>전국 · 등록된 맛집이 있는 지역부터 선택할 수 있어요.</span>}{path.length > 0 && <button className={styles.reset} onClick={() => { setPath([]); setSelected(null); }}>초기화</button>}</div><button className={styles.add} onClick={() => dialog.current?.showModal()}><span aria-hidden="true">＋</span> 맛집 등록하기</button></div>
    <section className={styles.content} aria-label="맛집 탐색">
      <MatzipMap places={visible} selected={selected} onSelect={choose} />
      <div className={styles.results}><div className={styles.resultHeading}><h2>{path.length ? regionMap.get(path[path.length - 1])?.name : '전국'} 맛집</h2><span>{visible.length}곳</span></div>
        {loading && <p className={styles.empty} role="status">맛집을 불러오는 중입니다…</p>}
        {error && <div className={styles.empty} role="alert"><p>{error}</p><button onClick={load}>다시 불러오기</button></div>}
        {!loading && !error && !visible.length && <div className={styles.empty}><strong>첫 번째 맛집을 알려주세요.</strong><p>추천한 맛집은 관리자 확인 후 지도에 표시됩니다.</p><button onClick={() => dialog.current?.showModal()}>＋ 맛집 추천하기</button></div>}
        {active && <div className={styles.selectedCard}><span className={styles.eyebrow}>SELECTED SPOT</span><PlaceDetails place={active} copyAddress={copyAddress} /></div>}
        <ul className={styles.list}>{visible.map((place, index) => <li key={place.id}><button className={styles.placeButton} aria-pressed={selected === place.id} onClick={() => choose(place.id)}><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><span><strong>{place.name}</strong><small>{place.menu || place.address}</small></span><span aria-hidden="true">↗</span></button>{selected === place.id && <p className={styles.address}>{place.address}</p>}</li>)}</ul>
      </div>
    </section>
    <p className={styles.notice} role="status">{notice || '맛집 등록은 로그인 후 가능합니다. 등록 신청은 관리자 승인 후 공개됩니다.'}</p>
    <footer className={styles.footer}><Link href="/">← MAVS.KR 홈</Link><span>DALLAS ↔ KOREA · MFFL</span></footer>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="submit-title"><div className={styles.dialogTop}><span className={styles.eyebrow}>SHARE YOUR SPOT</span><button aria-label="등록 창 닫기" onClick={() => dialog.current?.close()}>✕</button></div><h2 id="submit-title">나만의 맛집 추천</h2>{user ? <SubmissionForm onDone={() => { dialog.current?.close(); setNotice('등록 신청을 보냈습니다. 관리자 승인 후 지도에 표시됩니다.'); }} /> : <div><p>로그인하고 MFFL에게 맛집을 알려주세요.</p><button className={styles.primary} onClick={async () => { try { await signInWithGoogle(); } catch { setNotice('로그인을 시작하지 못했습니다. 다시 시도해 주세요.'); } }}>Google로 로그인</button></div>}</dialog>
  </main>;
}

function PlaceDetails({ place, copyAddress }: { place: Place; copyAddress: (address: string) => void }) {
  const [app, setApp] = useState('');
  const [copying, setCopying] = useState(false);
  useEffect(() => { setApp(''); }, [place.id]);
  const tmap = `tmap://route?rGoName=${encodeURIComponent(place.name)}&rGoX=${place.longitude}&rGoY=${place.latitude}`;
  const kakao = `kakaomap://route?ep=${place.latitude},${place.longitude}&by=CAR`;
  const webMap = `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`;
  return <>
    <h3>{place.name}</h3><p className={styles.address}>{place.address}</p>{place.menu && <p className={styles.menu}>{place.menu}</p>}{place.recommendation && <p className={styles.recommendation}>{place.recommendation}</p>}
    {place.blog_url ? <a className={styles.blog} href={place.blog_url} target="_blank" rel="noopener noreferrer">네이버 블로그 보기 <span aria-hidden="true">↗</span><small>{place.blog_title}</small></a> : <p className={styles.muted}>연결할 블로그 후기가 아직 없습니다.</p>}
    <div className={styles.actions}><a href={tmap} onClick={() => setApp('티맵')}>티맵 길찾기 ↗</a><a href={kakao} onClick={() => setApp('카카오맵')}>카카오맵 길찾기 ↗</a><button disabled={copying} onClick={async () => { setCopying(true); await copyAddress(place.address); setCopying(false); }}>주소 복사</button></div>
    {app && <div className={styles.appHelp} role="status">{app}이 열리지 않나요? <a href={webMap} target="_blank" rel="noopener noreferrer">웹 지도 보기</a><br /><a href={app === '티맵' ? 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku' : 'https://play.google.com/store/apps/details?id=net.daum.android.map'} target="_blank" rel="noopener noreferrer">Android 앱 설치</a> · <a href={app === '티맵' ? 'https://apps.apple.com/kr/app/id431589174' : 'https://apps.apple.com/kr/app/id304608425'} target="_blank" rel="noopener noreferrer">iPhone 앱 설치</a></div>}
  </>;
}

function SubmissionForm({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<KakaoSearchPlace[]>([]);
  const [place, setPlace] = useState<KakaoSearchPlace | null>(null);
  const [menu, setMenu] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setPlace(null); setSearched(false);
    const searchedQuery = query.trim();
    try { const data = await matzipRequest<{ places: KakaoSearchPlace[] }>(`/api/matzip/search?q=${encodeURIComponent(searchedQuery)}`, {}, true); setMatches(data.places); setSearchQuery(searchedQuery); setSearched(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '장소 검색에 실패했습니다.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!place) return; setBusy(true); setError('');
    try { await matzipRequest('/api/matzip', { method: 'POST', body: JSON.stringify({ kakao_place_id: place.id, place_name: place.place_name, search_query: searchQuery, menu, recommendation }) }, true); onDone(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '신청에 실패했습니다.'); }
    finally { setBusy(false); }
  }
  return <>
    <p className={styles.muted}>가게를 검색해 정확한 지점을 선택해 주세요.</p>
    <form onSubmit={search} className={styles.search}><label htmlFor="place-search" className={styles.srOnly}>상호와 지역</label><input id="place-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="예: 서울 ○○식당 강남점" minLength={2} maxLength={80} required /><button disabled={busy}>검색</button></form>
    <ul className={styles.matches}>{matches.map(match => <li key={match.id}><button type="button" disabled={busy} aria-pressed={place?.id === match.id} onClick={() => setPlace(match)}><strong>{match.place_name}</strong><small>{match.road_address_name || match.address_name}</small></button></li>)}</ul>
    {searched && !matches.length && <p role="status">검색 결과가 없습니다. 지역과 상호를 다시 확인해 주세요.</p>}
    {place && <form onSubmit={submit} className={styles.submitForm}><p className={styles.chosen}>선택한 장소: <strong>{place.place_name}</strong><small>{place.road_address_name || place.address_name}</small></p><label>대표 메뉴<input value={menu} onChange={event => setMenu(event.target.value)} maxLength={100} placeholder="추천하고 싶은 메뉴" required /></label><label>추천 이유<textarea value={recommendation} onChange={event => setRecommendation(event.target.value)} maxLength={500} rows={3} placeholder="이곳을 추천하는 이유를 알려주세요." required /></label><p className={styles.muted}>관리자가 위치와 내용을 확인하고 승인하면 공개됩니다. 대표 블로그는 네이버 검색 최상위 결과로 연결됩니다.</p><button className={styles.primary} disabled={busy}>{busy ? '처리 중…' : '관리자에게 등록 신청'}</button></form>}
    {busy && <p role="status">처리하고 있습니다…</p>}{error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}
