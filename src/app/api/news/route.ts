// src/app/api/news/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NewsSource } from '@prisma/client';
import { getNews, getNewsCount } from '@/lib/services/news-prisma-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sourceParam = searchParams.get('source');
    const onlyTranslated = searchParams.get('onlyTranslated') === 'true';

    // source 파라미터 검증
    let source: NewsSource | undefined;
    if (sourceParam && Object.values(NewsSource).includes(sourceParam as NewsSource)) {
      source = sourceParam as NewsSource;
    }

    const [news, total] = await Promise.all([
      getNews({ limit, offset, source, onlyTranslated }),
      getNewsCount({ source, onlyTranslated }),
    ]);

    const articles = news.map((item) => ({
      id: item.id,
      title: item.title,
      titleKr: item.titleKr,
      content: item.content,
      contentKr: item.contentKr,
      source: item.source,
      sourceUrl: item.sourceUrl,
      author: item.author,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt.toISOString(),
      viewCount: item.viewCount,
      isTranslated: !!item.titleKr,
    }));

    return NextResponse.json({
      success: true,
      articles,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error('[News API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch news' }, { status: 500 });
  }
}

