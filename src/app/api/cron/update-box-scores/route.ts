// src/app/api/cron/update-box-scores/route.ts
// 박스스코어 업데이트 Cron: 매일 오전 6시 실행
// ESPN API를 사용하여 오늘의 매버릭스 경기 점수 업데이트

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { GameStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface ESPNGame {
  id: string;
  name: string;
  competitions: Array<{
    id: string;
    date: string;
    competitors: Array<{
      id: string;
      team: {
        id: string;
        name: string;
        abbreviation: string;
      };
      score?: string;
      homeAway: 'home' | 'away';
    }>;
    status: {
      type: {
        name: string;
        completed: boolean;
      };
      displayClock?: string;
      period?: number;
    };
  }>;
}

export async function GET(request: NextRequest) {
  try {
    // 로컬 개발 환경에서는 인증 체크 건너뛰기
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment) {
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET;

      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date();
    console.log(`🕐 Box scores cron started at ${now.toISOString()}`);
    console.log('Fetching today\'s games from ESPN API...');

    // ESPN API에서 오늘의 NBA 점수 가져오기
    const scoreboardResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');

    if (!scoreboardResponse.ok) {
      throw new Error(`ESPN Scoreboard API error: ${scoreboardResponse.status}`);
    }

    const scoreboardData = await scoreboardResponse.json();
    const games: ESPNGame[] = scoreboardData.events || [];

    console.log(`Found ${games.length} games today from ESPN`);

    // 매버릭스 경기만 필터링 (팀 ID = 6)
    const mavsGames = games.filter((game) => {
      const competition = game.competitions[0];
      return competition.competitors.some(comp => comp.team.id === '6');
    });

    console.log(`Found ${mavsGames.length} Mavericks games`);

    let updatedCount = 0;

    for (const game of mavsGames) {
      try {
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(comp => comp.homeAway === 'home');
        const awayTeam = competition.competitors.find(comp => comp.homeAway === 'away');

        if (!homeTeam || !awayTeam) {
          console.warn(`Skipping game ${game.id}: missing team data`);
          continue;
        }

        // 상태 변환
        let status: GameStatus = GameStatus.SCHEDULED;
        if (competition.status.type.completed) {
          status = GameStatus.FINAL;
        } else if (competition.status.type.name === 'STATUS_IN_PROGRESS') {
          status = GameStatus.LIVE;
        }

        // 점수 파싱
        const homeScore = homeTeam.score ? parseInt(homeTeam.score) : null;
        const awayScore = awayTeam.score ? parseInt(awayTeam.score) : null;

        // DB에 저장/업데이트
        await prisma.game.upsert({
          where: {
            gameId: `ESPN-${game.id}`,
          },
          update: {
            homeScore,
            awayScore,
            status,
            quarter: competition.status.period,
            timeRemaining: competition.status.displayClock,
            updatedAt: new Date(),
          },
          create: {
            gameId: `ESPN-${game.id}`,
            homeTeam: homeTeam.team.name,
            awayTeam: awayTeam.team.name,
            homeScore,
            awayScore,
            status,
            scheduledAt: new Date(competition.date),
            quarter: competition.status.period,
            timeRemaining: competition.status.displayClock,
            broadcasts: [],
            highlights: [],
          },
        });

        updatedCount++;
        console.log(`✅ Updated game: ${homeTeam.team.abbreviation} vs ${awayTeam.team.abbreviation} (${status})`);
      } catch (error) {
        console.error(`Failed to update game ${game.id}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`✅ Box scores updated: ${updatedCount}/${mavsGames.length} games`);

    return NextResponse.json({
      success: true,
      executedAt: now.toISOString(),
      task: 'box_scores_update',
      data: {
        totalGamesToday: games.length,
        mavsGamesFound: mavsGames.length,
        updated: updatedCount,
      },
    });
  } catch (error) {
    console.error('❌ Box scores cron error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Scheduled game update failed',
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
