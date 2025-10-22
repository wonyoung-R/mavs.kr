'use client';

import { NewsFeed } from '@/components/news/NewsFeed';
import { NewsArticle } from '@/types/news';
import { useState, useEffect } from 'react';

export default function NewsPage() {
  const [initialNews, setInitialNews] = useState<NewsArticle[]>([]);

  useEffect(() => {
    // 초기 뉴스 데이터 로드 (번역 포함)
    fetch('/api/news/all?limit=20&translate=true')
      .then(res => res.json())
      .then(data => setInitialNews(data.articles || []))
      .catch(err => console.error('Failed to load initial news:', err));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pt-24">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 mb-4">
            📰 최신 뉴스
          </h1>
          <p className="text-xl text-blue-100">
            달라스 매버릭스의 최신 소식을 확인하세요
          </p>
        </div>

        <NewsFeed initialData={initialNews} />
      </div>
    </div>
  );
}
