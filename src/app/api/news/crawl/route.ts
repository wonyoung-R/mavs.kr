import { NextRequest, NextResponse } from 'next/server';

// This endpoint is deprecated. Use /api/cron/crawl-news instead.
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Use /api/cron/crawl-news instead' },
    { status: 410 }
  );
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Use /api/cron/crawl-news instead' },
    { status: 410 }
  );
}
