'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Copy, ExternalLink, Languages, CheckCircle } from 'lucide-react';

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: {
    id: string;
    title: string;
    titleKr?: string;
    url: string;
    source: string;
    content?: string;
    contentKr?: string;
    publishedAt?: string;
  };
}

export function SummaryModal({
  isOpen,
  onClose,
  article,
}: ArticleModalProps) {
  const [originalContent, setOriginalContent] = useState<string>('');
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [translatedTitle, setTranslatedTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && article) {
      fetchArticleContent();
    }
  }, [isOpen, article]);

  const fetchArticleContent = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch original content and translation from summarize API
      const response = await fetch('/api/news/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.url, title: article.title }),
      });

      if (!response.ok) {
        throw new Error('기사를 불러오는데 실패했습니다.');
      }

      const data = await response.json();

      setOriginalContent(data.originalContent || article.content || '원문을 불러올 수 없습니다.');
      setTranslatedContent(data.translatedContent || data.summary || '번역을 불러올 수 없습니다.');
      setTranslatedTitle(data.translatedTitle || article.titleKr || article.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy = `${translatedTitle}\n\n${translatedContent}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-[#0f111a] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
                  {article.source}
                </span>
                {article.publishedAt && (
                  <span className="text-xs text-gray-500">
                    {new Date(article.publishedAt).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white leading-tight mb-1 line-clamp-2">
                {translatedTitle || article.title}
              </h2>
              <p className="text-sm text-gray-400 line-clamp-1">
                {article.title}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                원문
              </a>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사됨' : '복사'}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-4" />
              <p className="text-gray-400">기사를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchArticleContent}
                className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 underline"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-x divide-white/10">
              {/* Left: Original Content */}
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 bg-white/5">
                  <Languages className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">Original</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm">
                    {originalContent}
                  </p>
                </div>
              </div>

              {/* Right: Korean Translation */}
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 bg-blue-500/10">
                  <Languages className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">한글 번역</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-gray-100 leading-relaxed whitespace-pre-line text-sm">
                    {translatedContent}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
