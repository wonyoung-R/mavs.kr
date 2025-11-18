// src/app/api/nba/live-scores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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

// Retry helper for network requests using axios
async function fetchWithRetry(url: string, maxRetries = 5) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[fetchWithRetry] Attempt ${attempt}/${maxRetries} for ${url}`);
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MavsKR/1.0)',
        },
        timeout: 10000, // 10 second timeout
      });
      console.log(`[fetchWithRetry] Success on attempt ${attempt}`);
      return response.data;
    } catch (error) {
      lastError = error as Error;
      const errorCode = (error as any)?.code;
      console.error(`[fetchWithRetry] Attempt ${attempt} failed:`, errorCode || error);

      // Check if it's a DNS or network error
      const isRetryableError = errorCode === 'EAI_AGAIN' ||
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ECONNRESET';

      if (attempt < maxRetries && isRetryableError) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[fetchWithRetry] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (attempt >= maxRetries) {
        console.error(`[fetchWithRetry] All ${maxRetries} attempts failed`);
        break;
      } else {
        // For non-retryable errors, fail immediately
        throw error;
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
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

    console.log('[Live Scores API] Fetching from ESPN...');

    // ESPN API에서 오늘의 NBA 점수 가져오기 (retry logic for DNS failures)
    const scoreboardData = await fetchWithRetry(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      5 // 최대 5번 재시도
    );

    const games = scoreboardData.events || [];
    console.log('[Live Scores API] Found', games.length, 'games');

    // 경기 데이터 처리
    const processedGames: ProcessedLiveGame[] = games.map((game: LiveGame) => {
      try {
        const competition = game.competitions?.[0];
        if (!competition) {
          console.warn('[Live Scores API] No competition data for game:', game.id);
          return null;
        }

        const homeTeam = competition.competitors?.find(comp => comp.homeAway === 'home');
        const awayTeam = competition.competitors?.find(comp => comp.homeAway === 'away');

        if (!homeTeam || !awayTeam) {
          console.warn('[Live Scores API] Missing team data for game:', game.id);
          return null;
        }

        const gameDate = new Date(competition.date);

        // 한국 시간으로 변환
        const kstDate = new Date(gameDate.getTime() + (9 * 60 * 60 * 1000));
        const gameDateKst = kstDate.toISOString().split('T')[0];
        const gameTimeKst = kstDate.toTimeString().split(' ')[0].substring(0, 5);

        // 매버릭스 경기인지 확인
        const isMavsGame = homeTeam.team.id === '6' || awayTeam.team.id === '6';

        // 상태 결정
        const isFinished = competition.status?.type?.completed || false;
        const isLive = competition.status?.type?.name === 'STATUS_IN_PROGRESS';

        const homeTeamName = mapTeamName(homeTeam.team.name || homeTeam.team.shortDisplayName || 'TBD');
        const awayTeamName = mapTeamName(awayTeam.team.name || awayTeam.team.shortDisplayName || 'TBD');

        return {
          game_id: game.id,
          home_team: homeTeamName,
          away_team: awayTeamName,
          home_score: homeTeam.score ? parseInt(homeTeam.score) : 0,
          away_score: awayTeam.score ? parseInt(awayTeam.score) : 0,
          status: competition.status?.type?.name || 'TBD',
          period: competition.status?.period || 0,
          time_remaining: competition.status?.displayClock || '',
          game_time_kst: gameTimeKst,
          game_date_kst: gameDateKst,
          is_mavs_game: isMavsGame,
          is_live: isLive,
          is_finished: isFinished,
          broadcast: [], // ESPN API에서 방송 정보는 별도로 가져와야 함
        };
      } catch (error) {
        console.error('[Live Scores API] Error processing game:', game.id, error);
        return null;
      }
    }).filter((game): game is ProcessedLiveGame => game !== null);

    // 매버릭스 경기와 다른 경기 분리
    const mavsGames = processedGames.filter(game => game.is_mavs_game);
    const otherGames = processedGames.filter(game => !game.is_mavs_game);

    console.log('[Live Scores API] Processed games:', {
      total: processedGames.length,
      mavs: mavsGames.length,
      live: processedGames.filter(game => game.is_live).length,
      finished: processedGames.filter(game => game.is_finished).length,
    });

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
    console.error('[Live Scores API] Error:', error);
    console.error('[Live Scores API] Stack:', error instanceof Error ? error.stack : 'N/A');

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch live scores from ESPN',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
