// src/app/api/news/espn/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NewsSource } from '@prisma/client';
import { saveNewsMany, getNews } from '@/lib/services/news-prisma-service';

const ESPN_API_URL = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news';
const MAVS_TEAM_ID = '6';

interface ESPNArticle {
  id: string;
  headline: string;
  description?: string;
  published?: string;
  byline?: string;
  links?: { web?: { href: string }; mobile?: { href: string } };
  images?: Array<{ url: string }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const skipFetch = searchParams.get('skipFetch') === 'true';

    let fetchResult = { saved: 0, updated: 0, errors: 0 };

    if (!skipFetch) {
      console.log('[ESPN] Fetching from API...');
      const response = await fetch(`${ESPN_API_URL}?team=${MAVS_TEAM_ID}&limit=${limit}`, {
        next: { revalidate: 0 },
        headers: { 'User-Agent': 'MAVS.KR/1.0' },
      });

      if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);

      const data = await response.json();
      const espnArticles: ESPNArticle[] = data.articles || [];
      console.log(`[ESPN] Got ${espnArticles.length} articles`);

      const articlesToSave = espnArticles.map((article) => ({
        title: article.headline,
        content: article.description || '',
        source: 'ESPN' as NewsSource,
        sourceUrl: article.links?.web?.href || article.links?.mobile?.href || '',
        author: article.byline || 'ESPN Staff',
        imageUrl: article.images?.[0]?.url,
        publishedAt: new Date(article.published || Date.now()),
      }));

      fetchResult = await saveNewsMany(articlesToSave);
      console.log(`[ESPN] Saved: ${fetchResult.saved} new, ${fetchResult.updated} updated`);
    }

    const news = await getNews({ source: 'ESPN' as NewsSource, limit, orderBy: 'publishedAt' });

    const articles = news.map((item) => ({
      id: item.id,
      title: item.title,
      titleKr: item.titleKr || null,
      description: item.content,
      contentKr: item.contentKr || null,
      url: item.sourceUrl,
      image: item.imageUrl,
      published: item.publishedAt.toISOString(),
      source: item.source,
      author: item.author,
      isTranslated: !!item.titleKr,
    }));

    return NextResponse.json({ success: true, articles, total: articles.length, fetched: fetchResult });
  } catch (error) {
    console.error('[ESPN] Error:', error);
    return NextResponse.json({ success: false, error: String(error), articles: [] }, { status: 500 });
  }
}
