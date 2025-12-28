// src/app/api/games/sync-season/route.ts
// ESPN 스코어보드 API를 날짜별로 조회하여 이전 시즌 데이터 수집
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface ESPNEvent {
  id: string;
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
      };
      score?: string;
      homeAway: 'home' | 'away';
      winner?: boolean;
    }>;
    status: {
      type: {
        name: string;
        completed: boolean;
      };
    };
  }>;
}

// 날짜를 YYYYMMDD 형식으로 변환
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// 시즌 기간 계산 (예: "2023-24" -> 2023-10-01 ~ 2024-06-30)
function getSeasonDateRange(season: string): { start: Date; end: Date } {
  const [startYear, endYearShort] = season.split('-');
  const endYear = endYearShort.length === 2 ? `20${endYearShort}` : endYearShort;

  return {
    start: new Date(`${startYear}-10-01`),
    end: new Date(`${endYear}-06-30`),
  };
}

// 딜레이 함수
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const season = searchParams.get('season'); // 예: "2023-24"
  const batchSize = parseInt(searchParams.get('batch') || '30'); // 한 번에 처리할 날짜 수
  const startFrom = searchParams.get('startFrom'); // 재시작 지점 (YYYYMMDD)

  if (!season) {
    return NextResponse.json({
      success: false,
      error: 'Season parameter required (e.g., ?season=2023-24)',
    }, { status: 400 });
  }

  try {
    console.log(`🔄 Starting season sync for ${season}...`);

    const { start, end } = getSeasonDateRange(season);
    let currentDate = startFrom ? new Date(
      `${startFrom.slice(0, 4)}-${startFrom.slice(4, 6)}-${startFrom.slice(6, 8)}`
    ) : start;

    let totalGamesFound = 0;
    let totalGamesSynced = 0;
    let daysProcessed = 0;
    let errors: string[] = [];

    // 배치 크기만큼 날짜 순회
    while (currentDate <= end && daysProcessed < batchSize) {
      const dateStr = formatDate(currentDate);

      try {
        // ESPN 스코어보드 API 호출
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`,
          { next: { revalidate: 0 } }
        );

        if (!response.ok) {
          errors.push(`Failed to fetch ${dateStr}: ${response.status}`);
          currentDate.setDate(currentDate.getDate() + 1);
          daysProcessed++;
          continue;
        }

        const data = await response.json();
        const events: ESPNEvent[] = data.events || [];

        // 매버릭스 경기 필터링 (팀 ID = 6)
        const mavsGames = events.filter(event => {
          const competition = event.competitions[0];
          return competition.competitors.some(c => c.team.id === '6');
        });

        if (mavsGames.length > 0) {
          totalGamesFound += mavsGames.length;

          for (const game of mavsGames) {
            try {
              const competition = game.competitions[0];
              const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
              const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

              if (!homeCompetitor || !awayCompetitor) continue;

              // 경기가 완료된 경우만 저장
              if (!competition.status.type.completed) continue;

              const homeTeam = homeCompetitor.team.displayName ||
                              homeCompetitor.team.name ||
                              homeCompetitor.team.shortDisplayName ||
                              homeCompetitor.team.abbreviation;
              const awayTeam = awayCompetitor.team.displayName ||
                              awayCompetitor.team.name ||
                              awayCompetitor.team.shortDisplayName ||
                              awayCompetitor.team.abbreviation;

              const homeScore = homeCompetitor.score ? parseInt(homeCompetitor.score) : null;
              const awayScore = awayCompetitor.score ? parseInt(awayCompetitor.score) : null;

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

              totalGamesSynced++;
              console.log(`✅ ${dateStr}: ${awayTeam} @ ${homeTeam} (${awayScore}-${homeScore})`);
            } catch (gameError) {
              errors.push(`Failed to sync game ${game.id}: ${gameError}`);
            }
          }
        }

        // Rate limiting - ESPN API 부하 방지
        await delay(200); // 200ms 딜레이

      } catch (dayError) {
        errors.push(`Error on ${dateStr}: ${dayError}`);
      }

      currentDate.setDate(currentDate.getDate() + 1);
      daysProcessed++;
    }

    // 다음 배치 시작점 계산
    const nextStartFrom = currentDate <= end ? formatDate(currentDate) : null;
    const isComplete = currentDate > end;

    console.log(`✅ Batch complete: ${totalGamesSynced} games synced, ${daysProcessed} days processed`);

    return NextResponse.json({
      success: true,
      data: {
        season,
        daysProcessed,
        totalGamesFound,
        totalGamesSynced,
        isComplete,
        nextStartFrom,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // 처음 5개 에러만
      },
      message: isComplete
        ? `Season ${season} sync completed! ${totalGamesSynced} games synced.`
        : `Batch completed. Continue with ?season=${season}&startFrom=${nextStartFrom}`,
    });

  } catch (error) {
    console.error('❌ Season sync failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to sync season',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

