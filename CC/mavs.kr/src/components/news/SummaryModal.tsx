'use client';

import { useState } from 'react';
import { Loader2, Languages, X, Copy, ExternalLink } from 'lucide-react';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: {
    id: string;
    title: string;
    url: string;
    source: string;
  };
  summary: any;
  isLoading: boolean;
  error: string | null;
}

export function SummaryModal({
  isOpen,
  onClose,
  article,
  summary,
  isLoading,
  error
}: SummaryModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!summary) return;

    const textToCopy = `${summary.translatedTitle}\n\n${summary.keyPoints?.join('\n') || summary.summary}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden animate-slide-up shadow-2xl">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <Languages className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">AI 번역 및 요약</h2>
            {summary?.fallback && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                기사보기
              </span>
            )}
            {!summary?.fallback && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Gemini AI
              </span>
            )}
          </div>

          <p className="text-sm text-blue-100">
            {article.source} • {article.title.substring(0, 50)}...
          </p>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
              <p className="text-lg font-medium mb-2">AI가 기사를 요약중입니다</p>
              <p className="text-sm text-gray-400">잠시만 기다려주세요...</p>
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">기사 본문 분석중...</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                  <span className="text-xs text-gray-500">핵심 내용 추출중...</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                  <span className="text-xs text-gray-500">한국어로 번역중...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
              <button
                onClick={handleClose}
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                닫기
              </button>
            </div>
          )}

          {summary && !isLoading && (
            <div className="space-y-6">
              {/* 한글 번역된 제목 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-600 mb-2 flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  한글 번역
                </h4>
                <h3 className="text-xl font-bold text-gray-800">{summary.translatedTitle}</h3>
              </div>

              {/* 영문 원본 */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-600 mb-2 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  영문 원본
                </h4>
                <p className="text-gray-700 font-medium">{summary.originalTitle || article.title}</p>
                {summary.originalContent && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <p className="text-sm text-gray-600 leading-relaxed">{summary.originalContent}</p>
                  </div>
                )}
              </div>

              {/* 한글 요약본 */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-600 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-green-500 rounded"></span>
                  한글 요약본
                  {summary?.fallback && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">
                      제목 기반 요약
                    </span>
                  )}
                </h4>

                {/* 핵심 포인트 */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-green-700 mb-2">핵심 내용</h5>
                    <ul className="space-y-2">
                      {summary.keyPoints.map((point: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span className="text-gray-700 text-sm">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 상세 요약 */}
                {summary.summary && (
                  <div>
                    <h5 className="font-semibold text-green-700 mb-2">상세 요약</h5>
                    <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-line">{summary.summary}</p>
                  </div>
                )}
              </div>

              {/* 감정 분석 */}
              {summary.sentiment && (
                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-600">기사 논조:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    summary.sentiment === 'positive'
                      ? 'bg-green-100 text-green-800'
                      : summary.sentiment === 'negative'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {summary.sentiment === 'positive' ? '긍정적'
                     : summary.sentiment === 'negative' ? '부정적'
                     : '중립적'}
                  </span>

                  {summary.relevanceScore && (
                    <>
                      <span className="text-sm text-gray-600">관련도:</span>
                      <div className="flex gap-1">
                        {[...Array(10)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < summary.relevanceScore
                                ? 'bg-blue-500'
                                : 'bg-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? '복사됨!' : '복사'}
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
