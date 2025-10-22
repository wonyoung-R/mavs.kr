'use client';

import { useState, useEffect } from 'react';
import { NewsArticle } from '@/types/news';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ExternalLink, MessageCircle, ThumbsUp, Eye, FileText, ChevronRight } from 'lucide-react';
import { isEnglishText } from '@/lib/translation/simple-translator';
import { SummaryModal } from './SummaryModal';
import { NewsModal } from './NewsModal';

interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeAgo = (() => {
    try {
      const publishedDate = new Date(article.published);
      if (isNaN(publishedDate.getTime())) {
        return '시간 정보 없음';
      }
      return formatDistanceToNow(publishedDate, {
        addSuffix: true,
        locale: ko
      });
    } catch (error) {
      console.error('Date parsing error:', error);
      return '시간 정보 없음';
    }
  })();


  const handleSummarize = async () => {
    setIsSummaryModalOpen(true);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/news/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: article.url,
          title: article.title
        })
      });

      if (!response.ok) throw new Error('Failed to summarize');

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError('요약 생성에 실패했습니다. 다시 시도해주세요.');
      console.error('Summary error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSummarize();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsNewsModalOpen(true);
  };


  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'espn':
        return 'text-red-300 bg-red-600/20 border-red-500/30';
      case 'reddit':
        return 'text-orange-300 bg-orange-600/20 border-orange-500/30';
      case 'the smoking cuban':
        return 'text-blue-300 bg-blue-600/20 border-blue-500/30';
      case '네이버 스포츠':
        return 'text-green-300 bg-green-600/20 border-green-500/30';
      default:
        return 'text-slate-300 bg-slate-600/20 border-slate-500/30';
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

  return (
    <>
      {/* 모바일 버전 - 제목만 표시 */}
      <div className="md:hidden">
        <div
          onClick={handleCardClick}
          className="block bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 hover:bg-slate-700/50 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg border border-slate-700/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <h3
              onClick={handleTitleClick}
              className="font-semibold text-white line-clamp-2 leading-relaxed cursor-pointer hover:text-blue-400 transition-colors flex-1 pr-2"
            >
              {article.titleKr || article.title}
            </h3>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* 데스크톱 버전 - 전체 내용 표시 */}
      <div className="hidden md:block">
        <div
          onClick={handleCardClick}
          className="block bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 hover:bg-slate-700/50 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg border border-slate-700/50 cursor-pointer group"
        >
          <div className="flex gap-4">
            {/* 이미지 */}
            {article.image && (
              <div className="flex-shrink-0">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-20 h-20 object-cover rounded-xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                  loading="lazy"
                />
              </div>
            )}

            {/* 콘텐츠 */}
            <div className="flex-1 min-w-0">
              {/* 소스 및 시간 */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded-full border ${getSourceColor(article.source)}`}>
                  {getSourceIcon(article.source)} {article.source}
                </span>
                {article.flair && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-blue-400 font-medium">{article.flair}</span>
                  </>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">{timeAgo}</span>
              </div>

              {/* 제목 */}
              <div className="mb-3">
                <h3
                  onClick={handleTitleClick}
                  className="font-semibold text-white mb-2 line-clamp-2 leading-relaxed cursor-pointer hover:text-blue-400 transition-colors"
                >
                  {article.titleKr || article.title}
                </h3>
                {article.titleKr && article.titleKr !== article.title && (
                  <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed italic">
                    원본: {article.title}
                  </p>
                )}
              </div>

              {/* 액션 버튼들 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  {/* Reddit 통계 */}
                  {article.score !== undefined && (
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      {article.score}
                    </span>
                  )}
                  {article.comments !== undefined && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {article.comments}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    조회수
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* 원문링크 버튼 */}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center space-x-1 px-2 py-1 rounded-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>원문링크</span>
                  </a>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI 요약 모달 */}
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        article={article}
        summary={summary}
        isLoading={isLoading}
        error={error}
      />

      {/* 뉴스 상세 모달 */}
      <NewsModal
        isOpen={isNewsModalOpen}
        onClose={() => setIsNewsModalOpen(false)}
        article={article}
      />
    </>
  );
}
