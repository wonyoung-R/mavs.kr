'use client';

import { NewsCard } from './NewsCard';
import { Button } from '@/components/ui/Button';
import { NewsFilterButtons } from './NewsFilterButtons';
import { useNews } from '@/hooks/useNews';
import { useNewsFilter } from '@/hooks/useNewsFilter';
import { NewsArticle } from '@/types/news';

interface NewsFeedProps {
  initialData?: NewsArticle[];
}

export function NewsFeed({ initialData = [] }: NewsFeedProps) {
  const { news, loading, error, refetch: fetchNews } = useNews({
    initialData,
    autoRefresh: true,
    refreshInterval: 30 * 60 * 1000, // 30 minutes
  });

  const { filter, setFilter, filteredArticles } = useNewsFilter(news);

  if (loading && news.length === 0) {
    return <NewsLoadingSkeleton />;
  }

  if (error && news.length === 0) {
    return <NewsErrorState onRetry={fetchNews} />;
  }

  return (
    <div className="space-y-6">
      {/* 필터 버튼 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">최신 뉴스</h2>
        <NewsFilterButtons
          currentFilter={filter}
          onFilterChange={setFilter}
        />
      </div>

      {/* 로딩 상태 */}
      {loading && news.length > 0 && (
        <div className="text-center py-6">
          <div className="inline-flex items-center space-x-2 text-slate-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-sm">뉴스 업데이트 중...</span>
          </div>
        </div>
      )}

      {/* 뉴스 그리드 */}
      <div className="space-y-3">
        {filteredArticles.map((article, index) => (
          <NewsCard key={article.id || index} article={article} />
        ))}
      </div>

      {/* 더보기 버튼 */}
      {filteredArticles.length >= 20 && (
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
      {error && news.length > 0 && (
        <div className="text-center py-6">
          <p className="text-red-400 mb-3 text-sm">뉴스 업데이트 실패: {error}</p>
          <Button
            onClick={fetchNews}
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
