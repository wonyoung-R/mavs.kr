'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NewsArticle } from '@/types/news';
import { X, ExternalLink, Eye, Share2, Languages } from 'lucide-react';
import { getSourceColor, getSourceIcon, formatTimeAgo } from '@/lib/utils/news-utils';

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: NewsArticle | null;
}

export function NewsModal({ isOpen, onClose, article }: NewsModalProps) {
  const [translatedTitle, setTranslatedTitle] = useState<string>('');
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [articleContent, setArticleContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && article) {
      // 초기화
      setTranslatedTitle(article.titleKr || '');
      setTranslatedContent(article.contentKr || '');
      setArticleContent(article.description || '');

      // 내용이 없으면 DB에서 불러오기
      if (!article.description) {
        loadArticleContent();
      }
    }
  }, [isOpen, article]);

  const loadArticleContent = async () => {
    if (!article) return;

    setIsContentLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/news/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: article.id, url: article.url })
      });

      if (!response.ok) throw new Error('Failed to load content');

      const data = await response.json();

      if (data.success && data.data) {
        setArticleContent(data.data.content || '');
        setTranslatedContent(data.data.content_kr || '');
        if (data.data.title_kr) {
          setTranslatedTitle(data.data.title_kr);
        }
      }
    } catch (err) {
      setError('뉴스 내용을 불러올 수 없습니다.');
      console.error('Content loading error:', err);
    } finally {
      setIsContentLoading(false);
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
      } catch {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(article.url);
        alert('링크가 클립보드에 복사되었습니다.');
      } catch {
        console.error('Failed to copy to clipboard');
      }
    }
  };

  if (!isOpen || !article) return null;
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* 모달 컨테이너 */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-toss-white rounded-toss-xl shadow-toss-xl animate-modal-slide border border-toss-gray-200">
        {/* 헤더 */}
        <div className="sticky top-0 bg-toss-white border-b border-toss-gray-200 rounded-toss-xl-t z-10">
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
                  {/* 한글 번역 내용 (있을 경우 우선 표시) */}
                  {translatedContent ? (
                    <div className="space-y-4">
                      <div className="border-l-4 border-toss-blue pl-4 bg-toss-blue-light/10 p-4 rounded-lg">
                        <h3 className="font-semibold text-toss-blue mb-2 flex items-center gap-2">
                          <Languages className="w-4 h-4" />
                          AI 번역 내용
                        </h3>
                        <div className="text-toss-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                          {translatedContent}
                        </div>
                      </div>

                      {/* 원문 토글 또는 아래 표시 (여기서는 아래 표시) */}
                      <details className="group mt-4">
                        <summary className="cursor-pointer text-sm text-toss-gray-500 hover:text-toss-blue mb-2 select-none">
                          원문 보기
                        </summary>
                        <div className="text-toss-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm">
                          {articleContent}
                        </div>
                      </details>
                    </div>
                  ) : (
                    // 번역 내용이 없으면 원문 표시
                    <div className="text-toss-gray-700 leading-relaxed whitespace-pre-wrap">
                      {articleContent || (
                        <p className="text-center text-toss-gray-500 py-8">
                          상세 내용을 불러올 수 없습니다.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

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
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
