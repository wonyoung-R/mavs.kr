import { NextResponse } from 'next/server';

interface TeamStanding {
  team: string;
  teamId: string;
  logo: string;
  wins: number;
  losses: number;
  win_percentage: number;
  conference_rank: number;
  conference: 'Eastern' | 'Western';
  games_behind: string;
  streak: string;
}

export async function GET() {
  try {
    // ESPN API에서 NBA 순위 데이터 가져오기
    const response = await fetch(
      'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings',
      { next: { revalidate: 3600 } } // 1시간 캐시
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ESPN standings: ${response.statusText}`);
    }

    const data = await response.json();
    
    const westernStandings: TeamStanding[] = [];
    const easternStandings: TeamStanding[] = [];

    // ESPN 데이터 파싱
    if (data.children) {
      for (const conference of data.children) {
        const confName = conference.name?.includes('Eastern') ? 'Eastern' : 'Western';
        const standings = conference.standings?.entries || [];

        for (const entry of standings) {
          const team = entry.team;
          const stats = entry.stats || [];
          
          const getStatValue = (name: string) => {
            const stat = stats.find((s: any) => s.name === name);
            return stat?.value ?? stat?.displayValue ?? 0;
          };

          const standing: TeamStanding = {
            team: team?.displayName || team?.name || 'Unknown',
            teamId: team?.id || '',
            logo: team?.logos?.[0]?.href || '',
            wins: parseInt(getStatValue('wins')) || 0,
            losses: parseInt(getStatValue('losses')) || 0,
            win_percentage: parseFloat(getStatValue('winPercent')) || 0,
            conference_rank: parseInt(getStatValue('playoffSeed')) || 0,
            conference: confName,
            games_behind: getStatValue('gamesBehind')?.toString() || '-',
            streak: getStatValue('streak') || '-',
          };

          if (confName === 'Eastern') {
            easternStandings.push(standing);
          } else {
            westernStandings.push(standing);
          }
        }
      }
    }

    // 순위로 정렬
    westernStandings.sort((a, b) => a.conference_rank - b.conference_rank);
    easternStandings.sort((a, b) => a.conference_rank - b.conference_rank);

    return NextResponse.json({
      success: true,
      data: {
        western_standings: westernStandings,
        eastern_standings: easternStandings,
      },
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching NBA standings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch standings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
