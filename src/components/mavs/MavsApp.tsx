'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Design tokens ─────────────────────────────────────────
const C = {
  ink:      '#0a0a0b',
  ink2:     '#101115',
  card:     '#15171c',
  line:     'rgba(255,255,255,0.07)',
  line2:    'rgba(255,255,255,0.12)',
  text:     '#f5f6f8',
  mute:     '#8b95a3',
  mute2:    '#5e6773',
  blue:     '#00538c',
  blueGlow: '#2da7ff',
  red:      '#ff3b3b',
  amber:    '#ffb020',
  green:    '#22c55e',
} as const;

const MONO    = '"JetBrains Mono", "Courier New", monospace';
const SANS_KR = '"IBM Plex Sans KR", "IBM Plex Sans", system-ui, sans-serif';

// ── Tone block ────────────────────────────────────────────
const TONES: Record<string, [string, string]> = {
  court:    ['#00538c', '#2da7ff'],
  analysis: ['#0d2137', '#2da7ff'],
  film:     ['#1a0a2e', '#9b5de5'],
  ranking:  ['#1f1000', '#ffb020'],
  hero:     ['#00538c', '#002a4a'],
  mic:      ['#1a1a2e', '#ffb020'],
};

function toneForSource(src: string) {
  const s = src.toLowerCase();
  if (s.includes('espn'))           return 'court';
  if (s.includes('moneyball'))      return 'analysis';
  if (s.includes('smoking') || s.includes('cuban')) return 'ranking';
  if (s.includes('athletic'))       return 'film';
  return 'hero';
}

function ToneBlock({ tone = 'hero', w, h, style }: {
  tone?: string; w?: number | string; h?: number | string;
  style?: React.CSSProperties;
}) {
  const [a, b] = TONES[tone] ?? TONES.hero;
  return (
    <div style={{
      width: w ?? '100%', height: h ?? '100%', flexShrink: 0,
      background: `repeating-linear-gradient(135deg,${a} 0px,${a} 4px,${b} 4px,${b} 8px)`,
      ...style,
    }} />
  );
}

// ── Atoms ─────────────────────────────────────────────────
function MavsMark() {
  return (
    <div style={{
      width: 24, height: 24, border: `1.5px solid ${C.text}`, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontWeight: 700, fontSize: 9, letterSpacing: -0.3, color: C.text,
    }}>MK</div>
  );
}

function LangToggle({ lang, onToggle }: { lang: Lang; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${C.line2}`, background: 'none', padding: 0, cursor: 'pointer',
      }}
    >
      {(['ko', 'en'] as Lang[]).map((l) => (
        <div key={l} style={{
          padding: '3px 7px',
          background: lang === l ? C.blueGlow : 'transparent',
          color: lang === l ? '#fff' : C.mute2,
          fontFamily: MONO, fontSize: 9, fontWeight: 600,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>{l}</div>
      ))}
    </button>
  );
}

type IconName = 'home' | 'feed' | 'play' | 'cal' | 'chevLeft' | 'chevRight';
function Icon({ name, size = 20, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  const p: Record<IconName, React.ReactNode> = {
    home:     <path d="M3 9l7-6 7 6v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1V9z" stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
    feed:     <><rect x="3" y="4" width="14" height="2" fill={color} /><rect x="3" y="9" width="14" height="2" fill={color} /><rect x="3" y="14" width="9" height="2" fill={color} /></>,
    play:     <path d="M5 3l12 7-12 7V3z" fill={color} />,
    cal:      <><rect x="3" y="4" width="14" height="13" rx="1.5" stroke={color} strokeWidth="1.4" fill="none" /><path d="M3 8h14M7 2v4M13 2v4" stroke={color} strokeWidth="1.4" strokeLinecap="round" /></>,
    chevLeft: <path d="M13 4l-6 6 6 6" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    chevRight:<path d="M7 4l6 6-6 6" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  };
  return <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block' }}>{p[name]}</svg>;
}

// ── Types ─────────────────────────────────────────────────
type Lang = 'ko' | 'en';

type NewsItem = {
  id: number;
  title: string;
  titleKr: string | null;
  source: string;
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: string;
  content?: string | null;
  contentKr?: string | null;
};

type VideoItem = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  publishedAt: string;
};

type GameItem = {
  game_id: string;
  game_date_kst: string;
  game_time_kst: string;
  opponent: string;
  is_home: boolean;
  mavs_score: number;
  opponent_score: number | null;
  result: string | null;
  status: 'finished' | 'upcoming' | 'today' | 'live';
  matchup?: string;
};

type RouteState =
  | { kind: 'tab'; tab: 'home' | 'feed' | 'podcast' | 'games' }
  | { kind: 'article'; item: NewsItem }
  | { kind: 'player'; item: VideoItem };

// ── UI strings ────────────────────────────────────────────
const UI = {
  ko: { home: '홈', feed: '피드', podcast: '팟캐스트', games: '경기', all: '전체', news: '뉴스', seeAll: '전체 보기', live: 'LIVE', kst: 'KST', back: '뒤로', watchYT: '유튜브에서 보기 ↗', upcoming: '예정된 경기', results: '경기 결과', loading: '로딩 중...', noData: '데이터 없음', home_label: '홈', away_label: '원정' },
  en: { home: 'HOME', feed: 'FEED', podcast: 'PODCAST', games: 'GAMES', all: 'ALL', news: 'NEWS', seeAll: 'SEE ALL', live: 'LIVE', kst: 'KST', back: 'BACK', watchYT: 'Watch on YouTube ↗', upcoming: 'UPCOMING', results: 'RESULTS', loading: 'Loading...', noData: 'No data', home_label: 'HOME', away_label: 'AWAY' },
};

function rel(iso: string, lang: Lang) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(mins / 60);
  const d = Math.floor(h / 24);
  if (lang === 'ko') {
    if (mins < 60) return `${mins}분 전`;
    if (h < 24)   return `${h}시간 전`;
    return `${d}일 전`;
  }
  if (mins < 60) return `${mins}m ago`;
  if (h < 24)   return `${h}h ago`;
  return `${d}d ago`;
}

function shortSource(src: string) {
  const s = src.toUpperCase();
  if (s.includes('ESPN'))       return 'ESPN';
  if (s.includes('MONEYBALL'))  return 'MONEYBALL';
  if (s.includes('SMOKING'))    return 'SMOKINGCUBAN';
  if (s.includes('ATHLETIC'))   return 'ATHLETIC';
  if (s.includes('OFFICIAL'))   return 'MAVS';
  return src.split(/[^A-Za-z]/)[0].toUpperCase().slice(0, 12);
}

// ── Clock ─────────────────────────────────────────────────
function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      setTime(`${h}:${m}`);
    };
    fmt();
    const id = setInterval(fmt, 30000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Data hooks ────────────────────────────────────────────
function useNews() {
  const [data, setData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/news?limit=30')
      .then((r) => r.json())
      .then((d) => setData(d.articles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useYouTube() {
  const [data, setData] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/youtube')
      .then((r) => r.json())
      .then((d) => setData(d.videos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useGames() {
  const [upcoming, setUpcoming] = useState<GameItem[]>([]);
  const [results, setResults] = useState<GameItem[]>([]);
  const [liveGame, setLiveGame] = useState<GameItem | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/nba/mavericks-games')
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setUpcoming(d.data.upcoming_games?.slice(0, 6) ?? []);
          setResults(d.data.recent_games?.slice(0, 8) ?? []);
          setLiveGame(d.data.today_game?.status === 'live' ? d.data.today_game : null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { upcoming, results, liveGame, loading };
}

// ── Router ────────────────────────────────────────────────
function useRouter() {
  const [stack, setStack] = useState<RouteState[]>([{ kind: 'tab', tab: 'home' }]);
  const top = stack[stack.length - 1];
  return {
    route: top,
    setTab: useCallback((tab: 'home' | 'feed' | 'podcast' | 'games') => {
      setStack([{ kind: 'tab', tab }]);
    }, []),
    push: useCallback((r: RouteState) => {
      setStack((s) => [...s, r]);
    }, []),
    back: useCallback(() => {
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    }, []),
    activeTab: top.kind === 'tab' ? top.tab : null,
  };
}

// ── W_TopBar ──────────────────────────────────────────────
function WTopBar({ lang, onToggle }: { lang: Lang; onToggle: () => void }) {
  const time = useClock();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px 10px',
      borderBottom: `1px solid ${C.line2}`,
      background: C.ink2,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MavsMark />
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: C.text }}>
          MAVS<span style={{ color: C.blueGlow }}>KR</span>
          <span style={{ color: C.mute2, fontWeight: 400, marginLeft: 6 }}>/ WIRE</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.mute2, letterSpacing: 0.5 }}>{time}</div>
        <LangToggle lang={lang} onToggle={onToggle} />
      </div>
    </div>
  );
}

// ── W_Marquee ─────────────────────────────────────────────
function WMarquee({ items }: { items: string[] }) {
  if (!items.length) return null;
  const tripled = [...items, ...items, ...items];
  return (
    <div style={{ overflow: 'hidden', borderBottom: `1px solid ${C.line}`, padding: '8px 0' }}>
      <div style={{
        display: 'flex', width: 'max-content',
        animation: 'mq 30s linear infinite',
      }}>
        {tripled.map((title, i) => (
          <span key={i} style={{
            fontFamily: MONO, fontSize: 10.5, color: C.amber,
            letterSpacing: 0.5, paddingRight: 36, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: C.green, marginRight: 8 }}>►</span>
            {title}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── W_LiveBlock ───────────────────────────────────────────
function WLiveBlock({ game, lang }: { game: GameItem | null; lang: Lang }) {
  if (!game) return null;
  const u = UI[lang];
  const isHome = game.is_home;
  const homeAbbr = isHome ? 'DAL' : game.opponent.slice(0, 3).toUpperCase();
  const awayAbbr = isHome ? game.opponent.slice(0, 3).toUpperCase() : 'DAL';
  const homeScore = isHome ? game.mavs_score : (game.opponent_score ?? 0);
  const awayScore = isHome ? (game.opponent_score ?? 0) : game.mavs_score;

  return (
    <div style={{
      margin: '10px 14px',
      padding: '12px 14px',
      background: 'rgba(0,83,140,0.08)',
      border: `1px solid rgba(45,167,255,0.15)`,
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: C.red, boxShadow: `0 0 8px ${C.red}`,
          display: 'inline-block',
        }} />
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.red, letterSpacing: 1.5 }}>
          {u.live}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.mute, marginLeft: 4 }}>
          {game.game_time_kst} {u.kst}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.mute, letterSpacing: 1 }}>{awayAbbr}</div>
          <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color: C.text, lineHeight: 1 }}>{awayScore}</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.mute2, alignSelf: 'flex-end', paddingBottom: 4 }}>vs</div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.blueGlow, letterSpacing: 1 }}>{homeAbbr}</div>
          <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color: C.blueGlow, lineHeight: 1 }}>{homeScore}</div>
        </div>
      </div>
    </div>
  );
}

// ── W_Row (news row) ──────────────────────────────────────
function WRow({ item, lang, onClick }: { item: NewsItem; lang: Lang; onClick: () => void }) {
  const tone = toneForSource(item.source);
  const title = (lang === 'ko' && item.titleKr) ? item.titleKr : item.title;
  const timeStr = rel(item.publishedAt, lang);
  const srcLabel = shortSource(item.source);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '52px 56px 1fr',
        gap: 10, padding: '10px 14px',
        borderBottom: `1px solid ${C.line}`,
        alignItems: 'flex-start',
        cursor: 'pointer',
        background: 'transparent',
      }}
    >
      <div style={{ paddingTop: 2 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, letterSpacing: 0.5, fontVariantNumeric: 'tabular-nums' }}>
          {timeStr.split(' ')[0]}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.mute2, letterSpacing: 0.5, marginTop: 2 }}>
          {timeStr.split(' ').slice(1).join(' ') || UI[lang].kst}
        </div>
      </div>

      <div style={{ width: 56, height: 32, flexShrink: 0, borderRadius: 2, overflow: 'hidden' }}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ToneBlock tone={tone} w={56} h={32} />
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '1px 5px 1px 4px', marginBottom: 4,
          fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: C.blueGlow,
          border: `1px solid ${C.blueGlow}`, borderRadius: 2, opacity: 0.85,
        }}>{srcLabel}</div>
        <div style={{
          fontFamily: SANS_KR, fontSize: 13.5, lineHeight: 1.35, fontWeight: 500,
          letterSpacing: -0.1, color: C.text,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{title}</div>
      </div>
    </div>
  );
}

// ── Podcast row ───────────────────────────────────────────
function PodcastRow({ item, lang, onClick }: { item: VideoItem; lang: Lang; onClick: () => void }) {
  const timeStr = rel(item.publishedAt, lang);
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '52px 56px 1fr',
        gap: 10, padding: '10px 14px',
        borderBottom: `1px solid ${C.line}`,
        background: 'rgba(255,176,32,0.04)',
        cursor: 'pointer',
      }}
    >
      <div style={{ paddingTop: 2 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, letterSpacing: 0.5 }}>
          {timeStr.split(' ')[0]}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.mute2, marginTop: 2 }}>
          ▶ {item.duration}
        </div>
      </div>

      <div style={{ width: 56, height: 32, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ToneBlock tone="mic" w={56} h={32} />
        )}
        <div style={{
          position: 'absolute', right: 3, bottom: 3,
          width: 0, height: 0,
          borderLeft: '6px solid rgba(255,255,255,0.95)',
          borderTop: '4px solid transparent',
          borderBottom: '4px solid transparent',
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
        }} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '1px 5px 1px 4px', marginBottom: 4,
          fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: C.amber,
          border: `1px solid ${C.amber}`, borderRadius: 2,
        }}>
          <svg width="11" height="8" viewBox="0 0 28 20" aria-hidden>
            <rect width="28" height="20" rx="4" fill="#ff0033" />
            <polygon points="11,5 11,15 20,10" fill="#fff" />
          </svg>
          <span>YT · PANDAHANK</span>
        </div>
        <div style={{
          fontFamily: SANS_KR, fontSize: 13.5, lineHeight: 1.3, fontWeight: 500,
          letterSpacing: -0.1, color: C.text,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{item.title}</div>
      </div>
    </div>
  );
}

// ── Podcast card (full-width for Podcast tab) ─────────────
function PodcastCard({ item, lang, onClick }: { item: VideoItem; lang: Lang; onClick: () => void }) {
  const timeStr = rel(item.publishedAt, lang);
  return (
    <div
      onClick={onClick}
      style={{
        borderBottom: `1px solid ${C.line}`, padding: '16px 14px', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', width: '100%', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ToneBlock tone="mic" h={180} style={{ aspectRatio: '16/9' }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          border: '1.5px solid rgba(255,255,255,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M5 3l12 7-12 7V3z" fill="#fff" />
          </svg>
        </div>
        <div style={{
          position: 'absolute', right: 8, bottom: 8, padding: '2px 6px', borderRadius: 3,
          background: 'rgba(0,0,0,0.85)', fontFamily: MONO, fontSize: 10, color: '#fff', fontWeight: 600,
        }}>{item.duration}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 6px', borderRadius: 3,
          background: '#cc0000', fontFamily: MONO, fontSize: 9, color: '#fff', fontWeight: 600,
        }}>
          <svg width="9" height="7" viewBox="0 0 14 10"><path d="M0 0l14 5-14 5V0z" fill="#fff" /></svg>
          YT
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.mute, letterSpacing: 1 }}>
          {item.channelTitle.toUpperCase()}
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 9, color: C.mute2 }}>{timeStr}</div>
      </div>

      <div style={{ fontFamily: SANS_KR, fontSize: 14.5, fontWeight: 500, lineHeight: 1.3, color: C.text }}>
        {item.title}
      </div>
    </div>
  );
}

// ── Section head ──────────────────────────────────────────
function SectionHead({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px 6px',
      borderBottom: `1px solid ${C.line}`,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: C.mute, textTransform: 'uppercase' }}>
        {label}
      </div>
      {right}
    </div>
  );
}

// ── Back bar ──────────────────────────────────────────────
function BackBar({ lang, onBack, title }: { lang: Lang; onBack: () => void; title?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px 10px', borderBottom: `1px solid ${C.line2}`, background: C.ink2,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.blueGlow, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
        <Icon name="chevLeft" size={16} color={C.blueGlow} />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1 }}>{UI[lang].back}</span>
      </button>
      {title && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.mute, letterSpacing: 0.5, flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
      )}
    </div>
  );
}

// ── HomeScreen ────────────────────────────────────────────
function HomeScreen({
  lang, onToggleLang, news, videos, liveGame, loading, onNewsClick, onVideoClick, onSeeAll,
}: {
  lang: Lang; onToggleLang: () => void;
  news: NewsItem[]; videos: VideoItem[]; liveGame: GameItem | null;
  loading: boolean;
  onNewsClick: (item: NewsItem) => void;
  onVideoClick: (item: VideoItem) => void;
  onSeeAll: () => void;
}) {
  const u = UI[lang];
  const marqueeItems = news.slice(0, 10).map((n) => (lang === 'ko' && n.titleKr ? n.titleKr : n.title));

  return (
    <div>
      <WTopBar lang={lang} onToggle={onToggleLang} />
      <WMarquee items={marqueeItems} />
      <WLiveBlock game={liveGame} lang={lang} />

      {loading ? (
        <div style={{ padding: '40px 14px', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.mute }}>{u.loading}</div>
      ) : (
        <>
          {news.slice(0, 5).map((item) => (
            <WRow key={item.id} item={item} lang={lang} onClick={() => onNewsClick(item)} />
          ))}
          {videos.slice(0, 2).map((v) => (
            <PodcastRow key={v.id} item={v} lang={lang} onClick={() => onVideoClick(v)} />
          ))}
          <div style={{ padding: '14px 14px 24px', textAlign: 'center' }}>
            <button
              onClick={onSeeAll}
              style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: C.blueGlow,
                background: 'none', border: `1px solid ${C.blueGlow}`, borderRadius: 4,
                padding: '8px 20px', cursor: 'pointer',
              }}
            >{u.seeAll} ↓</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── FeedScreen ────────────────────────────────────────────
function FeedScreen({
  lang, onToggleLang, news, videos, loading, onNewsClick, onVideoClick,
}: {
  lang: Lang; onToggleLang: () => void;
  news: NewsItem[]; videos: VideoItem[];
  loading: boolean;
  onNewsClick: (item: NewsItem) => void;
  onVideoClick: (item: VideoItem) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'news' | 'podcast'>('all');
  const u = UI[lang];

  const chips = [
    { key: 'all',     label: u.all },
    { key: 'news',    label: u.news },
    { key: 'podcast', label: u.podcast },
  ] as const;

  return (
    <div>
      <WTopBar lang={lang} onToggle={onToggleLang} />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px 8px', borderBottom: `1px solid ${C.line}` }}>
        {chips.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, fontWeight: 600,
              padding: '5px 12px', borderRadius: 3, cursor: 'pointer',
              border: `1px solid ${filter === key ? C.blueGlow : C.line2}`,
              background: filter === key ? 'rgba(45,167,255,0.1)' : 'transparent',
              color: filter === key ? C.blueGlow : C.mute,
            }}
          >{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '40px 14px', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.mute }}>{u.loading}</div>
      ) : (
        <div>
          {(filter === 'all' || filter === 'news') && news.map((item) => (
            <WRow key={item.id} item={item} lang={lang} onClick={() => onNewsClick(item)} />
          ))}
          {(filter === 'all' || filter === 'podcast') && videos.map((v) => (
            <PodcastRow key={v.id} item={v} lang={lang} onClick={() => onVideoClick(v)} />
          ))}
          {(filter === 'news' && !news.length) || (filter === 'podcast' && !videos.length) ? (
            <div style={{ padding: 40, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.mute }}>{u.noData}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── PodcastScreen ─────────────────────────────────────────
function PodcastScreen({
  lang, onToggleLang, videos, loading, onVideoClick,
}: {
  lang: Lang; onToggleLang: () => void;
  videos: VideoItem[]; loading: boolean;
  onVideoClick: (item: VideoItem) => void;
}) {
  const u = UI[lang];
  return (
    <div>
      <WTopBar lang={lang} onToggle={onToggleLang} />
      <SectionHead label={`${u.podcast} · PANDAHANK`} right={
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.mute }}>YOUTUBE · {videos.length}</div>
      } />
      {loading ? (
        <div style={{ padding: '40px 14px', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.mute }}>{u.loading}</div>
      ) : videos.length === 0 ? (
        <div style={{ padding: '40px 14px', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.mute2 }}>
          {u.noData}
          <div style={{ marginTop: 8, fontSize: 9, color: C.mute2 }}>YOUTUBE_API_KEY 설정 필요</div>
        </div>
      ) : (
        videos.map((v) => (
          <PodcastCard key={v.id} item={v} lang={lang} onClick={() => onVideoClick(v)} />
        ))
      )}
    </div>
  );
}

// ── GamesScreen ───────────────────────────────────────────
function GamesScreen({
  lang, onToggleLang, upcoming, results, loading,
}: {
  lang: Lang; onToggleLang: () => void;
  upcoming: GameItem[]; results: GameItem[]; loading: boolean;
}) {
  const u = UI[lang];

  function GameRow({ g }: { g: GameItem }) {
    const isHome = g.is_home;
    const win = g.result === 'W';
    const dateStr = g.game_date_kst ? g.game_date_kst.slice(5).replace('-', '/') : '';

    if (g.status === 'upcoming' || g.status === 'today') {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 14px',
          borderBottom: `1px solid ${C.line}`, gap: 12,
        }}>
          <div style={{ width: 48, flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.mute2 }}>{g.game_time_kst}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SANS_KR, fontSize: 13, fontWeight: 500, color: C.text }}>
              {isHome ? `vs ${g.opponent}` : `@ ${g.opponent}`}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.mute2, marginTop: 2, letterSpacing: 0.5 }}>
              {isHome ? u.home_label : u.away_label}
            </div>
          </div>
          {g.status === 'today' && (
            <div style={{
              fontFamily: MONO, fontSize: 9, color: C.red, letterSpacing: 1.5,
              border: `1px solid ${C.red}`, borderRadius: 3, padding: '2px 6px',
            }}>TODAY</div>
          )}
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 14px',
        borderBottom: `1px solid ${C.line}`, gap: 12,
      }}>
        <div style={{ width: 48, flexShrink: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.mute2, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SANS_KR, fontSize: 13, fontWeight: 500, color: C.text }}>
            {isHome ? `vs ${g.opponent}` : `@ ${g.opponent}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 13, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
            {g.mavs_score} – {g.opponent_score ?? '?'}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1,
            color: win ? C.green : C.red,
            border: `1px solid ${win ? C.green : C.red}`, borderRadius: 3,
            padding: '1px 5px',
          }}>{g.result ?? '-'}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <WTopBar lang={lang} onToggle={onToggleLang} />
      {loading ? (
        <div style={{ padding: '40px 14px', textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.mute }}>{u.loading}</div>
      ) : (
        <>
          <SectionHead label={u.upcoming} />
          {upcoming.length === 0 ? (
            <div style={{ padding: '20px 14px', fontFamily: MONO, fontSize: 11, color: C.mute2 }}>{u.noData}</div>
          ) : (
            upcoming.map((g) => <GameRow key={g.game_id} g={g} />)
          )}
          <SectionHead label={u.results} />
          {results.length === 0 ? (
            <div style={{ padding: '20px 14px', fontFamily: MONO, fontSize: 11, color: C.mute2 }}>{u.noData}</div>
          ) : (
            results.map((g) => <GameRow key={g.game_id} g={g} />)
          )}
          <div style={{ height: 24 }} />
        </>
      )}
    </div>
  );
}

// ── ArticleScreen ─────────────────────────────────────────
function ArticleScreen({ item, lang, onBack }: { item: NewsItem; lang: Lang; onBack: () => void }) {
  const title = (lang === 'ko' && item.titleKr) ? item.titleKr : item.title;
  const altTitle = (lang === 'ko') ? item.title : item.titleKr;
  const body = (lang === 'ko' && item.contentKr) ? item.contentKr : item.content;
  const tone = toneForSource(item.source);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div>
        <BackBar lang={lang} onBack={onBack} title={shortSource(item.source)} />

        <div style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden' }}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <ToneBlock tone={tone} h={200} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(10,10,11,0.9) 100%)' }} />
          <div style={{
            position: 'absolute', bottom: 12, left: 14, right: 14,
            fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: C.blueGlow,
          }}>
            {shortSource(item.source)} · {rel(item.publishedAt, lang)}
          </div>
        </div>

        <div style={{ padding: '18px 14px' }}>
          <h1 style={{ fontFamily: SANS_KR, fontSize: 20, fontWeight: 600, lineHeight: 1.3, letterSpacing: -0.3, color: C.text, margin: '0 0 10px' }}>
            {title}
          </h1>
          {altTitle && (
            <p style={{ fontFamily: SANS_KR, fontSize: 13, color: C.mute, lineHeight: 1.5, margin: '0 0 18px', fontStyle: 'italic' }}>
              {altTitle}
            </p>
          )}
          {body && (
            <div style={{ fontFamily: SANS_KR, fontSize: 14, lineHeight: 1.7, color: C.text, opacity: 0.85 }}>
              {body.slice(0, 600)}{body.length > 600 ? '...' : ''}
            </div>
          )}
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: 'block', width: '100%', marginTop: 24,
              fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, color: C.blueGlow,
              background: 'none', border: `1px solid ${C.blueGlow}`,
              borderRadius: 4, padding: '10px 16px', textAlign: 'center', cursor: 'pointer',
            }}
          >
            {lang === 'ko' ? '원문 보기 ↗' : 'Read original ↗'}
          </button>
        </div>
      </div>

      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(10,10,11,0.92)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '10px 12px',
            borderBottom: `1px solid ${C.line}`,
            background: C.ink2,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: C.mute, marginRight: 'auto' }}>
              {shortSource(item.source)}
            </span>
            <button
              onClick={() => setModalOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.text, fontSize: 18, lineHeight: 1, padding: '4px 6px',
              }}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <iframe
            src={item.sourceUrl}
            style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
            title={title}
          />
        </div>
      )}
    </>
  );
}

// ── PodcastPlayerScreen ───────────────────────────────────
function PodcastPlayerScreen({ item, lang, onBack }: { item: VideoItem; lang: Lang; onBack: () => void }) {
  const ytUrl = `https://www.youtube.com/watch?v=${item.id}`;
  const u = UI[lang];

  return (
    <div>
      <BackBar lang={lang} onBack={onBack} title="PANDAHANK · YT" />

      <div style={{ position: 'relative', width: '100%', background: '#000' }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ToneBlock tone="mic" style={{ aspectRatio: '16/9' }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)',
        }} />
        <a
          href={ytUrl} target="_blank" rel="noopener noreferrer"
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(255,255,255,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 20 20"><path d="M5 3l12 7-12 7V3z" fill="#fff" /></svg>
        </a>
        <div style={{
          position: 'absolute', right: 10, bottom: 10,
          padding: '2px 8px', borderRadius: 3,
          background: 'rgba(0,0,0,0.85)', fontFamily: MONO, fontSize: 11, color: '#fff', fontWeight: 600,
        }}>{item.duration}</div>
      </div>

      <div style={{ padding: '16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.mute, letterSpacing: 1 }}>
            {item.channelTitle.toUpperCase()} · {rel(item.publishedAt, lang)}
          </div>
        </div>
        <h1 style={{ fontFamily: SANS_KR, fontSize: 18, fontWeight: 500, lineHeight: 1.35, color: C.text, margin: '0 0 20px' }}>
          {item.title}
        </h1>
        <a
          href={ytUrl} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', background: '#cc0000', borderRadius: 6,
            fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#fff',
            textDecoration: 'none',
          }}
        >
          <svg width="16" height="12" viewBox="0 0 28 20"><rect width="28" height="20" rx="4" fill="#fff" /><polygon points="11,5 11,15 20,10" fill="#cc0000" /></svg>
          {u.watchYT}
        </a>
      </div>
    </div>
  );
}

// ── Bottom nav ────────────────────────────────────────────
const TABS = [
  { key: 'home',    icon: 'home',  labelKo: '홈',     labelEn: 'HOME' },
  { key: 'feed',    icon: 'feed',  labelKo: '피드',   labelEn: 'FEED' },
  { key: 'podcast', icon: 'play',  labelKo: '팟캐',   labelEn: 'POD' },
  { key: 'games',   icon: 'cal',   labelKo: '경기',   labelEn: 'GAMES' },
] as const;

function BotNav({ active, lang, onTab }: {
  active: string | null;
  lang: Lang;
  onTab: (tab: 'home' | 'feed' | 'podcast' | 'games') => void;
}) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: C.ink2,
      borderTop: `1px solid ${C.line2}`,
    }}>
      <div style={{
        display: 'flex',
        padding: '6px 0',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom, 6px))',
      }}>
        {TABS.map(({ key, icon, labelKo, labelEn }) => {
          const isActive = active === key;
          const label = lang === 'ko' ? labelKo : labelEn;
          return (
            <button
              key={key}
              onClick={() => onTab(key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, padding: '4px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? C.amber : C.mute2,
              }}
            >
              <Icon name={icon as IconName} size={18} color={isActive ? C.amber : C.mute2} />
              <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: 0.5 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── MavsApp (root) ────────────────────────────────────────
export default function MavsApp() {
  const [lang, setLang] = useState<Lang>('ko');
  const router = useRouter();
  const { data: news, loading: newsLoading } = useNews();
  const { data: videos, loading: videosLoading } = useYouTube();
  const { upcoming, results, liveGame, loading: gamesLoading } = useGames();

  const toggleLang = useCallback(() => setLang((l) => (l === 'ko' ? 'en' : 'ko')), []);

  const onNewsClick = useCallback((item: NewsItem) => router.push({ kind: 'article', item }), [router]);
  const onVideoClick = useCallback((item: VideoItem) => router.push({ kind: 'player', item }), [router]);
  const onSeeAll = useCallback(() => router.setTab('feed'), [router]);

  const isTabScreen = router.route.kind === 'tab';
  const activeTab = router.activeTab;

  let screen: React.ReactNode;
  if (router.route.kind === 'article') {
    screen = <ArticleScreen item={router.route.item} lang={lang} onBack={router.back} />;
  } else if (router.route.kind === 'player') {
    screen = <PodcastPlayerScreen item={router.route.item} lang={lang} onBack={router.back} />;
  } else if (activeTab === 'feed') {
    screen = (
      <FeedScreen lang={lang} onToggleLang={toggleLang} news={news} videos={videos}
        loading={newsLoading && videosLoading} onNewsClick={onNewsClick} onVideoClick={onVideoClick} />
    );
  } else if (activeTab === 'podcast') {
    screen = (
      <PodcastScreen lang={lang} onToggleLang={toggleLang} videos={videos}
        loading={videosLoading} onVideoClick={onVideoClick} />
    );
  } else if (activeTab === 'games') {
    screen = (
      <GamesScreen lang={lang} onToggleLang={toggleLang} upcoming={upcoming}
        results={results} loading={gamesLoading} />
    );
  } else {
    screen = (
      <HomeScreen lang={lang} onToggleLang={toggleLang} news={news} videos={videos}
        liveGame={liveGame} loading={newsLoading} onNewsClick={onNewsClick}
        onVideoClick={onVideoClick} onSeeAll={onSeeAll} />
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.ink, color: C.text,
      fontFamily: SANS_KR, overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        bottom: isTabScreen ? 60 : 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as never,
      }}>
        {screen}
      </div>

      {isTabScreen && (
        <BotNav active={activeTab} lang={lang} onTab={router.setTab} />
      )}
    </div>
  );
}
