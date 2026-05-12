// src/app/api/cron/crawl-news/route.ts
// Cron endpoint for automated news crawling with translation
// Call this from Vercel Cron, GitHub Actions, or external scheduler

import { NextResponse } from 'next/server';
import { saveNewsMany, translateUntranslatedNews, NewsArticleInput } from '@/lib/services/news-prisma-service';
import { NewsSource } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 120 seconds timeout (for translation)

export async function GET(request: Request) {
  // Verify cron secret (optional security) - 로컬 개발 환경에서는 체크 건너뛰기
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isDevelopment) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('🕐 Cron job started: crawl-news');

  try {
    // baseUrl: request URL에서 추출 (production/dev 모두 동작)
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    console.log(`🔧 Using baseUrl: ${baseUrl}`);

    // Fetch from all news sources
    const sources = [
      { name: 'espn', endpoint: `${baseUrl}/api/news/espn?limit=10` },
      { name: 'mmb', endpoint: `${baseUrl}/api/news/mavsmoneyball?limit=10` },
      { name: 'tsc', endpoint: `${baseUrl}/api/news/smoking-cuban?limit=10` },
    ];

    const allArticles: NewsArticleInput[] = [];

    for (const source of sources) {
      try {
        console.log(`📥 Fetching from ${source.name}...`);
        const response = await fetch(source.endpoint, {
          headers: { 'Accept': 'application/json' }
        });

        // 응답 상태 확인
        if (!response.ok) {
          console.error(`❌ ${source.name} HTTP error: ${response.status}`);
          continue;
        }

        // 응답 타입 확인
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error(`❌ ${source.name} returned non-JSON: ${text.substring(0, 100)}...`);
          continue;
        }

        const data = await response.json();

        if (data.articles && Array.isArray(data.articles)) {
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
        } else {
          console.log(`⚠️ ${source.name}: No articles found in response`);
        }
      } catch (err) {
        console.error(`❌ Failed to fetch ${source.name}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // Save to database via Prisma
    let saveResult = { saved: 0, updated: 0, errors: 0 };
    let translateResult = { translated: 0, errors: 0 };

    if (allArticles.length > 0) {
      try {
        saveResult = await saveNewsMany(allArticles);
        console.log(`💾 Saved: ${saveResult.saved}, Updated: ${saveResult.updated}, Errors: ${saveResult.errors}`);
      } catch (err) {
        console.error('❌ Failed to save articles:', err instanceof Error ? err.message : String(err));
      }

      // Translate untranslated news (limit to 3 to avoid rate limits)
      try {
        translateResult = await translateUntranslatedNews(3);
        console.log(`🌐 Translated: ${translateResult.translated}, Errors: ${translateResult.errors}`);
      } catch (err) {
        console.error('❌ Failed to translate:', err instanceof Error ? err.message : String(err));
      }
    } else {
      console.log('⚠️ No articles to save');
    }

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

// POST 메서드도 지원 (admin 페이지에서 호출)
export async function POST(request: Request) {
  return GET(request);
}
