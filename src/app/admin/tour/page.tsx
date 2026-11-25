'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { tourAdminNoteLimit, tourLeadStatuses, type TourAdminLead, type TourLeadStatus } from '@/lib/tour-admin-types';

import styles from './tour-admin.module.css';

type LeadList = { leads: TourAdminLead[]; page: number; hasMore: boolean };
type StatusFilter = '' | TourLeadStatus;

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'medium',
  timeStyle: 'short',
});

class TourRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function tourRequest<T>(token: string, query = '', init: RequestInit = {}): Promise<T> {
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`/api/admin/tour${query}`, { ...init, headers, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) {
    const message = data?.message ?? data?.error;
    throw new TourRequestError(response.status, typeof message === 'string' ? message : '요청을 처리하지 못했습니다.');
  }
  return data as T;
}

function StatusOptions() {
  return Object.entries(tourLeadStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}

function Detail({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? styles.detailWide : undefined}><dt>{title}</dt><dd>{children ?? '—'}</dd></div>;
}

type LeadControls = {
  lead: TourAdminLead;
  saving: boolean;
  save: (lead: TourAdminLead, status: TourLeadStatus, adminNote: string) => Promise<void>;
  reload: () => void;
};

function LeadEditor({ lead, saving, save, reload }: LeadControls) {
  const [status, setStatus] = useState(lead.status);
  const [note, setNote] = useState(lead.adminNote);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const dirty = status !== lead.status || note !== lead.adminNote;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving || conflict) return;
    setError('');
    try {
      await save(lead, status, note);
    } catch (cause) {
      setConflict(cause instanceof TourRequestError && cause.status === 409);
      setError(cause instanceof TourRequestError ? cause.message : '상담 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  return (
    <form className={styles.editor} onSubmit={submit} aria-busy={saving}>
      <div className={styles.fields}>
        <label className={styles.field}>
          상담 상태
          <select className={styles.control} value={status} onChange={event => setStatus(event.target.value as TourLeadStatus)} disabled={saving}>
            <StatusOptions />
          </select>
        </label>
        <label className={styles.field}>
          상담 메모
          <textarea className={styles.control} value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={tourAdminNoteLimit} disabled={saving} />
        </label>
      </div>
      {error && <p role="alert" className={styles.editError}>{error}{conflict && ' 최신 내역을 불러오면 입력 중인 내용이 초기화됩니다.'}</p>}
      <div className={styles.buttons}>
        <button type="submit" className={styles.primaryButton} disabled={saving || !dirty || conflict}>상담 내용 저장</button>
        {conflict && <button type="button" className={styles.button} onClick={reload} disabled={saving}>최신 내역 불러오기</button>}
      </div>
    </form>
  );
}

function LeadCard({ lead, saving, save, reload }: LeadControls) {
  return (
    <details className={styles.card} name="tour-lead">
      <summary className={styles.summary}>
        <strong>{lead.name} <span className={styles.partySize}>{lead.partySize}명</span></strong>
        <span className={styles.badge}>{tourLeadStatuses[lead.status]}</span>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
        <time dateTime={lead.createdAt}>{dateFormat.format(new Date(lead.createdAt))} 접수</time>
      </summary>
      <div className={styles.details}>
        <dl className={styles.detailsGrid}>
          <Detail title="연락처">{lead.phone}</Detail>
          <Detail title="이메일">{lead.email}</Detail>
          <Detail title="인스타그램">{lead.instagram}</Detail>
          <Detail title="참가 의향">{lead.intent}</Detail>
          <Detail title="개인정보 동의">{dateFormat.format(new Date(lead.consentedAt))} · {lead.consentVersion}</Detail>
          <Detail title="마케팅 수신 동의">{lead.marketingConsent ? '동의' : '미동의'}</Detail>
          <Detail title="문의 내용" wide>{lead.inquiry}</Detail>
          {lead.attribution && <Detail title="유입 경로" wide>{lead.attribution}</Detail>}
        </dl>
        <LeadEditor key={lead.updatedAt} lead={lead} saving={saving} save={save} reload={reload} />
      </div>
    </details>
  );
}

function LeadManager({ token }: { token: string }) {
  const [filter, setFilter] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<LeadList | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const loading = !result && !loadError;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page) });
    if (filter) query.set('status', filter);

    tourRequest<LeadList>(token, `?${query}`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      if (page > 1 && data.leads.length === 0) {
        setPage(page - 1);
        return;
      }
      setLoadError('');
      setResult(data);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setResult(null);
      setLoadError(cause instanceof TourRequestError ? cause.message : '접수 내역을 불러오지 못했습니다.');
    });

    return () => controller.abort();
  }, [filter, page, refreshKey, token]);

  function prepareLoad() {
    setResult(null);
    setLoadError('');
    setNotice('');
  }

  function reload() {
    prepareLoad();
    setRefreshKey(value => value + 1);
  }

  function goToPage(nextPage: number) {
    prepareLoad();
    setPage(nextPage);
  }

  async function save(lead: TourAdminLead, status: TourLeadStatus, adminNote: string) {
    setSaving(true);
    setNotice('');
    try {
      const response = await tourRequest<{ lead: TourAdminLead }>(token, '', {
        method: 'PATCH',
        body: JSON.stringify({ id: lead.id, status, adminNote, updatedAt: lead.updatedAt }),
      });
      if (filter && response.lead.status !== filter) {
        reload();
      } else {
        setResult(previous => previous && { ...previous, leads: previous.leads.map(item => item.id === lead.id ? response.lead : item) });
      }
      setNotice('상담 내용을 저장했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.manager}>
      <div className={styles.toolbar}>
        <label className={styles.filter}>
          상태 필터
          <select className={styles.control} value={filter} disabled={saving} onChange={event => { prepareLoad(); setFilter(event.target.value as StatusFilter); setPage(1); }}>
            <option value="">전체</option>
            <StatusOptions />
          </select>
        </label>
        <button className={styles.button} type="button" onClick={reload} disabled={loading || saving}>새로고침</button>
      </div>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {loading && <p role="status" className={styles.message}>접수 내역을 불러오는 중입니다.</p>}
      {loadError && <p role="alert" className={styles.error}>{loadError}</p>}
      {result && (
        <>
          {result.leads.length === 0
            ? <p className={styles.empty}>접수 내역이 없습니다.</p>
            : <div className={styles.list}>{result.leads.map(lead => <LeadCard key={lead.id} lead={lead} saving={saving} save={save} reload={reload} />)}</div>}
          {(result.page > 1 || result.hasMore) && (
            <nav aria-label="팬투어 접수 목록 페이지" className={styles.pagination}>
              <button type="button" className={styles.button} onClick={() => goToPage(result.page - 1)} disabled={result.page <= 1 || saving}>이전</button>
              <span>{result.page}페이지</span>
              <button type="button" className={styles.button} onClick={() => goToPage(result.page + 1)} disabled={!result.hasMore || saving}>다음</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default function TourAdminPage() {
  const { user, session, loading, isAdmin } = useAuth();

  return (
    <section className={styles.page} aria-labelledby="tour-admin-title">
      <h2 id="tour-admin-title">팬투어 접수 관리</h2>
      {loading ? <p role="status" className={styles.message}>로그인 상태를 확인하는 중입니다.</p>
        : !user || !session ? <Link href="/login" className={styles.loginLink}>관리자 계정으로 로그인</Link>
          : !isAdmin || user.id !== session.user.id ? <p className={styles.message}>관리자 계정으로 접속해 주세요.</p>
            : <LeadManager key={user.id} token={session.access_token} />}
    </section>
  );
}
