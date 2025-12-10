// src/app/api/nba/mavericks-games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

interface MavericksGame {
  game_id: string;
  game_date: string;
  game_date_kst: string;
  game_time_kst: string;
  opponent: string;
  is_home: boolean;
  mavs_score: number;
  opponent_score: number | null;
  result: string | null;
  status: 'finished' | 'upcoming' | 'today' | 'live';
  matchup: string;
  venue: string;
  period?: number;
  time_remaining?: string;
  broadcast?: string[];
}

interface MavericksGamesResponse {
  success: boolean;
  message: string;
  data: {
    all_games: MavericksGame[];
    latest_game: MavericksGame | null;
    next_game: MavericksGame | null;
    today_game: MavericksGame | null;
    recent_games: MavericksGame[];
    upcoming_games: MavericksGame[];
  };
  last_updated: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const command = searchParams.get('command') || 'summary';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedMavericksGames(command);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'public, max-age=300', // 5 minute cache
          },
        });
      }
    }

    // Call Python service
    const gamesData = await fetchMavericksGamesFromPython(command);

    if (!gamesData.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch Mavericks games',
          message: gamesData.message,
        },
        { status: 500 }
      );
    }

    // Cache the result
    await cacheMavericksGames(command, gamesData);

    return NextResponse.json(gamesData, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=300',
      },
    });

  } catch (error) {
    console.error('Error fetching Mavericks games:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Unable to retrieve Mavericks games data',
      },
      { status: 500 }
    );
  }
}

async function fetchMavericksGamesFromPython(command: string): Promise<MavericksGamesResponse> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'mavericks_games_service.py');

    // Use virtual environment Python
    const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3');

    const python = spawn(pythonPath, [scriptPath, command], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', stderr);
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse Python output:', stdout, parseError);
        reject(new Error('Failed to parse Python script output'));
      }
    });

    python.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });
  });
}

// Simple in-memory cache (in production, use Redis)
const mavericksGamesCache: { [key: string]: { data: MavericksGamesResponse; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedMavericksGames(command: string): Promise<MavericksGamesResponse | null> {
  const cacheKey = `mavericks-games-${command}`;
  const cached = mavericksGamesCache[cacheKey];

  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    delete mavericksGamesCache[cacheKey];
    return null;
  }

  return cached.data;
}

async function cacheMavericksGames(command: string, data: MavericksGamesResponse): Promise<void> {
  const cacheKey = `mavericks-games-${command}`;
  mavericksGamesCache[cacheKey] = {
    data,
    timestamp: Date.now(),
  };
}

// Export for cron job
export { fetchMavericksGamesFromPython };













