// src/app/api/cron/crawl-news/route.ts
// Cron endpoint for automated news crawling with translation
// Call this from Vercel Cron, GitHub Actions, or external scheduler

import { NextResponse } from 'next/server';
import { saveNewsToSupabase } from '@/lib/services/news-service';
import { translateAndUpdateNews } from '@/lib/services/news-translation-service';
import { NewsArticle } from '@/types/news';

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

    // Fetch from all news sources
    const sources = [
      { name: 'espn', endpoint: `${baseUrl}/api/news/espn?limit=10` },
      { name: 'mmb', endpoint: `${baseUrl}/api/news/mavsmoneyball?limit=10` },
      { name: 'tsc', endpoint: `${baseUrl}/api/news/smoking-cuban?limit=10` },
      { name: 'naver', endpoint: `${baseUrl}/api/news/naver?limit=10` },
    ];

    const allArticles: Partial<NewsArticle>[] = [];

    for (const source of sources) {
      try {
        const response = await fetch(source.endpoint);
        const data = await response.json();

        if (data.articles) {
          allArticles.push(...data.articles);
          console.log(`✅ ${source.name}: ${data.articles.length} articles`);
        }
      } catch (err) {
        console.error(`❌ Failed to fetch ${source.name}:`, err);
      }
    }

    // Save to Supabase
    const saveResult = await saveNewsToSupabase(allArticles);
    console.log(`💾 Saved: ${saveResult.saved}, Errors: ${saveResult.errors}`);

    // Translate untranslated news
    const translateResult = await translateAndUpdateNews();
    console.log(`🌐 Translated: ${translateResult.translated}, Errors: ${translateResult.errors}`);

    console.log('🕐 Cron job complete');

    return NextResponse.json({
      success: true,
      message: 'News crawl and translation completed',
      result: {
        crawl: {
          total: allArticles.length,
          saved: saveResult.saved,
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
