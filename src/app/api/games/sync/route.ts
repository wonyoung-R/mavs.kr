// src/app/api/games/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  competitions: Array<{
    id: string;
    date: string;
    competitors: Array<{
      id: string;
      team: {
        id: string;
        name?: string;
        displayName?: string;
        shortDisplayName?: string;
        abbreviation: string;
        location?: string;
      };
      score?: {
        value?: number;
        displayValue?: string;
      };
      homeAway: 'home' | 'away';
      winner?: boolean;
    }>;
    status: {
      type: {
        name: string;
        completed: boolean;
      };
      displayClock?: string;
      period?: number;
    };
    venue?: {
      fullName: string;
    };
  }>;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Starting game sync from ESPN API...');

    // ESPN 매버릭스 팀 스케줄 API 호출
    const scheduleResponse = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/6/schedule',
      { next: { revalidate: 0 } }
    );

    if (!scheduleResponse.ok) {
      throw new Error(`ESPN API error: ${scheduleResponse.status}`);
    }

    const scheduleData = await scheduleResponse.json();
    const games: ESPNGame[] = scheduleData.events || [];

    console.log(`📊 Found ${games.length} total games from ESPN`);

    // 완료된 경기만 필터링
    const finishedGames = games.filter((game) => {
      const competition = game.competitions[0];
      return competition.status.type.completed === true;
    });

    console.log(`✅ Found ${finishedGames.length} finished games`);

    let syncedCount = 0;
    let errorCount = 0;

    for (const game of finishedGames) {
      try {
        const competition = game.competitions[0];
        const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
        const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

        if (!homeCompetitor || !awayCompetitor) {
          console.warn(`⚠️ Skipping game ${game.id}: missing competitor data`);
          continue;
        }

        // 점수 추출
        let homeScore: number | null = null;
        let awayScore: number | null = null;

        if (homeCompetitor.score) {
          homeScore = homeCompetitor.score.value ??
            (homeCompetitor.score.displayValue ? parseInt(homeCompetitor.score.displayValue) : null);
        }
        if (awayCompetitor.score) {
          awayScore = awayCompetitor.score.value ??
            (awayCompetitor.score.displayValue ? parseInt(awayCompetitor.score.displayValue) : null);
        }

        // 팀 이름 추출 (displayName이 우선, 없으면 다른 필드 사용)
        const homeTeam = homeCompetitor.team.displayName ||
                         homeCompetitor.team.name ||
                         homeCompetitor.team.shortDisplayName ||
                         `${homeCompetitor.team.location} ${homeCompetitor.team.abbreviation}`;
        const awayTeam = awayCompetitor.team.displayName ||
                         awayCompetitor.team.name ||
                         awayCompetitor.team.shortDisplayName ||
                         `${awayCompetitor.team.location} ${awayCompetitor.team.abbreviation}`;

        // 유효성 검사
        if (!homeTeam || !awayTeam) {
          console.warn(`⚠️ Skipping game ${game.id}: invalid team names (home: ${homeTeam}, away: ${awayTeam})`);
          continue;
        }

        console.log(`📝 Processing: ${awayTeam} @ ${homeTeam}`);

        // DB에 upsert
        await prisma.game.upsert({
          where: {
            gameId: `ESPN-${game.id}`,
          },
          update: {
            homeScore,
            awayScore,
            status: 'FINAL',
            updatedAt: new Date(),
          },
          create: {
            gameId: `ESPN-${game.id}`,
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
            status: 'FINAL',
            scheduledAt: new Date(competition.date),
            quarter: 4,
            broadcasts: [],
            highlights: [],
          },
        });

        syncedCount++;
      } catch (error) {
        console.error(`❌ Failed to sync game ${game.id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Sync completed: ${syncedCount} games synced, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      data: {
        totalGames: games.length,
        finishedGames: finishedGames.length,
        syncedCount,
        errorCount,
      },
      message: `Successfully synced ${syncedCount} games to database`,
    });

  } catch (error) {
    console.error('❌ Game sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync games',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

