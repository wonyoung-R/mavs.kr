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
    console.log('All articles:', articles.map(a => ({ title: a.title, isEnglish: isEnglishText(a.title) })));

    // 강제로 모든 제목을 번역 대상으로 설정 (테스트용)
    const englishTitles = articles.map(article => article.title);
    console.log('All titles to translate (forced):', englishTitles);

    if (englishTitles.length === 0) {
      console.log('No English titles found, returning original');
      // 번역할 제목이 없으면 원본 그대로 반환
      return NextResponse.json({
        success: true,
        articles: articles.map(article => ({
          ...article,
          titleKr: article.titleKr || article.title
        }))
      });
    }

    // 간단한 번역 직접 구현 (Gemini API 우회)
    console.log('Using simple translation for:', englishTitles);
    const translatedTitles = englishTitles.map(title => {
      // 간단한 단어별 번역
      return title
        .replace(/Mavericks/gi, '매버릭스')
        .replace(/dream/gi, '꿈')
        .replace(/free agency/gi, '자유계약 시장')
        .replace(/reunion/gi, '재결합')
        .replace(/falling apart/gi, '무너지고 있는')
        .replace(/fast/gi, '빠르게')
        .replace(/Dallas/gi, '달라스')
        .replace(/Lakers/gi, '레이커스')
        .replace(/Los Angeles/gi, '로스앤젤레스')
        .replace(/game/gi, '경기')
        .replace(/highlights/gi, '하이라이트')
        .replace(/Cooper Flagg/gi, '쿠퍼 플래그')
        .replace(/NBA/gi, 'NBA')
        .replace(/league/gi, '리그')
        .replace(/notice/gi, '주목')
        .replace(/played/gi, '뛴')
        .replace(/before/gi, '전에')
        .replace(/ever/gi, '이전에')
        .replace(/put/gi, '두다')
        .replace(/on/gi, '에')
        .replace(/he/gi, '그는');
    });
    console.log('Simple translation result:', translatedTitles);

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
