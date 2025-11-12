import { NextRequest, NextResponse } from 'next/server';
import { batchTranslateWithGemini } from '@/lib/api/gemini';
import { isEnglishText } from '@/lib/translation/simple-translator';

export async function POST(request: NextRequest) {
  try {
    const { articles } = await request.json();

    if (!articles || !Array.isArray(articles)) {
      return NextResponse.json(
        { error: 'Articles array is required' },
        { status: 400 }
      );
    }

    // 영어 제목만 필터링
    const englishTitles = articles
      .filter(article => isEnglishText(article.title))
      .map(article => article.title);

    if (englishTitles.length === 0) {
      // 번역할 제목이 없으면 원본 그대로 반환
      return NextResponse.json({
        success: true,
        articles: articles.map(article => ({
          ...article,
          titleKr: article.titleKr || article.title
        }))
      });
    }

    // Gemini API를 사용한 배치 번역
    let translatedTitles: string[];
    try {
      translatedTitles = await batchTranslateWithGemini(englishTitles);
    } catch (error) {
      console.error('Gemini translation error:', error);
      // 번역 실패 시 원본 제목 사용
      translatedTitles = englishTitles;
    }

    // 번역 결과를 원본 articles에 매핑
    let translationIndex = 0;
    const processedArticles = articles.map(article => {
      if (isEnglishText(article.title)) {
        const translatedTitle = translatedTitles[translationIndex] || article.title;
        translationIndex++;
        return {
          ...article,
          titleKr: translatedTitle
        };
      }
      return {
        ...article,
        titleKr: article.titleKr || article.title
      };
    });

    return NextResponse.json({
      success: true,
      articles: processedArticles,
      translatedCount: englishTitles.length
    });

  } catch (error) {
    console.error('Batch translation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to translate articles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
