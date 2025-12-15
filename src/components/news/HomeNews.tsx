'use client';

import { useState, useEffect } from 'react';
import { NewsArticle } from '@/types/news';
import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useNews } from '@/hooks/useNews';
import { SourceBadge } from './SourceBadge';
import { TimeBadge } from './TimeBadge';
import { isEnglishText } from '@/lib/translation/simple-translator';

interface HomeNewsProps {
  initialData?: NewsArticle[];
}

export function HomeNews({ initialData = [] }: HomeNewsProps) {
  const { news, loading } = useNews({
    initialData: initialData.slice(0, 5),
    autoRefresh: false,
    limit: 5,
  });

  const [translatedNews, setTranslatedNews] = useState<NewsArticle[]>(news);

  // news가 변경될 때 translatedNews도 업데이트
  useEffect(() => {
    setTranslatedNews(news);
  }, [news]);

  // 영어 제목 번역
  useEffect(() => {
    const translateTitles = async () => {
      const articlesToTranslate = news.filter(
        article => isEnglishText(article.title) && !article.titleKr
      );

      if (articlesToTranslate.length === 0) {
        setTranslatedNews(news);
        return;
      }

      try {
        const response = await fetch('/api/news/translate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articles: articlesToTranslate.map(a => ({ title: a.title }))
          })
        });

        if (!response.ok) {
          setTranslatedNews(news);
          return;
        }

        const data = await response.json();
        if (data.success && data.articles) {
          // 번역 결과를 원본 뉴스에 매핑
          const translationMap = new Map<string, string>();
          let translationIndex = 0;

          articlesToTranslate.forEach(article => {
            if (data.articles[translationIndex]?.titleKr) {
              translationMap.set(article.title, data.articles[translationIndex].titleKr);
              translationIndex++;
            }
          });

          const updatedNews = news.map(article => {
            if (translationMap.has(article.title)) {
              return {
                ...article,
                titleKr: translationMap.get(article.title) || article.title
              };
            }
            return article;
          });

          setTranslatedNews(updatedNews);
        } else {
          setTranslatedNews(news);
        }
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedNews(news);
      }
    };

    if (news.length > 0) {
      translateTitles();
    }
  }, [news]);

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
      {translatedNews.map((article, index) => (
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
                  <SourceBadge source={article.source} className="text-xs px-3 py-1.5" />
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
                <TimeBadge published={article.published} className="ml-4" />
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
