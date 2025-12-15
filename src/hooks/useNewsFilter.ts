import { useState, useMemo } from 'react';
import { NewsArticle } from '@/types/news';
import { filterNewsBySource } from '@/lib/utils/news-utils';

export function useNewsFilter(articles: NewsArticle[]) {
  const [filter, setFilter] = useState('all');

  const filteredArticles = useMemo(() => {
    return filterNewsBySource(articles, filter);
  }, [articles, filter]);

  return {
    filter,
    setFilter,
    filteredArticles,
  };
}


