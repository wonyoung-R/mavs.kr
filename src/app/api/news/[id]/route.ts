// src/app/api/news/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getNewsById, incrementViewCount } from '@/lib/services/news-prisma-service';

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const news = await getNewsById(id);

    if (!news) {
      return NextResponse.json({ success: false, error: 'News not found' }, { status: 404 });
    }

    incrementViewCount(id).catch(console.error);

    return NextResponse.json({
      success: true,
      article: {
        id: news.id,
        title: news.title,
        titleKr: news.titleKr,
        content: news.content,
        contentKr: news.contentKr,
        source: news.source,
        sourceUrl: news.sourceUrl,
        author: news.author,
        imageUrl: news.imageUrl,
        publishedAt: news.publishedAt.toISOString(),
        viewCount: news.viewCount + 1,
        isTranslated: !!news.titleKr,
      },
    });
  } catch (error) {
    console.error('[News Detail] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch news' }, { status: 500 });
  }
}

