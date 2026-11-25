'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Submission } from '@/lib/matzip/types';
import { matzipRequest } from '@/components/matzip/client';

export default function MatzipAdminPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fetching, setFetching] = useState(false);
  const load = useCallback(async () => {
    setFetching(true); setError('');
    try { const data = await matzipRequest<{ submissions: Submission[] }>('/api/matzip/admin', {}, true); setItems(data.submissions); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '신청을 불러오지 못했습니다.'); }
    finally { setFetching(false); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);
  async function review(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !notes[id]?.trim()) { setError('반려 사유를 입력해 주세요.'); return; }
    setBusy(id); setError(''); setMessage('');
    try {
      await matzipRequest('/api/matzip/admin', { method: 'PATCH', body: JSON.stringify({ id, action, review_note: notes[id]?.trim() || '' }) }, true);
      setItems(previous => previous.filter(item => item.id !== id));
      setMessage(action === 'approve' ? '승인했습니다. 공개 지도에 등록되었습니다.' : '반려 처리했습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '검토 결과를 저장하지 못했습니다.'); }
    finally { setBusy(null); }
  }
  return <section className="text-slate-100 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">맛집 등록 승인</h1><p className="text-sm text-slate-400 mt-2">상호·주소·추천 내용을 확인하세요. 승인하면 네이버 블로그 최상위 결과와 함께 공개됩니다.</p></div><Link href="/matzip" className="text-blue-300 underline p-3">공개 지도 보기 ↗</Link></div>
    <button onClick={load} disabled={fetching || !!busy} className="border border-slate-600 rounded px-4 py-3 disabled:opacity-50">{fetching ? '불러오는 중…' : '새로고침'}</button>
    {(loading || fetching) && <p role="status">확인하고 있습니다…</p>}
    {error && <p role="alert" className="border border-red-800 bg-red-950/40 p-4 rounded text-red-200">{error}</p>}
    {message && <p role="status" className="text-green-300">{message}</p>}
    {!loading && !fetching && !error && !items.length && <p className="p-10 text-center text-slate-400 border border-slate-700 rounded">승인 대기 중인 맛집이 없습니다.</p>}
    {items.map(item => <article key={item.id} className="border border-slate-700 bg-slate-900 rounded-lg p-5 space-y-4">
      <div><h2 className="text-xl font-semibold">{item.name}</h2><p className="text-sm text-slate-400 mt-2">{item.address}</p><p className="text-xs text-slate-500 mt-2">신청일 {new Date(item.created_at).toLocaleDateString('ko-KR')}</p></div>
      <dl className="text-sm space-y-2"><div><dt className="text-slate-400">대표 메뉴</dt><dd>{item.menu}</dd></div><div><dt className="text-slate-400">추천 내용</dt><dd className="whitespace-pre-wrap break-words">{item.recommendation}</dd></div></dl>
      <a className="inline-block text-blue-300 underline py-2" target="_blank" rel="noopener noreferrer" href={`https://map.kakao.com/link/map/${encodeURIComponent(item.name)},${item.latitude},${item.longitude}`}>위치 확인 ↗</a>
      <label className="block text-sm">검토 메모 / 반려 사유<textarea value={notes[item.id] || ''} onChange={event => setNotes({ ...notes, [item.id]: event.target.value })} rows={2} maxLength={500} className="mt-2 w-full rounded border border-slate-600 bg-slate-950 text-white p-3" /></label>
      <div className="flex flex-wrap gap-3"><button disabled={!!busy} onClick={() => review(item.id, 'approve')} className="bg-blue-600 rounded px-5 py-3 disabled:opacity-50">{busy === item.id ? '처리 중…' : '승인하고 지도에 공개'}</button><button disabled={!!busy} onClick={() => review(item.id, 'reject')} className="border border-slate-500 rounded px-5 py-3 disabled:opacity-50">반려</button></div>
    </article>)}
  </section>;
}
