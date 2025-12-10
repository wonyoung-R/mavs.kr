// src/app/api/news/all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NewsArticle } from '@/types/news';
import { batchTranslateWithGemini } from '@/lib/api/gemini';
import { isEnglishText } from '@/lib/translation/simple-translator';
import { getNewsFromSupabase, getNewsCount } from '@/lib/services/news-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const source = searchParams.get('source') || undefined;
  const translate = searchParams.get('translate') === 'true';
  const forceApi = searchParams.get('forceApi') === 'true'; // 실시간 API 강제 사용

  try {
    // 1. Supabase에서 뉴스 조회 (우선)
    let dbArticles: NewsArticle[] = [];
    let useSupabase = !forceApi;

    if (useSupabase) {
      try {
        dbArticles = await getNewsFromSupabase({ limit, source });
        console.log(`Supabase: ${dbArticles.length} articles loaded`);
      } catch (dbError) {
        console.warn('Supabase connection failed, falling back to API:', dbError);
        useSupabase = false;
      }
    }

    // 2. DB에 충분한 데이터가 없거나 forceApi인 경우 실시간 API 호출
    let apiNews: NewsArticle[] = [];

    if (!useSupabase || dbArticles.length < limit / 2) {
      const [
        espnNews,
        mavsMoneyballNews,
        smokingCubanNews,
        naverNews
      ] = await Promise.allSettled([
        !source || source === 'espn' ? fetch(`${request.nextUrl.origin}/api/news/espn?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] }),
        !source || source === 'mmb' ? fetch(`${request.nextUrl.origin}/api/news/mavsmoneyball?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] }),
        !source || source === 'tsc' ? fetch(`${request.nextUrl.origin}/api/news/smoking-cuban?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] }),
        !source || source === 'naver' ? fetch(`${request.nextUrl.origin}/api/news/naver?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] })
      ]);

      if (espnNews.status === 'fulfilled' && espnNews.value.articles) {
        apiNews.push(...espnNews.value.articles);
      }
      if (mavsMoneyballNews.status === 'fulfilled' && mavsMoneyballNews.value.articles) {
        apiNews.push(...mavsMoneyballNews.value.articles);
      }
      if (smokingCubanNews.status === 'fulfilled' && smokingCubanNews.value.articles) {
        apiNews.push(...smokingCubanNews.value.articles);
      }
      if (naverNews.status === 'fulfilled' && naverNews.value.articles) {
        apiNews.push(...naverNews.value.articles);
      }
    }

    // 3. DB 뉴스와 API 뉴스 합치기 (DB 우선)
    const allNews: NewsArticle[] = [...dbArticles, ...apiNews];

    // 4. 시간순 정렬 (최신순)
    allNews.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

    // 5. 중복 제거 (URL 기준)
    const uniqueNews: NewsArticle[] = [];
    const seenUrls = new Set<string>();

    for (const article of allNews) {
      if (!seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        uniqueNews.push(article);
      }
    }

    const finalNews = uniqueNews.slice(0, limit);

    // 6. 번역 처리
    if (translate) {
      try {
        const englishTitles = finalNews
          .filter(article => isEnglishText(article.title) && !article.titleKr)
          .map(article => article.title);

        if (englishTitles.length > 0 && process.env.GEMINI_API_KEY) {
          const translatedTitles = await batchTranslateWithGemini(englishTitles);

          let translationIndex = 0;
          finalNews.forEach(article => {
            if (isEnglishText(article.title) && !article.titleKr) {
              article.titleKr = translatedTitles[translationIndex] || article.title;
              translationIndex++;
            } else if (!article.titleKr) {
              article.titleKr = article.title;
            }
          });
        } else {
          finalNews.forEach(article => {
            if (!article.titleKr) article.titleKr = article.title;
          });
        }
      } catch (translationError) {
        console.error('Translation error:', translationError);
        finalNews.forEach(article => {
          if (!article.titleKr) article.titleKr = article.title;
        });
      }
    } else {
      finalNews.forEach(article => {
        if (!article.titleKr) article.titleKr = article.title;
      });
    }

    return NextResponse.json({
      articles: finalNews,
      total: uniqueNews.length,
      sources: {
        supabase: dbArticles.length,
        api: apiNews.length,
      },
      timestamp: new Date().toISOString(),
      translated: translate
    });

  } catch (error) {
    console.error('News Aggregation Error:', error);
    return NextResponse.json({
      articles: [],
      error: 'Failed to fetch news',
      sources: { supabase: 0, api: 0 }
    }, { status: 500 });
  }
}
