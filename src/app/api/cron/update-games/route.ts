// src/app/api/cron/update-games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { nbaApiClient } from '@/lib/api/nba-client';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting scheduled game update...');

    // Get today's games
    const today = new Date().toISOString().split('T')[0];
    const games = await nbaApiClient.getGames(today, today);

    // Filter for Mavericks games
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

    console.log(`Game update completed: ${updatedCount} games updated`);

    return NextResponse.json({
      success: true,
      data: {
        gamesFound: mavsGames.length,
        updated: updatedCount,
      },
      message: 'Scheduled game update completed successfully',
    });
  } catch (error) {
    console.error('Error in scheduled game update:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update games',
        message: 'Scheduled game update failed',
      },
      { status: 500 }
    );
  }
}

