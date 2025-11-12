'use client';

import { useState, useEffect } from 'react';
import { NewsArticle } from '@/types/news';
import { X, ExternalLink, MessageCircle, ThumbsUp, Eye, Share2 } from 'lucide-react';
import { isEnglishText } from '@/lib/translation/simple-translator';
import { getSourceColor, getSourceIcon, formatTimeAgo } from '@/lib/utils/news-utils';

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: NewsArticle | null;
}

export function NewsModal({ isOpen, onClose, article }: NewsModalProps) {
  const [translatedTitle, setTranslatedTitle] = useState<string>('');
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [articleContent, setArticleContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (isOpen && article) {
      loadArticleContent();
      // 이미 번역된 제목이 있으면 사용, 없으면 번역 API 호출
      if (isEnglishText(article.title) && !article.titleKr) {
        translateTitle();
      } else if (article.titleKr) {
        setTranslatedTitle(article.titleKr);
      }
    }
  }, [isOpen, article]);

  const loadArticleContent = async () => {
    if (!article) return;

    setIsContentLoading(true);
    setError(null);

    try {
      // 실제 뉴스 내용을 가져오는 API 호출
      const response = await fetch('/api/news/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.url })
      });

      if (!response.ok) throw new Error('Failed to load content');

      const data = await response.json();
      setArticleContent(data.content || '');

      // 영어 내용이면 번역
      if (data.content && isEnglishText(data.content)) {
        translateContent(data.content);
      }
    } catch (err) {
      setError('뉴스 내용을 불러올 수 없습니다.');
      console.error('Content loading error:', err);
    } finally {
      setIsContentLoading(false);
    }
  };

  const translateTitle = async () => {
    if (!article) return;

    setIsTranslating(true);
    try {
      const response = await fetch('/api/news/translate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: [{ title: article.title }] })
      });

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      if (data.success && data.articles?.[0]?.titleKr) {
        setTranslatedTitle(data.articles[0].titleKr);
      }
    } catch (err) {
      console.error('Title translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const translateContent = async (content: string) => {
    setIsTranslating(true);
    try {
      const response = await fetch('/api/news/translate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: [{ title: content }] })
      });

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      if (data.success && data.articles?.[0]?.titleKr) {
        setTranslatedContent(data.articles[0].titleKr);
      }
    } catch (err) {
      console.error('Content translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const timeAgo = article ? formatTimeAgo(article.published) : '';

  const handleShare = async () => {
    if (!article) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.title,
          url: article.url,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // 클립보드에 URL 복사
      try {
        await navigator.clipboard.writeText(article.url);
        // 토스트 메시지 표시 (실제 구현에서는 토스트 컴포넌트 사용)
        alert('링크가 클립보드에 복사되었습니다.');
      } catch (err) {
        console.error('Failed to copy to clipboard');
      }
    }
  };

  if (!isOpen || !article) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* 모달 컨테이너 */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-toss-white rounded-toss-xl shadow-toss-xl animate-modal-slide border border-toss-gray-200">
        {/* 헤더 */}
        <div className="sticky top-0 bg-toss-white border-b border-toss-gray-200 rounded-toss-xl-t">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <span className={`text-sm px-3 py-1 rounded-full ${getSourceColor(article.source)}`}>
                {getSourceIcon(article.source)} {article.source}
              </span>
              <span className="text-sm text-toss-gray-500">{timeAgo}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-2 text-toss-gray-500 hover:text-toss-blue hover:bg-toss-blue-light rounded-full transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-toss-gray-500 hover:text-toss-gray-700 hover:bg-toss-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-6 space-y-6">
            {/* 이미지 */}
            {article.image && (
              <div className="w-full h-48 rounded-toss-lg overflow-hidden">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* 제목 */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-toss-black leading-tight">
                {translatedTitle || article.title}
              </h1>
              {translatedTitle && translatedTitle !== article.title && (
                <p className="text-lg text-toss-gray-600 leading-relaxed italic">
                  원본: {article.title}
                </p>
              )}
            </div>

            {/* 통계 */}
            <div className="flex items-center gap-6 text-sm text-toss-gray-500">
              {article.score !== undefined && (
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  {article.score}개 좋아요
                </span>
              )}
              {article.comments !== undefined && (
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  {article.comments}개 댓글
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                조회수
              </span>
            </div>

            {/* 내용 */}
            <div className="space-y-4">
              {isContentLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-toss-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-toss-gray-200 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-toss-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-toss-gray-500 mb-4">{error}</p>
                  <button
                    onClick={loadArticleContent}
                    className="px-4 py-2 bg-toss-blue text-toss-white rounded-lg hover:bg-toss-blue-dark transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                <div className="prose prose-gray max-w-none">
                  {articleContent ? (
                    <div className="space-y-4">
                      <div className="text-toss-gray-700 leading-relaxed whitespace-pre-wrap">
                        {articleContent}
                      </div>
                      {isEnglishText(articleContent) && translatedContent && (
                        <div className="border-l-4 border-toss-blue pl-4 bg-toss-blue-light/30 p-4 rounded-lg">
                          <h3 className="font-semibold text-toss-blue mb-2">번역된 내용</h3>
                          <div className="text-toss-gray-700 leading-relaxed whitespace-pre-wrap">
                            {translatedContent}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-toss-gray-500">뉴스 내용을 불러올 수 없습니다.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 번역 로딩 */}
            {isTranslating && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-toss-blue">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-toss-blue"></div>
                  <span className="text-sm">번역 중...</span>
                </div>
              </div>
            )}

            {/* 액션 버튼들 */}
            <div className="flex gap-3 pt-4 border-t border-toss-gray-200">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-toss-blue to-blue-600 text-toss-white rounded-toss hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-medium shadow-sm hover:shadow-md"
              >
                <ExternalLink className="w-4 h-4" />
                원문 보기
              </a>
              {article.redditUrl && (
                <a
                  href={article.redditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-toss hover:bg-orange-600 transition-colors font-medium"
                >
                  <MessageCircle className="w-4 h-4" />
                  Reddit
                </a>
              )}
              {isEnglishText(article.title) && (
                <button
                  onClick={() => {
                    if (translatedTitle) {
                      setTranslatedTitle('');
                    } else {
                      translateTitle();
                    }
                  }}
                  className="px-4 py-3 border border-toss-blue text-toss-blue rounded-toss hover:bg-toss-blue-light transition-colors font-medium"
                  disabled={isTranslating}
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
