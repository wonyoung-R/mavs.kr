// src/app/api/cron/all-tasks/route.ts
// 통합 Cron: 5분마다 실행, 3시간마다 뉴스 크롤링 추가

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  
  console.log(`🕐 Cron job started at ${now.toISOString()}`);
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mavs.kr';
  const results: Record<string, any> = {};

  try {
    // 1. 박스스코어 업데이트 (매 5분마다 - 항상 실행)
    console.log('🏀 Updating box scores...');
    try {
      const boxRes = await fetch(`${baseUrl}/api/cron/update-box-scores`, {
        headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
      });
      results.boxScores = await boxRes.json();
      console.log('✅ Box scores updated');
    } catch (err) {
      console.error('❌ Box scores error:', err);
      results.boxScores = { error: String(err) };
    }

    // 2. 뉴스 크롤링 (3시간마다 - 00분일 때만, 0/3/6/9/12/15/18/21시)
    const shouldCrawlNews = currentMinute < 5 && currentHour % 3 === 0;
    
    if (shouldCrawlNews) {
      console.log('📰 Crawling news (3-hour interval)...');
      try {
        const newsRes = await fetch(`${baseUrl}/api/cron/crawl-news`, {
          headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
        });
        results.news = await newsRes.json();
        console.log('✅ News crawled');
      } catch (err) {
        console.error('❌ News crawl error:', err);
        results.news = { error: String(err) };
      }
    } else {
      results.news = { skipped: true, reason: 'Not a 3-hour interval' };
    }

    console.log('🕐 Cron job completed');

    return NextResponse.json({
      success: true,
      executedAt: now.toISOString(),
      tasks: {
        boxScores: 'always',
        newsCrawl: shouldCrawlNews ? 'executed' : 'skipped',
      },
      results,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      results,
    }, { status: 500 });
  }
}
