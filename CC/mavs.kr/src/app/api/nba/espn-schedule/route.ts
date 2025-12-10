// src/app/api/nba/espn-schedule/route.ts
import { NextResponse } from 'next/server';

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
  mavs_record: string; // Added
  opponent_record: string; // Added
  result: string | null;
  status: 'finished' | 'upcoming' | 'today' | 'live';
  matchup: string;
  venue: string;
  period?: number;
  time_remaining?: string;
}

export async function GET() {
  try {
    // 1. 매버릭스 경기 일정 가져오기
    const scheduleResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/6/schedule');

    if (!scheduleResponse.ok) throw new Error(`ESPN API error: ${scheduleResponse.status}`);

    const scheduleData = await scheduleResponse.json();
    const games = scheduleData.events || [];
    const mavsRecord = scheduleData.team?.recordSummary || '';

    // 2. 오늘의 NBA 점수 (기록 정보 포함) 가져오기
    const scoreboardResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');

    let todayGames: any[] = [];
    if (scoreboardResponse.ok) {
      const scoreboardData = await scoreboardResponse.json();
      todayGames = scoreboardData.events || [];
    }

    // 매버릭스 경기 데이터 처리
    const processedGames: ProcessedGame[] = games.map((game: ESPNGame) => {
      const competition = game.competitions[0];

      // 상대팀 추출
      const gameName = game.name || '';
      const shortName = game.shortName || '';
      const isHome = gameName.includes('at Dallas Mavericks') || shortName.includes('@ DAL');
      // ... date logic ...
      const gameDate = new Date(competition.date);
      const today = new Date();
      const isToday = gameDate.toDateString() === today.toDateString();

      // KST Conversion
      const usTime = gameDate.getTime();
      const kstTime = usTime + (15 * 60 * 60 * 1000); // Approximate conversion
      const kstDate = new Date(kstTime);

      const year = kstDate.getUTCFullYear();
      const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(kstDate.getUTCDate()).padStart(2, '0');
      const hours = String(kstDate.getUTCHours()).padStart(2, '0');
      const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');

      const gameDateKst = `${year}-${month}-${day}`;
      const gameTimeKst = `${hours}:${minutes}`;

      // Status
      let status: 'finished' | 'upcoming' | 'today' | 'live' = 'upcoming';
      if (competition.status.type.completed) status = 'finished';
      else if (competition.status.type.name === 'STATUS_IN_PROGRESS') status = 'live';
      else if (isToday) status = 'today';

      // Team & Score stats
      const mavsTeam = competition.competitors.find(comp => comp.id === '6');
      const opponentTeam = competition.competitors.find(comp => comp.id !== '6');
      const opponent = opponentTeam ? (opponentTeam.team.name || opponentTeam.team.shortDisplayName) : 'TBD';

      // Record Extraction
      let opponentRecord = '';

      // 1. 만약 오늘 경기라면 scoreboard 데이터에서 정확한 기록 찾기
      if (isToday) {
        const todayGameMatch = todayGames.find((g: any) => g.id === game.id);
        if (todayGameMatch) {
          const oppComp = todayGameMatch.competitions[0].competitors.find((c: any) => c.id !== '6');
          if (oppComp && oppComp.records) {
            opponentRecord = oppComp.records.find((r: any) => r.type === 'total')?.summary || '';
          }
        }
      }

      // 2. 만약 live/scoreboard 데이터가 없다면 기본적으로 schedule에는 상대 전적이 없으므로 빈값

      let mavsScore: number | null = null;
      let opponentScore: number | null = null;
      let result: string | null = null;

      // Score extraction: ESPN API returns score as an object with value/displayValue
      if (mavsTeam?.score) {
        mavsScore = mavsTeam.score.value ?? (mavsTeam.score.displayValue ? parseInt(mavsTeam.score.displayValue) : null);
      }
      if (opponentTeam?.score) {
        opponentScore = opponentTeam.score.value ?? (opponentTeam.score.displayValue ? parseInt(opponentTeam.score.displayValue) : null);
      }

      // Determine result based on winner flag or score comparison
      if (mavsTeam?.winner !== undefined) {
        result = mavsTeam.winner ? 'W' : 'L';
      } else if (mavsScore !== null && opponentScore !== null) {
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
        mavs_record: mavsRecord,
        opponent_record: opponentRecord,
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
