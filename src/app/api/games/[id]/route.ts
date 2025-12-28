// src/app/api/games/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface ESPNAthlete {
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
    headshot?: {
      href: string;
    };
    jersey?: string;
    position?: {
      abbreviation: string;
    };
  };
  starter: boolean;
  stats: string[];
}

interface ESPNTeamBoxscore {
  team: {
    id: string;
    displayName: string;
    abbreviation: string;
    logo: string;
  };
  statistics: Array<{
    name: string;
    labels: string[];
    athletes: ESPNAthlete[];
    totals: string[];
  }>;
}

interface ESPNTeamStats {
  team: {
    id: string;
    displayName: string;
    abbreviation: string;
  };
  statistics: Array<{
    name: string;
    displayValue: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // DB에서 경기 정보 조회
    const game = await prisma.game.findFirst({
      where: {
        OR: [
          { id },
          { gameId: id },
          { gameId: `ESPN-${id}` },
        ],
      },
    });

    if (!game) {
      return NextResponse.json({
        success: false,
        error: 'Game not found',
      }, { status: 404 });
    }

    // ESPN 게임 ID 추출 (ESPN-401810270 -> 401810270)
    const espnGameId = game.gameId.replace('ESPN-', '');

    // ESPN Summary API에서 상세 정보 가져오기
    let boxscore = null;
    let leaders = null;
    let gameInfo = null;

    try {
      const summaryResponse = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`,
        { next: { revalidate: 3600 } } // 1시간 캐시
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();

        // 박스스코어 파싱
        if (summaryData.boxscore) {
          const players: ESPNTeamBoxscore[] = summaryData.boxscore.players || [];
          const teams: ESPNTeamStats[] = summaryData.boxscore.teams || [];

          boxscore = {
            teams: players.map((teamData, index) => {
              const teamStats = teams[index];
              const statistics = teamData.statistics[0];

              return {
                team: {
                  id: teamData.team?.id,
                  name: teamData.team?.displayName,
                  abbreviation: teamData.team?.abbreviation,
                  logo: teamData.team?.logo,
                },
                labels: statistics?.labels || [],
                players: (statistics?.athletes || []).map((athlete) => ({
                  id: athlete.athlete?.id,
                  name: athlete.athlete?.displayName,
                  shortName: athlete.athlete?.shortName,
                  headshot: athlete.athlete?.headshot?.href,
                  jersey: athlete.athlete?.jersey,
                  position: athlete.athlete?.position?.abbreviation,
                  starter: athlete.starter,
                  stats: athlete.stats,
                })),
                totals: statistics?.totals || [],
                teamStats: (teamStats?.statistics || []).map((stat) => ({
                  name: stat.name,
                  value: stat.displayValue,
                })),
              };
            }),
          };
        }

        // 리더스 (득점, 리바운드, 어시스트 리더)
        // ESPN API 구조: leaders[팀][leaders][카테고리][leaders][선수]
        if (summaryData.leaders && Array.isArray(summaryData.leaders)) {
          const leaderCategories: { [key: string]: any[] } = {};

          // 팀별로 순회
          for (const teamData of summaryData.leaders) {
            const teamName = teamData.team?.displayName || 'Unknown Team';

            // 각 팀의 리더 카테고리 순회 (points, assists, rebounds)
            if (teamData.leaders && Array.isArray(teamData.leaders)) {
              for (const category of teamData.leaders) {
                const categoryName = category.name;
                const displayName = category.displayName;

                if (!leaderCategories[categoryName]) {
                  leaderCategories[categoryName] = [];
                }

                // 해당 카테고리의 리더들
                if (category.leaders && Array.isArray(category.leaders)) {
                  for (const leader of category.leaders) {
                    leaderCategories[categoryName].push({
                      team: teamName,
                      athlete: {
                        name: leader.athlete?.displayName || leader.athlete?.fullName,
                        headshot: leader.athlete?.headshot?.href,
                      },
                      value: leader.displayValue || leader.mainStat?.value,
                      displayName,
                    });
                  }
                }
              }
            }
          }

          // 카테고리별로 정리 (points, rebounds, assists 순)
          const categoryOrder = ['points', 'rebounds', 'assists'];
          leaders = categoryOrder
            .filter(cat => leaderCategories[cat])
            .map(cat => ({
              name: cat,
              displayName: leaderCategories[cat][0]?.displayName || cat,
              leaders: leaderCategories[cat],
            }));
        }

        // 경기 정보 (경기장, 관중 수 등)
        if (summaryData.gameInfo) {
          gameInfo = {
            venue: summaryData.gameInfo.venue?.fullName,
            attendance: summaryData.gameInfo.attendance,
          };
        }
      }
    } catch (espnError) {
      console.error('ESPN API error:', espnError);
      // ESPN API 실패해도 DB 데이터는 반환
    }

    return NextResponse.json({
      success: true,
      data: {
        game: {
          id: game.id,
          gameId: game.gameId,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          status: game.status,
          scheduledAt: game.scheduledAt.toISOString(),
          quarter: game.quarter,
        },
        boxscore,
        leaders,
        gameInfo,
      },
    });

  } catch (error) {
    console.error('Error fetching game details:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch game details',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

