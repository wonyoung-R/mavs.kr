// src/app/api/games/live/route.ts
import { NextResponse } from 'next/server';
import { nbaApiClient } from '@/lib/api/nba-client';
// import { prisma } from '@/lib/db/prisma';
// import { Game } from '@/types/game';

export async function GET() {
  try {
    // Get live games from NBA API
    const liveGames = await nbaApiClient.getLiveGames();

    // Filter for Mavericks games
    const mavsGames = liveGames.filter(
      game => game.homeTeam === 'Dallas Mavericks' || game.awayTeam === 'Dallas Mavericks'
    );

    // If no live games, check for recent games
    if (mavsGames.length === 0) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const recentGames = await nbaApiClient.getGames(
        yesterday.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );

      const recentMavsGames = recentGames.filter(
        game => game.homeTeam === 'Dallas Mavericks' || game.awayTeam === 'Dallas Mavericks'
      );

      return NextResponse.json({
        success: true,
        data: recentMavsGames.slice(0, 1), // Return most recent game
        message: 'No live games, showing recent game',
      });
    }

    return NextResponse.json({
      success: true,
      data: mavsGames,
      message: 'Live games retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching live games:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch live games',
        message: 'Unable to retrieve live game data',
      },
      { status: 500 }
    );
  }
}

