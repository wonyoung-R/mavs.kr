// src/app/api/cron/crawl-news/route.ts
// Cron endpoint for automated news crawling with translation
// Call this from Vercel Cron, GitHub Actions, or external scheduler

import { NextResponse } from 'next/server';
import { saveNewsMany, translateUntranslatedNews, NewsArticleInput } from '@/lib/services/news-prisma-service';
import { NewsSource } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 120 seconds timeout (for translation)

export async function GET(request: Request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🕐 Cron job started: crawl-news');

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Fetch from all news sources
    const sources = [
      { name: 'espn', endpoint: `${baseUrl}/api/news/espn?limit=10` },
      { name: 'mmb', endpoint: `${baseUrl}/api/news/mavsmoneyball?limit=10` },
      { name: 'tsc', endpoint: `${baseUrl}/api/news/smoking-cuban?limit=10` },
    ];

    const allArticles: NewsArticleInput[] = [];

    for (const source of sources) {
      try {
        const response = await fetch(source.endpoint);
        const data = await response.json();

        if (data.articles) {
          // Transform API response to NewsArticleInput format
          const transformed = data.articles.map((a: any) => ({
            title: a.title,
            content: a.description || a.content || '',
            source: (a.source?.toUpperCase().replace(/ /g, '_') || 'ESPN') as NewsSource,
            sourceUrl: a.url || a.sourceUrl || '',
            author: a.author,
            imageUrl: a.image || a.imageUrl,
            publishedAt: new Date(a.published || a.publishedAt || Date.now()),
          }));
          allArticles.push(...transformed);
          console.log(`✅ ${source.name}: ${data.articles.length} articles`);
        }
      } catch (err) {
        console.error(`❌ Failed to fetch ${source.name}:`, err);
      }
    }

    // Save to database via Prisma
    const saveResult = await saveNewsMany(allArticles);
    console.log(`💾 Saved: ${saveResult.saved}, Updated: ${saveResult.updated}, Errors: ${saveResult.errors}`);

    // Translate untranslated news (limit to 3 to avoid rate limits)
    const translateResult = await translateUntranslatedNews(3);
    console.log(`🌐 Translated: ${translateResult.translated}, Errors: ${translateResult.errors}`);

    console.log('🕐 Cron job complete');

    return NextResponse.json({
      success: true,
      message: 'News crawl and translation completed',
      result: {
        crawl: {
          total: allArticles.length,
          saved: saveResult.saved,
          updated: saveResult.updated,
          errors: saveResult.errors,
        },
        translation: {
          translated: translateResult.translated,
          errors: translateResult.errors,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({
      success: false,
      error: 'Crawl failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
