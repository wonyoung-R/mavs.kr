// src/app/api/nba/box-scores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

interface GameSummary {
  game_id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: number;
  period: number;
  time_remaining: string;
  game_time_kst: string;
  game_date_kst: string;
  is_mavs_game: boolean;
  is_live: boolean;
  is_finished: boolean;
  broadcast: string[];
}

interface BoxScoreResponse {
  success: boolean;
  message: string;
  data: GameSummary[];
  last_updated: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedBoxScores();
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'public, max-age=60', // 1 minute cache
          },
        });
      }
    }

    // Call Python service
    const boxScores = await fetchBoxScoresFromPython();

    if (!boxScores.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch box scores',
          message: boxScores.message,
        },
        { status: 500 }
      );
    }

    // Cache the result
    await cacheBoxScores(boxScores);

    return NextResponse.json(boxScores, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=60',
      },
    });

  } catch (error) {
    console.error('Error fetching box scores:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Unable to retrieve box score data',
      },
      { status: 500 }
    );
  }
}

async function fetchBoxScoresFromPython(): Promise<BoxScoreResponse> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'nba_api_service.py');

    // Use virtual environment Python if available
    const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3');

    const python = spawn(pythonPath, [scriptPath, 'today'], {
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
        console.error('Failed to parse Python output:', stdout);
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
let boxScoreCache: { data: BoxScoreResponse; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 1 minute

async function getCachedBoxScores(): Promise<BoxScoreResponse | null> {
  if (!boxScoreCache) return null;

  const now = Date.now();
  if (now - boxScoreCache.timestamp > CACHE_DURATION) {
    boxScoreCache = null;
    return null;
  }

  return boxScoreCache.data;
}

async function cacheBoxScores(data: BoxScoreResponse): Promise<void> {
  boxScoreCache = {
    data,
    timestamp: Date.now(),
  };
}

// Export for cron job
export { fetchBoxScoresFromPython };
