// src/app/api/cron/update-box-scores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchBoxScoresFromPython } from '@/app/api/nba/box-scores/route';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (optional security check)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting scheduled box score update...');

    // Fetch fresh box scores
    const boxScores = await fetchBoxScoresFromPython();

    if (!boxScores.success) {
      console.error('Failed to fetch box scores:', boxScores.message);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update box scores',
          message: boxScores.message,
        },
        { status: 500 }
      );
    }

    console.log(`Successfully updated box scores: ${boxScores.data.length} games`);

    return NextResponse.json({
      success: true,
      message: `Updated ${boxScores.data.length} games`,
      data: boxScores.data,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Cron job error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to update box scores',
      },
      { status: 500 }
    );
  }
}

// Export for manual testing
export { fetchBoxScoresFromPython };

