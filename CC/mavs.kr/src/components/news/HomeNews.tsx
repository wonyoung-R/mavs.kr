'use client';

import { useState, useEffect } from 'react';
import { NewsArticle } from '@/types/news';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';

interface HomeNewsProps {
  initialData?: NewsArticle[];
}

export function HomeNews({ initialData = [] }: HomeNewsProps) {
  const [news, setNews] = useState<NewsArticle[]>(initialData.slice(0, 5)); // 최신 5개만
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData.length === 0) {
      fetchNews();
    }
  }, []);



  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news/all?limit=5&translate=true');

      if (!response.ok) throw new Error('Failed to fetch news');

      const data = await response.json();
      setNews(data.articles?.slice(0, 5) || []);
    } catch (err) {
      console.error('News fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'espn':
        return 'text-red-300 bg-red-500/20 border border-red-500/30';
      case 'reddit':
        return 'text-orange-300 bg-orange-500/20 border border-orange-500/30';
      case 'the smoking cuban':
        return 'text-blue-300 bg-blue-500/20 border border-blue-500/30';
      case '네이버 스포츠':
        return 'text-green-300 bg-green-500/20 border border-green-500/30';
      default:
        return 'text-slate-300 bg-slate-500/20 border border-slate-500/30';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'espn':
        return '📺';
      case 'reddit':
        return '🔗';
      case 'the smoking cuban':
        return '📰';
      case '네이버 스포츠':
        return '🇰🇷';
      default:
        return '📄';
    }
  };

  const formatTimeAgo = (published: string) => {
    try {
      const date = new Date(published);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) return '방금 전';
      if (diffInHours < 24) return `${diffInHours}시간 전`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}일 전`;
    } catch {
      return '시간 정보 없음';
    }
  };

  if (loading && news.length === 0) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/30">
            <div className="flex items-start space-x-4">
              <div className="w-20 h-6 bg-slate-600/50 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-6 w-4/5 bg-slate-600/50 rounded animate-pulse mb-3"></div>
                <div className="h-4 w-1/3 bg-slate-600/50 rounded animate-pulse"></div>
              </div>
              <div className="w-16 h-6 bg-slate-600/50 rounded-full animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 뉴스 목록 */}
      {news.map((article, index) => (
        <div key={article.id || index} className="bg-slate-700/30 rounded-xl p-3 md:p-5 hover:bg-slate-600/40 transition-all duration-300 hover:scale-[1.02] border border-slate-600/30">
          {/* 모바일 버전 - 제목만 표시 */}
          <div className="md:hidden">
            <h3 className="text-white font-semibold text-base leading-relaxed">
              {article.titleKr || article.title}
            </h3>
          </div>

          {/* 데스크톱 버전 - 전체 내용 표시 */}
          <div className="hidden md:block">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1 min-w-0">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getSourceColor(article.source)}`}>
                    {getSourceIcon(article.source)} {article.source}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-lg leading-relaxed mb-2">
                      {article.titleKr || article.title}
                    </h3>
                    {article.titleKr && article.titleKr !== article.title && (
                      <p className="text-sm text-slate-400 italic leading-relaxed">
                        원본: {article.title}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-400 ml-4 bg-slate-800/50 px-3 py-1.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(article.published)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 뉴스게시판으로 이동 버튼 */}
      <div className="pt-6">
        <Link href="/news">
          <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl">
            <span>뉴스게시판에서 더 보기</span>
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
