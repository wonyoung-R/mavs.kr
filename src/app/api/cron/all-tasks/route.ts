// src/app/api/cron/update-box-scores/route.ts
// 박스스코어 업데이트 Cron: 5분마다 실행

import { NextResponse } from 'next/server';
import { updateBoxScores } from '@/lib/api/nba-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  console.log(`🕐 Box scores cron started at ${now.toISOString()}`);

  try {
    const result = await updateBoxScores();
    console.log('✅ Box scores updated');

    return NextResponse.json({
      success: true,
      executedAt: now.toISOString(),
      task: 'box_scores_update',
      result,
    });
  } catch (error) {
    console.error('❌ Box scores cron error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      executedAt: now.toISOString(),
    }, { status: 500 });
  }
}
