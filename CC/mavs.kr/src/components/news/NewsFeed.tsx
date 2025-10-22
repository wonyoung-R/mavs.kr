'use client';

import { useEffect, useState } from 'react';
import { NewsArticle } from '@/types/news';
import { NewsCard } from './NewsCard';
import { Button } from '@/components/ui/Button';

interface NewsFeedProps {
  initialData?: NewsArticle[];
}

export function NewsFeed({ initialData = [] }: NewsFeedProps) {
  const [allNews, setAllNews] = useState<NewsArticle[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // 필터링된 뉴스 계산
  const filteredNews = allNews.filter(article => {
    if (filter === 'all') return true;

    switch (filter) {
      case 'espn':
        return article.source.toLowerCase() === 'espn';
      case 'reddit':
        return article.source.toLowerCase() === 'reddit';
      case 'tsc':
        return article.source.toLowerCase().includes('smoking cuban');
      case 'naver':
        return article.source.toLowerCase().includes('네이버');
      default:
        return true;
    }
  });

  useEffect(() => {
    if (initialData.length === 0) {
      fetchNews();
    }
    // 5분마다 자동 새로고침
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news/all?translate=true');

      if (!response.ok) throw new Error('Failed to fetch news');

      const data = await response.json();
      setAllNews(data.articles || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('News fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchNews();
  };

  if (loading && allNews.length === 0) {
    return <NewsLoadingSkeleton />;
  }

  if (error && allNews.length === 0) {
    return <NewsErrorState onRetry={handleRetry} />;
  }

  return (
    <div className="space-y-6">
      {/* 필터 버튼 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">최신 뉴스</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => setFilter('all')}
            size="sm"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30'
            }`}
          >
            전체
          </Button>
          <Button
            onClick={() => setFilter('espn')}
            size="sm"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === 'espn'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-slate-700/50 text-red-300 hover:bg-slate-600/50 border border-red-500/30'
            }`}
          >
            ESPN
          </Button>
          <Button
            onClick={() => setFilter('reddit')}
            size="sm"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === 'reddit'
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-slate-700/50 text-orange-300 hover:bg-slate-600/50 border border-orange-500/30'
            }`}
          >
            Reddit
          </Button>
          <Button
            onClick={() => setFilter('tsc')}
            size="sm"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === 'tsc'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-700/50 text-blue-300 hover:bg-slate-600/50 border border-blue-500/30'
            }`}
          >
            TSC
          </Button>
          <Button
            onClick={() => setFilter('naver')}
            size="sm"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === 'naver'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-slate-700/50 text-green-300 hover:bg-slate-600/50 border border-green-500/30'
            }`}
          >
            네이버
          </Button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && allNews.length > 0 && (
        <div className="text-center py-6">
          <div className="inline-flex items-center space-x-2 text-slate-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-sm">뉴스 업데이트 중...</span>
          </div>
        </div>
      )}

      {/* 뉴스 그리드 */}
      <div className="space-y-3">
        {filteredNews.map((article, index) => (
          <NewsCard key={article.id || index} article={article} />
        ))}
      </div>

      {/* 더보기 버튼 */}
      {filteredNews.length >= 20 && (
        <Button
          className="w-full py-4 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-xl font-medium transition-colors border border-slate-600/30"
          onClick={() => {
            // 더 많은 뉴스 로드 로직
            console.log('Load more news');
          }}
        >
          더 많은 뉴스 보기
        </Button>
      )}

      {/* 에러 상태 */}
      {error && allNews.length > 0 && (
        <div className="text-center py-6">
          <p className="text-red-400 mb-3 text-sm">뉴스 업데이트 실패: {error}</p>
          <Button
            onClick={handleRetry}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2"
          >
            다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}

function NewsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-slate-700/50 rounded-xl animate-pulse"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 w-16 bg-slate-700/50 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>

      {[1, 2, 3].map(i => (
        <div key={i} className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-slate-700/50 rounded-xl animate-pulse"></div>
            <div className="flex-1 space-y-3">
              <div className="h-4 w-20 bg-slate-700/50 rounded animate-pulse"></div>
              <div className="h-6 w-full bg-slate-700/50 rounded animate-pulse"></div>
              <div className="h-4 w-3/4 bg-slate-700/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="text-red-400 text-6xl mb-6">⚠️</div>
      <h3 className="text-xl font-bold text-white mb-3">뉴스를 불러올 수 없습니다</h3>
      <p className="text-slate-400 mb-8">네트워크 연결을 확인하고 다시 시도해주세요.</p>
      <Button
        onClick={onRetry}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium"
      >
        다시 시도
      </Button>
    </div>
  );
}
