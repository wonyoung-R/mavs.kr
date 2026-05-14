/**
 * NBA.com boxscoretraditionalv3 API에서 박스스코어 데이터를 가져와
 * article 영역에 풍부한 사실(리더 선수 스탯, 쿼터별 점수 등)을 담는다.
 *
 * 환각 차단 효과: critique이 검증할 사실 근거가 풍부해져 모델이 사전 지식으로
 * 빈 공간을 채우는 경향이 사라진다.
 */

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
};

export interface PlayerLine {
  name: string;
  starter: boolean;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fgMade: number;
  fgAtt: number;
  threeMade: number;
  threeAtt: number;
}

export interface TeamBox {
  teamName: string;
  teamCity: string;
  score: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  players: PlayerLine[];
}

export interface GameBox {
  gameId: string;
  arenaName?: string;
  attendance?: number;
  home: TeamBox;
  away: TeamBox;
}

export async function fetchBoxscore(gameId: string): Promise<GameBox | null> {
  // gameId가 ESPN ID라면 NBA endpoint 호출 불가 — 호출 시도하되 실패시 null
  const cleanId = gameId.replace(/^ESPN-/, '');
  const url = `https://stats.nba.com/stats/boxscoretraditionalv3?GameID=${cleanId}&LeagueID=00&endPeriod=0&endRange=28800&rangeType=0&startPeriod=0&startRange=0`;

  try {
    const res = await fetch(url, { headers: NBA_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const game = data?.boxScoreTraditional;
    if (!game) return null;

    return {
      gameId: cleanId,
      arenaName: game.arena?.arenaName,
      attendance: game.attendance,
      home: parseTeam(game.homeTeam),
      away: parseTeam(game.awayTeam),
    };
  } catch (e) {
    console.warn('[nba-boxscore] fetch failed:', e);
    return null;
  }
}

function parseTeam(t: any): TeamBox {
  const players: PlayerLine[] = (t?.players ?? []).map((p: any) => ({
    name: `${p.firstName ?? ''} ${p.familyName ?? ''}`.trim(),
    starter: p.starter === 1 || p.starter === '1',
    minutes: typeof p.statistics?.minutes === 'string' ? p.statistics.minutes : '0',
    points: p.statistics?.points ?? 0,
    rebounds: p.statistics?.reboundsTotal ?? 0,
    assists: p.statistics?.assists ?? 0,
    steals: p.statistics?.steals ?? 0,
    blocks: p.statistics?.blocks ?? 0,
    fgMade: p.statistics?.fieldGoalsMade ?? 0,
    fgAtt: p.statistics?.fieldGoalsAttempted ?? 0,
    threeMade: p.statistics?.threePointersMade ?? 0,
    threeAtt: p.statistics?.threePointersAttempted ?? 0,
  })).filter((p: PlayerLine) => p.name && p.points + p.rebounds + p.assists > 0);

  return {
    teamName: t?.teamName ?? '',
    teamCity: t?.teamCity ?? '',
    score: t?.score ?? 0,
    q1: t?.periods?.[0]?.score ?? 0,
    q2: t?.periods?.[1]?.score ?? 0,
    q3: t?.periods?.[2]?.score ?? 0,
    q4: t?.periods?.[3]?.score ?? 0,
    players,
  };
}

/**
 * boxscore를 풍부한 한국어 사실 텍스트로 변환.
 * generate가 환각 없이 사실 기반 작성하도록 충분한 정보 제공.
 */
export function boxToFactArticle(box: GameBox, mavsIsHome: boolean): string {
  const mavs = mavsIsHome ? box.home : box.away;
  const opp = mavsIsHome ? box.away : box.home;
  const won = mavs.score > opp.score;
  const margin = Math.abs(mavs.score - opp.score);

  const topMavs = [...mavs.players].sort((a, b) => b.points - a.points).slice(0, 4);
  const topOpp = [...opp.players].sort((a, b) => b.points - a.points).slice(0, 2);

  const lines: string[] = [];
  lines.push(`경기 결과: 댈러스 매버릭스 ${mavs.score}점, ${opp.teamCity} ${opp.teamName} ${opp.score}점. ${won ? '매버릭스 승리' : '매버릭스 패배'} (${margin}점 차).`);
  lines.push(`경기장: ${mavsIsHome ? '홈' : '원정'}.${box.arenaName ? ` ${box.arenaName}.` : ''}`);
  lines.push(`쿼터별 점수 — 매버릭스: ${mavs.q1}-${mavs.q2}-${mavs.q3}-${mavs.q4}, ${opp.teamName}: ${opp.q1}-${opp.q2}-${opp.q3}-${opp.q4}.`);
  lines.push('');
  lines.push('매버릭스 주요 선수 기록:');
  for (const p of topMavs) {
    lines.push(`- ${p.name} (${p.starter ? '선발' : '벤치'}): ${p.points}점, 리바운드 ${p.rebounds}, 어시스트 ${p.assists}${p.steals ? `, 스틸 ${p.steals}` : ''}${p.blocks ? `, 블록 ${p.blocks}` : ''}. 야투 ${p.fgMade}/${p.fgAtt}${p.threeAtt ? `, 3점 ${p.threeMade}/${p.threeAtt}` : ''}. 출전 ${p.minutes}.`);
  }
  if (topOpp.length > 0) {
    lines.push('');
    lines.push(`${opp.teamName} 주요 선수:`);
    for (const p of topOpp) {
      lines.push(`- ${p.name}: ${p.points}점, 리바운드 ${p.rebounds}, 어시스트 ${p.assists}.`);
    }
  }

  return lines.join('\n');
}
