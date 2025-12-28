import Link from 'next/link';
import { Map, Archive } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050510] text-slate-300">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">

          {/* Logo & Copyright */}
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold font-mono text-white tracking-tighter">mavs.kr</span>
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} MAVS.KR
            </p>
          </div>

          {/* Links - Compact (Hidden on mobile) */}
          <div className="hidden md:flex gap-6 text-sm">
            <Link href="/?tab=news" className="text-slate-400 hover:text-blue-400 transition-colors">뉴스</Link>
            <Link href="/?tab=schedule" className="text-slate-400 hover:text-blue-400 transition-colors">경기</Link>
            <Link href="/?tab=community" className="text-slate-400 hover:text-blue-400 transition-colors">커뮤니티</Link>
            <Link href="/?tab=column" className="text-slate-400 hover:text-blue-400 transition-colors">칼럼</Link>
          </div>

          {/* 아카이브 & 사이트맵 - 작은 버튼 */}
          <div className="flex items-center gap-2">
            <Link
              href="/archive/games"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all"
              title="경기 아카이브"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">아카이브</span>
            </Link>
            <Link
              href="/sitemap-page"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all"
              title="사이트맵"
            >
              <Map className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">사이트맵</span>
            </Link>
          </div>

        </div>
      </div>
    </footer>
  );
}
