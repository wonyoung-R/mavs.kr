// src/app/api/cron/update-box-scores/route.ts
// 박스스코어 업데이트 Cron: 매일 오전 6시 실행

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { nbaApiClient } from '@/lib/api/nba-client';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    console.log(`🕐 Box scores cron started at ${now.toISOString()}`);
    console.log('Starting scheduled game update...');

    // Fetch live games from NBA API
    const games = await nbaApiClient.getLiveGames();

    // Filter Mavericks games
    const mavsGames = games.filter(
      game => game.homeTeam === 'Dallas Mavericks' || game.awayTeam === 'Dallas Mavericks'
    );

    let updatedCount = 0;

    for (const game of mavsGames) {
      try {
        // Update or create game in database
        await prisma.game.upsert({
          where: {
            gameId: game.gameId,
          },
          update: {
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            status: game.status,
            quarter: game.quarter,
            timeRemaining: game.timeRemaining,
            updatedAt: new Date(),
          },
          create: {
            gameId: game.gameId,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            status: game.status,
            scheduledAt: game.scheduledAt,
            quarter: game.quarter,
            timeRemaining: game.timeRemaining,
            broadcasts: game.broadcasts,
            stats: game.stats as any,
            highlights: game.highlights,
          },
        });
        updatedCount++;
      } catch (error) {
        console.error('Failed to update game:', game.gameId, error);
      }
    }

    console.log(`✅ Box scores updated: ${updatedCount} games`);

    return NextResponse.json({
      success: true,
      executedAt: now.toISOString(),
      task: 'box_scores_update',
      data: {
        gamesFound: mavsGames.length,
        updated: updatedCount,
      },
    });
  } catch (error) {
    console.error('❌ Box scores cron error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      message: 'Scheduled game update failed',
    }, { status: 500 });
  }
}
