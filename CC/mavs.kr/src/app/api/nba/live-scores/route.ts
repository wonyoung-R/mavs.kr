// src/app/api/nba/live-scores/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface LiveGame {
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

interface ProcessedLiveGame {
  game_id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  period: number;
  time_remaining: string;
  game_time_kst: string;
  game_date_kst: string;
  is_mavs_game: boolean;
  is_live: boolean;
  is_finished: boolean;
  broadcast: string[];
}

// ESPN API 팀 이름을 우리 시스템의 팀 이름으로 매핑
function mapTeamName(espnTeamName: string): string {
  const teamMapping: { [key: string]: string } = {
    // 서부 컨퍼런스
    'Dallas Mavericks': 'Mavericks',
    'Los Angeles Lakers': 'Lakers',
    'Golden State Warriors': 'Warriors',
    'Oklahoma City Thunder': 'Thunder',
    'Houston Rockets': 'Rockets',
    'San Antonio Spurs': 'Spurs',
    'Denver Nuggets': 'Nuggets',
    'Utah Jazz': 'Jazz',
    'Portland Trail Blazers': 'Trail Blazers',
    'Phoenix Suns': 'Suns',
    'Sacramento Kings': 'Kings',
    'LA Clippers': 'Clippers',
    'Los Angeles Clippers': 'Clippers',
    'Minnesota Timberwolves': 'Timberwolves',
    'New Orleans Pelicans': 'Pelicans',
    'Memphis Grizzlies': 'Grizzlies',
    
    // 동부 컨퍼런스
    'Boston Celtics': 'Celtics',
    'Miami Heat': 'Heat',
    'Milwaukee Bucks': 'Bucks',
    'Philadelphia 76ers': '76ers',
    'Brooklyn Nets': 'Nets',
    'New York Knicks': 'Knicks',
    'Toronto Raptors': 'Raptors',
    'Chicago Bulls': 'Bulls',
    'Cleveland Cavaliers': 'Cavaliers',
    'Detroit Pistons': 'Pistons',
    'Indiana Pacers': 'Pacers',
    'Atlanta Hawks': 'Hawks',
    'Charlotte Hornets': 'Hornets',
    'Orlando Magic': 'Magic',
    'Washington Wizards': 'Wizards',
  };
  
  return teamMapping[espnTeamName] || espnTeamName;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // ESPN API에서 오늘의 NBA 점수 가져오기
    const scoreboardResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');

    if (!scoreboardResponse.ok) {
      throw new Error(`ESPN Scoreboard API error: ${scoreboardResponse.status}`);
    }

    const scoreboardData = await scoreboardResponse.json();
    const games = scoreboardData.events || [];

    // 경기 데이터 처리
    const processedGames: ProcessedLiveGame[] = games.map((game: LiveGame) => {
      const competition = game.competitions[0];
      const homeTeam = competition.competitors.find(comp => comp.homeAway === 'home');
      const awayTeam = competition.competitors.find(comp => comp.homeAway === 'away');

      if (!homeTeam || !awayTeam) return null;

      const gameDate = new Date(competition.date);

      // 한국 시간으로 변환
      const kstDate = new Date(gameDate.getTime() + (9 * 60 * 60 * 1000));
      const gameDateKst = kstDate.toISOString().split('T')[0];
      const gameTimeKst = kstDate.toTimeString().split(' ')[0].substring(0, 5);

      // 매버릭스 경기인지 확인
      const isMavsGame = homeTeam.team.id === '6' || awayTeam.team.id === '6';

      // 상태 결정
      const isFinished = competition.status.type.completed;
      const isLive = competition.status.type.name === 'STATUS_IN_PROGRESS';

      const homeTeamName = mapTeamName(homeTeam.team.name || homeTeam.team.shortDisplayName || 'TBD');
      const awayTeamName = mapTeamName(awayTeam.team.name || awayTeam.team.shortDisplayName || 'TBD');
      
      // 디버깅을 위한 로그
      console.log('Team names mapping:', {
        home: { original: homeTeam.team.name, mapped: homeTeamName },
        away: { original: awayTeam.team.name, mapped: awayTeamName }
      });

      return {
        game_id: game.id,
        home_team: homeTeamName,
        away_team: awayTeamName,
        home_score: homeTeam.score ? parseInt(homeTeam.score) : 0,
        away_score: awayTeam.score ? parseInt(awayTeam.score) : 0,
        status: competition.status.type.name,
        period: competition.status.period || 0,
        time_remaining: competition.status.displayClock || '',
        game_time_kst: gameTimeKst,
        game_date_kst: gameDateKst,
        is_mavs_game: isMavsGame,
        is_live: isLive,
        is_finished: isFinished,
        broadcast: [], // ESPN API에서 방송 정보는 별도로 가져와야 함
      };
    }).filter(Boolean);

    // 매버릭스 경기와 다른 경기 분리
    const mavsGames = processedGames.filter(game => game.is_mavs_game);
    const otherGames = processedGames.filter(game => !game.is_mavs_game);

    return NextResponse.json({
      success: true,
      data: {
        all_games: processedGames,
        mavs_games: mavsGames,
        other_games: otherGames,
        live_games: processedGames.filter(game => game.is_live),
        finished_games: processedGames.filter(game => game.is_finished),
      },
      last_updated: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60', // 1분 캐시
      },
    });

  } catch (error) {
    console.error('Error fetching live scores:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch live scores from ESPN',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
