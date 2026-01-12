'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Share, X, Download, Instagram } from 'lucide-react';
import { toPng } from 'html-to-image';
import StoryCard from './StoryCard';

interface ShareStoryButtonProps {
  title: string;
  content: string;
  author: string;
  category: string;
  categoryIcon?: string;
  className?: string;
}

export default function ShareStoryButton({
  title,
  content,
  author,
  category,
  categoryIcon = '🗣️',
  className = '',
}: ShareStoryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // 이미지를 Blob으로 변환하는 함수
  const generateImageBlob = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;

    const dataUrl = await toPng(cardRef.current, {
      quality: 1,
      pixelRatio: 1,
    });

    // DataURL을 Blob으로 변환
    const response = await fetch(dataUrl);
    return await response.blob();
  }, []);

  // 다운로드 핸들러
  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;

    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 1,
      });

      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.download = `mavs-story-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('이미지 생성 실패:', error);
      alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // 앱으로 공유 (Web Share API)
  const handleShareToApp = useCallback(async () => {
    if (!cardRef.current) return;

    setIsGenerating(true);
    try {
      const blob = await generateImageBlob();
      if (!blob) throw new Error('이미지 생성 실패');

      const file = new File([blob], `mavs-story-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: '🏀 MAVS.KR에서 공유',
        });
      } else {
        // Web Share API를 지원하지 않으면 다운로드로 대체
        alert('이 브라우저에서는 앱 공유가 지원되지 않습니다. 이미지를 다운로드합니다.');
        await handleDownload();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('공유 실패:', error);
        alert('공유에 실패했습니다. 이미지를 다운로드해주세요.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [title, generateImageBlob, handleDownload]);

  return (
    <>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 hover:text-blue-400 transition-colors ${className}`}
        title="인스타 스토리 공유"
      >
        <Share className="w-5 h-5" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Instagram className="w-5 h-5 text-pink-400" />
                <span className="font-medium">인스타 스토리 공유</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview */}
            <div className="p-4 flex justify-center">
              <div
                className="relative rounded-xl overflow-hidden shadow-2xl bg-slate-800"
                style={{ width: '270px', height: '480px' }}
              >
                {/* Scaled Preview */}
                <div
                  style={{
                    transform: 'scale(0.25)',
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  <StoryCard
                    ref={cardRef}
                    title={title}
                    content={content}
                    author={author}
                    category={category}
                    categoryIcon={categoryIcon}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-white/10 space-y-3">
              {/* 앱으로 공유 버튼 (모바일에서 권장) */}
              <button
                onClick={handleShareToApp}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Instagram className="w-5 h-5" />
                    인스타그램에 공유
                  </>
                )}
              </button>

              {/* 다운로드 버튼 */}
              <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                이미지 다운로드
              </button>

              <p className="text-center text-xs text-slate-500">
                모바일에서 "인스타그램에 공유"를 눌러 바로 스토리에 올려보세요
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

