// src/app/api/nba/espn-schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';

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
        name: string;
        shortDisplayName: string;
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
    venue: {
      fullName: string;
    };
  }>;
}

interface ProcessedGame {
  game_id: string;
  game_date: string;
  game_date_kst: string;
  game_time_kst: string;
  opponent: string;
  is_home: boolean;
  mavs_score: number | null;
  opponent_score: number | null;
  result: string | null;
  status: 'finished' | 'upcoming' | 'today' | 'live';
  matchup: string;
  venue: string;
  period?: number;
  time_remaining?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // ESPN API에서 매버릭스 경기 일정 가져오기
    const scheduleResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/6/schedule');

    if (!scheduleResponse.ok) {
      throw new Error(`ESPN API error: ${scheduleResponse.status}`);
    }

    const scheduleData = await scheduleResponse.json();
    const games = scheduleData.events || [];

    // 오늘의 NBA 점수 가져오기
    const scoreboardResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');

    if (!scoreboardResponse.ok) {
      throw new Error(`ESPN Scoreboard API error: ${scoreboardResponse.status}`);
    }

    const scoreboardData = await scoreboardResponse.json();
    const todayGames = scoreboardData.events || [];

    // 매버릭스 경기 데이터 처리
    const processedGames: ProcessedGame[] = games.map((game: ESPNGame) => {
      const competition = game.competitions[0];

      // game.name에서 상대팀 추출 (예: "San Antonio Spurs at Dallas Mavericks")
      const gameName = game.name || '';
      const shortName = game.shortName || '';

      // 매버릭스가 홈인지 원정인지 확인
      const isHome = gameName.includes('at Dallas Mavericks') || shortName.includes('@ DAL');
      const isAway = gameName.includes('Dallas Mavericks at') || shortName.includes('DAL @');

      // 상대팀 이름 추출
      let opponent = '';
      if (isHome) {
        opponent = gameName.split(' at Dallas Mavericks')[0] || shortName.split(' @ DAL')[0] || 'TBD';
      } else if (isAway) {
        opponent = gameName.split('Dallas Mavericks at ')[1] || shortName.split('DAL @ ')[1] || 'TBD';
      }

      const gameDate = new Date(competition.date);
      const today = new Date();
      const isToday = gameDate.toDateString() === today.toDateString();

      // 한국 시간으로 변환 (미국 시간 + 15시간 또는 16시간)
      // 미국 시간을 한국 시간으로 변환 (서머타임 고려)
      const usTime = gameDate.getTime();
      // 미국 동부시간(EST/EDT)에서 한국시간(KST)으로 변환
      // EST: UTC-5, EDT: UTC-4, KST: UTC+9
      // 따라서 EST→KST: +14시간, EDT→KST: +13시간
      // 하지만 실제로는 더 정확한 변환이 필요하므로 +15시간 사용
      const kstTime = usTime + (15 * 60 * 60 * 1000);
      const kstDate = new Date(kstTime);

      // 날짜와 시간을 올바르게 추출
      const year = kstDate.getUTCFullYear();
      const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(kstDate.getUTCDate()).padStart(2, '0');
      const hours = String(kstDate.getUTCHours()).padStart(2, '0');
      const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');

      const gameDateKst = `${year}-${month}-${day}`;
      const gameTimeKst = `${hours}:${minutes}`;

      // 상태 결정
      let status: 'finished' | 'upcoming' | 'today' | 'live' = 'upcoming';
      if (competition.status.type.completed) {
        status = 'finished';
      } else if (competition.status.type.name === 'STATUS_IN_PROGRESS') {
        status = 'live';
      } else if (isToday) {
        status = 'today';
      }

      // 점수 추출 (competitors에서)
      const mavsTeam = competition.competitors.find(comp => comp.id === '6');
      const opponentTeam = competition.competitors.find(comp => comp.id !== '6');

      let mavsScore = null;
      let opponentScore = null;
      let result: string | null = null;

      if (mavsTeam?.score && opponentTeam?.score) {
        mavsScore = parseInt(mavsTeam.score);
        opponentScore = parseInt(opponentTeam.score);
        result = mavsScore > opponentScore ? 'W' : 'L';
      }

      return {
        game_id: game.id,
        game_date: competition.date,
        game_date_kst: gameDateKst,
        game_time_kst: gameTimeKst,
        opponent,
        is_home: isHome,
        mavs_score: mavsScore,
        opponent_score: opponentScore,
        result,
        status,
        matchup: `${isHome ? 'vs' : '@'} ${opponent}`,
        venue: competition.venue?.fullName || 'TBD',
        period: competition.status.period,
        time_remaining: competition.status.displayClock,
      };
    }).filter(Boolean);

    // 다음 경기와 오늘 경기 찾기
    const upcomingGames = processedGames.filter(game => game.status === 'upcoming').slice(0, 5);
    const todayGame = processedGames.find(game => game.status === 'today');
    const latestGame = processedGames.filter(game => game.status === 'finished').slice(-1)[0];

    return NextResponse.json({
      success: true,
      data: {
        all_games: processedGames,
        upcoming_games: upcomingGames,
        today_game: todayGame,
        latest_game: latestGame,
        next_game: upcomingGames[0],
      },
      last_updated: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5분 캐시
      },
    });

  } catch (error) {
    console.error('Error fetching ESPN schedule:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch schedule from ESPN',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
