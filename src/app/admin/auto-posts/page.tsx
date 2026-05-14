'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Flag, TrendingUp, Coins } from 'lucide-react';

interface StatsRange {
  newsPublished: number;
  estimatedCalls: number;
  estimatedCostUsd: number;
  estimatedCostKrw: number;
  fallbackCount: number;
  passedCount: number;
  rejectedCount: number;
}

interface AutoPost {
  id: string;
  title: string;
  titleKr: string | null;
  publishedAt: string;
  source: string;
  riskLevel: string | null;
  perspectiveStatus: string | null;
  perspectiveText: string | null;
  published: boolean;
  retractedAt: string | null;
  retractReason: string | null;
  team: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  NBA_API: 'NBA.com',
  MAVS_MONEYBALL: 'MMB',
  SMOKING_CUBAN: 'TSC',
  ESPN: 'ESPN',
  INJURY_REPORT: 'Injury',
};

export default function AutoPostsAdminPage() {
  const [posts, setPosts] = useState<AutoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [stats, setStats] = useState<{ today: StatsRange; last7: StatsRange; last30: StatsRange } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/auto-posts').then(r => r.json()),
      fetch('/api/admin/stats').then(r => r.json()).catch(() => null),
    ]).then(([p, s]) => {
      setPosts(p.posts ?? []);
      if (s?.ok) setStats({ today: s.today, last7: s.last7, last30: s.last30 });
    }).finally(() => setLoading(false));
  }, []);

  const handleRetract = async (id: string) => {
    const reason = window.prompt('회수 사유를 입력하세요 (필수):');
    if (!reason) return;
    const res = await fetch(`/api/admin/retract/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setPosts(prev => prev.map(p => (p.id === id ? { ...p, published: false, retractedAt: new Date().toISOString(), retractReason: reason } : p)));
    } else {
      alert('회수 실패');
    }
  };

  const filtered = posts.filter(p => {
    if (filterSource !== 'all' && p.source !== filterSource) return false;
    if (filterRisk !== 'all' && p.riskLevel !== filterRisk) return false;
    if (filterStatus !== 'all' && p.perspectiveStatus !== filterStatus) return false;
    if (filterTeam !== 'all' && p.team !== filterTeam) return false;
    return true;
  });

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
        <Flag className="w-6 h-6 text-orange-400" />
        자동 발행 글 회수 대시보드
      </h1>
      <p className="text-slate-400 mb-6">최근 30일 자동 발행 글. 위험 등급/소스/검증 상태로 필터링하고, 필요 시 원클릭 회수.</p>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="오늘" icon={<TrendingUp className="w-4 h-4" />} stats={stats.today} accent="blue" />
          <StatCard label="최근 7일" icon={<TrendingUp className="w-4 h-4" />} stats={stats.last7} accent="indigo" />
          <StatCard label="최근 30일" icon={<Coins className="w-4 h-4" />} stats={stats.last30} accent="purple" monthly />
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <Select label="Team" value={filterTeam} onChange={setFilterTeam} options={['all', 'mavericks', 'wings']} />
        <Select label="Source" value={filterSource} onChange={setFilterSource} options={['all', 'NBA_API', 'MAVS_MONEYBALL', 'SMOKING_CUBAN', 'ESPN', 'INJURY_REPORT']} />
        <Select label="Risk" value={filterRisk} onChange={setFilterRisk} options={['all', 'low', 'medium', 'high']} />
        <Select label="Status" value={filterStatus} onChange={setFilterStatus} options={['all', 'passed', 'fallback', 'rejected']} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> 로딩 중</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-500">조건에 맞는 자동 글이 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(p => (
            <div key={p.id} className={`rounded-lg border p-4 ${p.published ? 'border-slate-700 bg-slate-900/50' : 'border-red-900 bg-red-950/30 opacity-70'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 text-xs text-slate-400 flex-wrap">
                    <span>{new Date(p.publishedAt).toLocaleString('ko-KR')}</span>
                    <span>·</span>
                    <span>{SOURCE_LABELS[p.source] ?? p.source}</span>
                    <span>·</span>
                    <TeamBadge team={p.team} />
                    <RiskBadge level={p.riskLevel} />
                    <StatusBadge status={p.perspectiveStatus} />
                    {!p.published && <span className="ml-2 inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300"><AlertTriangle className="w-3 h-3 mr-1" /> 회수됨</span>}
                  </div>
                  <a href={`/news/${p.id}`} target="_blank" rel="noreferrer" className="font-semibold text-white hover:text-blue-400">
                    {p.titleKr ?? p.title}
                  </a>
                  {p.perspectiveText && (
                    <div className="mt-2 text-sm text-slate-300 border-l-2 border-blue-500/50 pl-3">
                      🟦 {p.perspectiveText}
                    </div>
                  )}
                  {p.retractReason && (
                    <div className="mt-2 text-xs text-red-300">회수 사유: {p.retractReason}</div>
                  )}
                </div>
                {p.published && (
                  <button
                    onClick={() => handleRetract(p.id)}
                    className="shrink-0 rounded-md bg-red-600/80 hover:bg-red-600 px-3 py-1.5 text-sm text-white"
                  >
                    🚩 회수
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="text-sm text-slate-300 flex items-center gap-2">
      {label}:
      <select value={value} onChange={e => onChange(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function StatCard({ label, icon, stats, accent, monthly }: { label: string; icon: React.ReactNode; stats: StatsRange; accent: 'blue' | 'indigo' | 'purple'; monthly?: boolean }) {
  const colors = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    indigo: 'border-indigo-500/30 bg-indigo-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
  };
  const passRate = stats.newsPublished > 0 ? Math.round((stats.passedCount / stats.newsPublished) * 100) : 0;
  return (
    <div className={`rounded-lg border ${colors[accent]} p-4`}>
      <div className="flex items-center gap-2 mb-3 text-sm text-slate-300">{icon}<span className="font-medium">{label}</span></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-2xl font-bold text-white">{stats.newsPublished}</div>
          <div className="text-xs text-slate-400">글 발행</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{stats.estimatedCalls}</div>
          <div className="text-xs text-slate-400">API 호출</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-300">₩{stats.estimatedCostKrw.toLocaleString()}</div>
          <div className="text-xs text-slate-400">추정 비용</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-300">{passRate}%</div>
          <div className="text-xs text-slate-400">PASS 비율</div>
        </div>
      </div>
      {monthly && stats.newsPublished > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
          월 환산 예상: <span className="text-white font-medium">₩{Math.round(stats.estimatedCostKrw * 30 / 30).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

function TeamBadge({ team }: { team: string | null }) {
  if (!team) return null;
  if (team === 'wings') {
    return <span className="inline-flex items-center rounded-full bg-pink-500/20 px-2 py-0.5 text-xs text-pink-300">🏐 Wings</span>;
  }
  if (team === 'mavericks') {
    return <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">🏀 Mavericks</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-300">{team}</span>;
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const color = level === 'high' ? 'bg-red-500/20 text-red-300' : level === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${color}`}>{level}</span>;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const color = status === 'passed' ? 'bg-blue-500/20 text-blue-300' : status === 'fallback' ? 'bg-orange-500/20 text-orange-300' : 'bg-red-500/20 text-red-300';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${color}`}>{status}</span>;
}
