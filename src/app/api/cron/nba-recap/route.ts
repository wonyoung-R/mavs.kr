import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkCronAuth, parseDryRun } from '@/lib/auto-content/cron-auth';
import { runColumnPipeline } from '@/lib/auto-content/column/pipeline';
import { renderColumnHtml } from '@/lib/auto-content/column/generate-column';
import { publishAutoNews } from '@/lib/auto-content/publisher';
import { processFirstNewMmbItem } from '@/lib/auto-content/sources/mavsmoneyball';
import { fetchBoxscore, boxToFactArticle } from '@/lib/auto-content/sources/nba-boxscore';

const MAVS_TEAM_ID = '1610612742';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const NBA_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
};

export async function GET(request: Request) {
  const authErr = checkCronAuth(request);
  if (authErr) return authErr;
  const dry = parseDryRun(request);
  const dateOverride = new URL(request.url).searchParams.get('date');

  try {
    const targetDate = dateOverride ?? getYesterdayET();

    let mavsGame: any = null;
    const scoreboardUrl = `https://stats.nba.com/stats/scoreboardv3?GameDate=${targetDate}&LeagueID=00`;
    const sbRes = await fetch(scoreboardUrl, { headers: NBA_HEADERS });
    if (sbRes.ok) {
      const sb = await sbRes.json();
      const games: Array<any> = sb?.scoreboard?.games ?? [];
      mavsGame = games.find(g => `${g.homeTeam?.teamId}` === MAVS_TEAM_ID || `${g.awayTeam?.teamId}` === MAVS_TEAM_ID);
    }

    if (!mavsGame) {
      const dbGame = await findMavsGameInDb(targetDate).catch(() => null);
      if (dbGame) mavsGame = dbGame;
    }

    if (!mavsGame) {
      const fallback = await processFirstNewMmbItem({ dryRun: dry });
      return NextResponse.json({
        ok: true,
        date: targetDate,
        dry,
        path: 'fallback_mmb',
        fallback,
      });
    }

    return await processGameRecap(mavsGame, targetDate, dry);
  } catch (e) {
    console.error('[cron/nba-recap]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

async function processGameRecap(mavsGame: any, targetDate: string, dry: boolean) {
  const isMavsHome = `${mavsGame.homeTeam.teamId ?? mavsGame.homeTeamId}` === MAVS_TEAM_ID
    || (mavsGame.homeTeam?.teamName ?? mavsGame.homeTeam ?? '').includes('Maverick');
  const homeTeam = mavsGame.homeTeam ?? {};
  const awayTeam = mavsGame.awayTeam ?? {};
  const opponent = isMavsHome ? awayTeam : homeTeam;
  const mavs = isMavsHome ? homeTeam : awayTeam;
  const mavsScore = mavs.score ?? mavsGame.mavsScore;
  const oppScore = opponent.score ?? mavsGame.oppScore;
  const won = mavsScore > oppScore;
  const opponentLabel =
    (opponent.teamCity ?? '') + (opponent.teamCity ? ' ' : '') + (opponent.teamName ?? opponent.team ?? '');

  const sourceId = `nba_game_${mavsGame.gameId}`;
  if (!dry) {
    const existing = await prisma.news.findFirst({ where: { sourceId }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ ok: true, message: 'already published', newsId: existing.id, date: targetDate });
    }
  }

  // boxscore 시도 — 성공 시 풍부한 사실 영역 (환각 차단의 핵심)
  let article: string;
  const box = await fetchBoxscore(mavsGame.gameId).catch(() => null);
  if (box) {
    article = `날짜(ET): ${targetDate}.\n${boxToFactArticle(box, isMavsHome)}`;
  } else {
    // boxscore 없으면 기본 사실만
    article = [
      `날짜(ET): ${targetDate}.`,
      `${isMavsHome ? '홈에서' : '원정에서'} 진행된 경기.`,
      `댈러스 매버릭스 ${mavsScore}점, ${opponentLabel.trim() || '상대팀'} ${oppScore}점.`,
      `결과: 매버릭스 ${won ? '승리' : '패배'} (${Math.abs(mavsScore - oppScore)}점 차).`,
    ].join(' ');
  }

  const pipe = await runColumnPipeline({
    article,
    sourceUrl: `https://www.nba.com/game/${mavsGame.gameId}`,
    sourceLabel: 'NBA.com',
    team: 'mavericks',
    dryRun: dry,
  });

  const col = pipe.column;
  const bodyHtml = renderColumnHtml(col);

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      date: targetDate,
      path: 'game_recap',
      sourceId,
      title_kr: col.titleKr,
      meta: col.metaDescription,
      body_preview: [col.leadParagraph, ...col.bodyParagraphs.slice(0, 1)].join('\n\n').slice(0, 400),
      closing: col.closingParagraph,
      perspective_status: pipe.status,
      should_skip_publish: pipe.shouldSkipPublish,
      category: col.category,
      risk_level: col.riskLevel,
      debug: {
        critique1: pipe.critique1,
        critique2: pipe.critique2,
        hallucinations: pipe.hallucinations,
        bannedPatternHit: pipe.bannedPatternHit,
      },
    });
  }

  if (pipe.shouldSkipPublish) {
    return NextResponse.json({
      ok: true,
      path: 'game_recap',
      skipped: 'rejected by critique',
      reason: pipe.critique2 ?? pipe.critique1,
      hallucinations: pipe.hallucinations,
    });
  }

  const result = await publishAutoNews({
    title: col.titleKr,
    body: bodyHtml,
    summary: col.metaDescription,
    perspectiveStatus: pipe.status,
    riskLevel: col.riskLevel,
    source: 'nba_api',
    sourceId,
    sourceUrl: `https://www.nba.com/game/${mavsGame.gameId}`,
    publishedAt: new Date(),
    team: 'mavericks',
  });

  return NextResponse.json({ ok: true, path: 'game_recap', ...result, perspective_status: pipe.status });
}

async function findMavsGameInDb(targetDate: string): Promise<any> {
  const day = new Date(targetDate + 'T00:00:00Z');
  const start = new Date(day.getTime() - 12 * 3600 * 1000);
  const end = new Date(day.getTime() + 36 * 3600 * 1000);

  const game = await prisma.game.findFirst({
    where: {
      scheduledAt: { gte: start, lte: end },
      OR: [
        { homeTeam: { contains: 'Mavericks' } },
        { awayTeam: { contains: 'Mavericks' } },
        { homeTeam: { contains: 'Dallas' } },
        { awayTeam: { contains: 'Dallas' } },
      ],
    },
  });
  if (!game) return null;

  const isMavsHome = game.homeTeam.includes('Maverick') || game.homeTeam.includes('Dallas');
  return {
    gameId: game.gameId,
    homeTeam: { teamId: isMavsHome ? MAVS_TEAM_ID : 'opp', teamCity: '', teamName: game.homeTeam, score: game.homeScore },
    awayTeam: { teamId: isMavsHome ? 'opp' : MAVS_TEAM_ID, teamCity: '', teamName: game.awayTeam, score: game.awayScore },
  };
}

function getYesterdayET(): string {
  const now = new Date();
  const etDate = new Date(now.getTime() - 5 * 3600 * 1000);
  etDate.setDate(etDate.getDate() - 1);
  return etDate.toISOString().slice(0, 10);
}
