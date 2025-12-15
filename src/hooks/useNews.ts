import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsArticle } from '@/types/news';

interface UseNewsOptions {
  initialData?: NewsArticle[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  limit?: number;
}

export function useNews({
  initialData = [],
  autoRefresh = false,
  refreshInterval = 30 * 60 * 1000, // 30 minutes
  limit = 20,
}: UseNewsOptions = {}) {
  const [news, setNews] = useState<NewsArticle[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDataRef = useRef<string>('');

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const minLoadingTime = new Promise(resolve => setTimeout(resolve, 2000));
      
      const [response] = await Promise.all([
        fetch(`/api/news/all?limit=${limit}&translate=true`),
        minLoadingTime
      ]);

      if (!response.ok) throw new Error('Failed to fetch news');

      const data = await response.json();
      setNews(data.articles || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('News fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // initialData가 변경되면 상태 업데이트 (실제 내용 변경 시에만)
  useEffect(() => {
    const currentDataKey = JSON.stringify(initialData.map(a => a.id || a.url));
    if (initialData.length > 0 && currentDataKey !== initialDataRef.current) {
      initialDataRef.current = currentDataKey;
      setNews(initialData);
    }
  }, [initialData]);

  // 초기 로드
  useEffect(() => {
    if (initialData.length === 0 && news.length === 0) {
      fetchNews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 자동 새로고침
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchNews();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchNews]);

  return {
    news,
    loading,
    error,
    refetch: fetchNews,
  };
}


