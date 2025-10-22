import { NextRequest, NextResponse } from 'next/server';
import { NewsArticle } from '@/types/news';
import { batchTranslateWithGemini } from '@/lib/api/gemini';
import { isEnglishText } from '@/lib/translation/simple-translator';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const source = searchParams.get('source'); // 특정 소스 필터링
  const translate = searchParams.get('translate') === 'true'; // 번역 여부

  try {
    // DB 연결 시도 (선택적)
    let dbArticles: NewsArticle[] = [];

    try {
      const { prisma } = await import('@/lib/db/prisma');
      const dbNews = await prisma.news.findMany({
        where: source ? { source: source as any } : {},
        orderBy: {
          publishedAt: 'desc',
        },
        take: Math.ceil(limit / 2), // 전체의 절반을 DB에서
        include: {
          tags: true,
        },
      });

      // DB 뉴스를 NewsArticle 형태로 변환
      dbArticles = dbNews.map(news => ({
        id: news.id,
        title: news.title,
        titleKr: news.titleKr || news.title,
        description: news.summary || '',
        url: news.sourceUrl,
        image: news.imageUrl || undefined,
        published: news.publishedAt.toISOString(),
        source: news.source,
        author: news.author || undefined,
        categories: news.tags.map(tag => tag.name),
      }));
    } catch (dbError) {
      console.warn('DB connection failed, using API only:', dbError);
      // DB 연결 실패 시 빈 배열로 계속 진행
    }

    // 실시간 API에서 뉴스 가져오기
    const [
      espnNews,
      redditPosts,
      smokingCubanNews,
      naverNews
    ] = await Promise.allSettled([
      source === 'espn' || !source ? fetch(`${request.nextUrl.origin}/api/news/espn?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] }),
      source === 'reddit' || !source ? fetch(`${request.nextUrl.origin}/api/news/reddit?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] }),
      source === 'tsc' || !source ? fetch(`${request.nextUrl.origin}/api/news/smoking-cuban?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] }),
      source === 'naver' || !source ? fetch(`${request.nextUrl.origin}/api/news/naver?limit=${Math.ceil(limit / 4)}`).then(r => r.json()) : Promise.resolve({ articles: [] })
    ]);

    // 성공한 실시간 API 결과만 합치기
    const apiNews: NewsArticle[] = [];

    if (espnNews.status === 'fulfilled' && espnNews.value.articles) {
      apiNews.push(...espnNews.value.articles);
    }
    if (redditPosts.status === 'fulfilled' && redditPosts.value.articles) {
      apiNews.push(...redditPosts.value.articles);
    }
    if (smokingCubanNews.status === 'fulfilled' && smokingCubanNews.value.articles) {
      apiNews.push(...smokingCubanNews.value.articles);
    }
    if (naverNews.status === 'fulfilled' && naverNews.value.articles) {
      apiNews.push(...naverNews.value.articles);
    }

    // DB 뉴스와 API 뉴스 합치기
    const allNews: NewsArticle[] = [...dbArticles, ...apiNews];

    // 시간순 정렬 (최신순)
    allNews.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

    // 중복 제거 (제목 기준)
    const uniqueNews: NewsArticle[] = [];
    const seenTitles = new Set<string>();

    for (const article of allNews) {
      const normalizedTitle = article.title.toLowerCase().replace(/[^\w\s]/gi, '');
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        uniqueNews.push(article);
      }
    }

    const finalNews = uniqueNews.slice(0, limit);

    // 번역 요청이 있으면 영어 제목들을 번역 (DB 뉴스는 이미 번역됨)
    if (translate) {
      try {
        // API에서 온 뉴스 중 영어 제목만 필터링
        const englishTitles = finalNews
          .filter(article =>
            isEnglishText(article.title) &&
            !article.titleKr // 이미 번역된 DB 뉴스 제외
          )
          .map(article => article.title);

        if (englishTitles.length > 0) {
          // Gemini API 키가 없으면 번역 건너뛰기
          if (!process.env.GEMINI_API_KEY) {
            console.log('GEMINI_API_KEY not found, skipping translation');
            finalNews.forEach(article => {
              if (!article.titleKr) {
                article.titleKr = article.title;
              }
            });
          } else {
            const translatedTitles = await batchTranslateWithGemini(englishTitles);

            // 번역 결과를 매핑
            let translationIndex = 0;
            finalNews.forEach(article => {
              if (isEnglishText(article.title) && !article.titleKr) {
                article.titleKr = translatedTitles[translationIndex] || article.title;
                translationIndex++;
              } else if (!article.titleKr) {
                article.titleKr = article.title;
              }
            });
          }
        } else {
          // 영어 제목이 없으면 원본 제목을 titleKr에 설정
          finalNews.forEach(article => {
            if (!article.titleKr) {
              article.titleKr = article.title;
            }
          });
        }
      } catch (translationError) {
        console.error('Translation error:', translationError);
        // 번역 실패 시 원본 제목 사용
        finalNews.forEach(article => {
          if (!article.titleKr) {
            article.titleKr = article.title;
          }
        });
      }
    } else {
      // 번역 요청이 없으면 원본 제목을 titleKr에 설정
      finalNews.forEach(article => {
        if (!article.titleKr) {
          article.titleKr = article.title;
        }
      });
    }

    return NextResponse.json({
      articles: finalNews,
      total: uniqueNews.length,
      sources: {
        db: dbArticles.length,
        espn: espnNews.status === 'fulfilled' ? espnNews.value.articles?.length || 0 : 0,
        reddit: redditPosts.status === 'fulfilled' ? redditPosts.value.articles?.length || 0 : 0,
        tsc: smokingCubanNews.status === 'fulfilled' ? smokingCubanNews.value.articles?.length || 0 : 0,
        naver: naverNews.status === 'fulfilled' ? naverNews.value.articles?.length || 0 : 0
      },
      timestamp: new Date().toISOString(),
      translated: translate
    });

  } catch (error) {
    console.error('News Aggregation Error:', error);
    return NextResponse.json({
      articles: [],
      error: 'Failed to fetch news',
      sources: { db: 0, espn: 0, reddit: 0, tsc: 0, naver: 0 }
    }, { status: 500 });
  }
}
