import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkCronAuth, parseDryRun } from '@/lib/auto-content/cron-auth';
import { runPerspectivePipeline } from '@/lib/auto-content/perspective';
import { publishAutoNews } from '@/lib/auto-content/publisher';

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

  try {
    const yesterday = getYesterdayET();
    const scoreboardUrl = `https://stats.nba.com/stats/scoreboardv3?GameDate=${yesterday}&LeagueID=00`;
    const sbRes = await fetch(scoreboardUrl, { headers: NBA_HEADERS });
    if (!sbRes.ok) {
      return NextResponse.json({ ok: false, error: `scoreboard ${sbRes.status}`, stage: 'scoreboard' }, { status: 502 });
    }
    const sb = await sbRes.json();
    const games: Array<any> = sb?.scoreboard?.games ?? [];

    const mavsGame = games.find(g => `${g.homeTeam?.teamId}` === MAVS_TEAM_ID || `${g.awayTeam?.teamId}` === MAVS_TEAM_ID);
    if (!mavsGame) {
      return NextResponse.json({ ok: true, message: 'no Mavericks game yesterday', date: yesterday, dry });
    }

    const sourceId = `nba_game_${mavsGame.gameId}`;
    const existing = await prisma.news.findFirst({ where: { sourceId }, select: { id: true } });
    if (existing && !dry) {
      return NextResponse.json({ ok: true, message: 'already published', newsId: existing.id, dry });
    }

    const isMavsHome = `${mavsGame.homeTeam.teamId}` === MAVS_TEAM_ID;
    const opponent = isMavsHome ? mavsGame.awayTeam : mavsGame.homeTeam;
    const mavs = isMavsHome ? mavsGame.homeTeam : mavsGame.awayTeam;
    const mavsScore = mavs.score;
    const oppScore = opponent.score;
    const won = mavsScore > oppScore;

    const factText = [
      `${yesterday} ${opponent.teamCity} ${opponent.teamName}${isMavsHome ? '를 홈에서 맞이한' : '의 원정에서 치른'} 경기에서 댈러스 매버릭스는 ${mavsScore}-${oppScore}로 ${won ? '승리했다' : '패배했다'}.`,
      `매버릭스의 시즌 성적은 이 경기 결과를 포함해 업데이트됐다.`,
    ].join('\n\n');

    const article = `${won ? '승리' : '패배'} 결과. 매버릭스 ${mavsScore}, ${opponent.teamCity} ${opponent.teamName} ${oppScore}. 날짜(ET): ${yesterday}.`;

    const persp = await runPerspectivePipeline({
      article,
      sourceUrl: `https://www.nba.com/game/${mavsGame.gameId}`,
      dryRun: dry,
    });

    if (dry) {
      return NextResponse.json({
        ok: true,
        dry: true,
        sourceId,
        title_preview: `${yesterday} 매버릭스 ${won ? '승' : '패'} (${mavsScore}-${oppScore} ${opponent.teamCity})`,
        fact_preview: factText,
        perspective: persp,
      });
    }

    const result = await publishAutoNews({
      title: `${yesterday} 매버릭스 ${won ? '승' : '패'} (${mavsScore}-${oppScore} ${opponent.teamCity} ${opponent.teamName})`,
      body: factText,
      perspectiveText: persp.text,
      perspectiveStatus: persp.status,
      riskLevel: persp.riskLevel,
      source: 'nba_api',
      sourceId,
      sourceUrl: `https://www.nba.com/game/${mavsGame.gameId}`,
      publishedAt: new Date(),
    });

    return NextResponse.json({ ok: true, ...result, perspective_status: persp.status });
  } catch (e) {
    console.error('[cron/nba-recap]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

function getYesterdayET(): string {
  const now = new Date();
  // ET는 UTC-5 (DST 무시 단순화). 실제는 NBA가 ET 기준이라 어제 = 약 UTC-5h.
  const etDate = new Date(now.getTime() - 5 * 3600 * 1000);
  etDate.setDate(etDate.getDate() - 1);
  return etDate.toISOString().slice(0, 10).replace(/-/g, '');
}
