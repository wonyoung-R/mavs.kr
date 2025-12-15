// src/app/api/news/all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NewsSource } from '@prisma/client';
import { getNews, getNewsCount } from '@/lib/services/news-prisma-service';
import { batchTranslateWithGemini } from '@/lib/api/gemini';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const sourceParam = searchParams.get('source');
  const translate = searchParams.get('translate') === 'true';

  try {
    // Source mapping
    let dbSource: NewsSource | undefined;
    if (sourceParam === 'espn' || sourceParam === 'ESPN') dbSource = 'ESPN';
    if (sourceParam === 'tsc' || sourceParam === 'SMOKING_CUBAN') dbSource = 'SMOKING_CUBAN';
    if (sourceParam === 'mmb' || sourceParam === 'MAVS_MONEYBALL') dbSource = 'MAVS_MONEYBALL';

    // Get news from Prisma (connected to Supabase)
    const news = await getNews({ 
      limit, 
      source: dbSource,
      orderBy: 'publishedAt' 
    });

    console.log(`[News All] Loaded ${news.length} articles for source: ${dbSource || 'all'}`);

    // Transform to response format
    let articles = news.map(n => ({
      id: n.id,
      title: n.title,
      titleKr: n.titleKr,
      description: n.content,
      contentKr: n.contentKr,
      url: n.sourceUrl,
      image: n.imageUrl,
      published: n.publishedAt.toISOString(),
      source: n.source,
      author: n.author,
      isTranslated: !!n.titleKr,
    }));

    // On-the-fly translation if requested and API key available
    if (translate && process.env.GEMINI_API_KEY) {
      try {
        const untranslatedTitles = articles
          .filter(a => !a.titleKr)
          .map(a => a.title);
        
        if (untranslatedTitles.length > 0) {
          const translated = await batchTranslateWithGemini(untranslatedTitles);
          let idx = 0;
          articles = articles.map(a => {
            if (!a.titleKr) {
              return { ...a, titleKr: translated[idx++] || a.title };
            }
            return a;
          });
        }
      } catch (e) {
        console.error('[News All] Translation error:', e);
      }
    }

    // Use Korean content for description if available
    const displayArticles = articles.map(a => ({
      ...a,
      description: a.contentKr || a.description,
    }));

    const total = await getNewsCount({ source: dbSource });

    return NextResponse.json({
      success: true,
      articles: displayArticles,
      total,
    });

  } catch (error) {
    console.error('[News All] Error:', error);
    return NextResponse.json({ 
      success: false, 
      articles: [], 
      error: 'Failed to fetch news' 
    }, { status: 500 });
  }
}
