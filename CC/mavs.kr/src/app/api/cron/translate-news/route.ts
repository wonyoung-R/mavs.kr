// src/app/api/cron/translate-news/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { translateUntranslatedNews } from '@/lib/services/news-prisma-service';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting translation job...');
    const result = await translateUntranslatedNews(5);
    console.log(`[Cron] Done: ${result.translated} translated, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
