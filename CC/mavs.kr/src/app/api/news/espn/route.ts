import { NextRequest, NextResponse } from 'next/server';
import { NewsArticle } from '@/types/news';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news';
const MAVS_TEAM_ID = '6'; // Dallas Mavericks team ID

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const response = await fetch(`${ESPN_BASE_URL}?team=${MAVS_TEAM_ID}&limit=${limit}`, {
      headers: {
        'User-Agent': 'MAVS.KR News Bot 1.0'
      },
      next: { revalidate: 300 } // 5분 캐시
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();

    const articles: NewsArticle[] = data.articles?.map((article: any) => ({
      id: article.dataSourceIdentifier || article.id,
      title: article.headline,
      description: article.description,
      url: article.links?.web?.href || article.links?.mobile?.href,
      image: article.images?.[0]?.url,
      published: article.published || new Date().toISOString(),
      source: 'ESPN',
      author: article.byline,
      categories: article.categories?.map((c: any) => c.description) || []
    })) || [];

    return NextResponse.json({
      articles,
      total: articles.length,
      source: 'ESPN',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('ESPN API Error:', error);
    return NextResponse.json({
      articles: [],
      error: 'Failed to fetch ESPN news',
      source: 'ESPN'
    }, { status: 500 });
  }
}
