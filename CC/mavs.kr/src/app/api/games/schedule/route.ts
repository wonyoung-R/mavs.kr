// src/app/api/games/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { nbaApiClient } from '@/lib/api/nba-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    // Get upcoming games
    const upcomingGames = await nbaApiClient.getUpcomingGames();

    // Filter for the next N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const filteredGames = upcomingGames.filter(game =>
      game.scheduledAt <= cutoffDate
    );

    return NextResponse.json({
      success: true,
      data: filteredGames,
      message: 'Schedule retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch schedule',
        message: 'Unable to retrieve game schedule',
      },
      { status: 500 }
    );
  }
}

