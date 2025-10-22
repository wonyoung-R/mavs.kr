// src/hooks/useBatchTranslation.ts
import { useState, useEffect } from 'react';
import { translationCache } from '@/lib/cache/translation-cache';

interface UseBatchTranslationProps {
  articles: Array<{ id: string; title: string; source: string }>;
  enabled?: boolean;
}

export function useBatchTranslation({ articles, enabled = true }: UseBatchTranslationProps) {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const translateBatch = async () => {
      // 번역이 필요한 영어 제목들만 필터링
      const englishTitles = articles
        .filter(article => {
          if (article.source.toLowerCase().includes('네이버')) return false;
          const hasEnglishChars = /[a-zA-Z]/.test(article.title);
          const hasKoreanChars = /[가-힣]/.test(article.title);
          return hasEnglishChars && !hasKoreanChars;
        })
        .map(article => article.title);

      if (englishTitles.length === 0) return;

      setIsTranslating(true);
      try {
        const response = await fetch('/api/translate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: englishTitles })
        });

        if (response.ok) {
          const data = await response.json();
          const newTranslations: Record<string, string> = {};

          englishTitles.forEach((title, index) => {
            newTranslations[title] = data.translations[index] || title;
          });

          setTranslations(prev => ({ ...prev, ...newTranslations }));
        }
      } catch (error) {
        console.error('Batch translation error:', error);
      } finally {
        setIsTranslating(false);
      }
    };

    // 컴포넌트 마운트 후 2초 뒤에 배치 번역 실행
    const timer = setTimeout(translateBatch, 2000);
    return () => clearTimeout(timer);
  }, [articles, enabled]);

  return { translations, isTranslating };
}


