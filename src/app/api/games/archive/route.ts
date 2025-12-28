// src/app/api/games/archive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const season = searchParams.get('season'); // 예: "2024-25"
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 기본 조건: FINAL 상태이고 매버릭스 관련 경기
    const baseWhere: any = {
      status: 'FINAL',
      OR: [
        { homeTeam: { contains: 'Mavericks' } },
        { awayTeam: { contains: 'Mavericks' } },
      ],
    };

    // 시즌 필터링 (scheduledAt 기준)
    // 예: "2024-25" -> 2024년 10월 ~ 2025년 6월
    // 예: "2025-26" -> 2025년 10월 ~ 2026년 6월
    if (season) {
      const [startYear, endYearShort] = season.split('-');
      // endYearShort가 2자리면 20XX, 4자리면 그대로 사용
      const endYear = endYearShort.length === 2 ? `20${endYearShort}` : endYearShort;
      const seasonStart = new Date(`${startYear}-10-01T00:00:00Z`); // NBA 시즌 시작
      const seasonEnd = new Date(`${endYear}-06-30T23:59:59Z`); // NBA 시즌 종료

      baseWhere.scheduledAt = {
        gte: seasonStart,
        lte: seasonEnd,
      };
    }

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where: baseWhere,
        orderBy: {
          scheduledAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.game.count({ where: baseWhere }),
    ]);

    // 전체 경기에 대해 승/패 통계 계산 (페이지 내 경기가 아닌 전체 시즌)
    const allGames = await prisma.game.findMany({
      where: baseWhere,
      select: {
        homeTeam: true,
        awayTeam: true,
        homeScore: true,
        awayScore: true,
      },
    });

    let wins = 0;
    let losses = 0;

    for (const game of allGames) {
      const isMavsHome = game.homeTeam.includes('Mavericks');
      const mavsScore = isMavsHome ? game.homeScore : game.awayScore;
      const oppScore = isMavsHome ? game.awayScore : game.homeScore;

      if (mavsScore !== null && oppScore !== null) {
        if (mavsScore > oppScore) {
          wins++;
        } else {
          losses++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        games: games.map(game => ({
          ...game,
          scheduledAt: game.scheduledAt.toISOString(),
          createdAt: game.createdAt.toISOString(),
          updatedAt: game.updatedAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalGames: total,
          wins,
          losses,
          winPct: total > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching game archive:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch game archive',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

