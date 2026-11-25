/** Read-only checks against the already imported release. Never writes to the database. */
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
let verificationStage = 'initialization';

async function main() {
  dotenv.config({ path: '.env.local', quiet: true });
  const db = await import('../../src/lib/records/database');
  const { executeQuery } = await import('../../src/lib/records/query');
  try {
    const input = JSON.parse(await readFile('data/records/normalized/dataset.json', 'utf8'));
    const started = performance.now();
    verificationStage = 'catalog';
    const catalog = await db.readDatabaseCatalog();
    assert.equal(catalog.status, 'ready');
    assert.equal(catalog.totalGames, input.games.length);
    assert.equal(catalog.dataset.games.length, 0);
    assert.equal(catalog.dataset.playerStats.length, 0);
    const releaseId = catalog.releaseId!;
    const timings: { query: string; milliseconds: number; matched: number; value?: number | null }[] = [];
    for (const query of ['Dirk 2010 playoffs sum points', 'Luka 2023 playoffs average points',
                          'Kyrie 2024 regular season points', 'Dirk 2010 playoffs 30 points or more',
                          'Dirk 2010 playoffs home points', 'Dirk vs Luka compare points']) {
      const before = performance.now();
      verificationStage = query;
      const remote = await db.queryDatabaseRecords(query, releaseId);
      const local = executeQuery(query, input);
      assert.equal(remote.status, local.status, query + ' status');
      assert.equal(remote.total, local.total, query + ' count');
      assert.deepEqual(remote.summaries, local.summaries, query + ' summaries');
      assert.deepEqual(remote.rows, local.rows, query + ' rows');
      assert.equal(remote.incomplete, local.incomplete, query + ' completeness');
      timings.push({ query, milliseconds: Math.round(performance.now()-before), matched: remote.total, value: remote.summaries[0]?.value });
    }
    verificationStage = 'season';
    const season = await db.readDatabaseScope({ kind: 'season', season: 2010, competition: 'regular', releaseId });
    assert.equal(season.dataset.games.length, 82);
    assert.equal(season.dataset.playerStats.length, 0);
    verificationStage = 'player';
    const player = await db.readDatabaseScope({ kind: 'player', id: 'nba:player:1717', limit: 200, releaseId });
    assert(player.dataset.playerStats.length <= 200);
    assert(player.dataset.playerStats.every(row => row.playerId==='nba:player:1717'));
    verificationStage = 'game';
    const game = await db.readDatabaseScope({ kind: 'game', id: 'nba:game:0021000028', releaseId });
    assert.equal(game.dataset.games[0].homeScore, 90);
    assert.equal(game.dataset.games[0].awayScore, 91);
    assert.equal(game.dataset.teamStats.length, 2);
    verificationStage = 'leaderboard';
    const leaders = await db.readDatabaseLeaderboard({ season: 2010, competition: 'playoffs', stat: 'PTS', releaseId });
    assert.equal(leaders.find(row => row.playerId==='nba:player:1717')?.value, 582);
    verificationStage = 'warm-equivalent-query';
    const warmStart = performance.now();
    const warm = await db.queryDatabaseRecords('노비츠키 2010 플레이오프 합계 득점', releaseId);
    assert.equal(warm.summaries[0].value, 582);
    const warmQueryMs = Math.round(performance.now()-warmStart);
    const summary = {
      checkedAt: new Date().toISOString(), releaseId, passed: true,
      games: catalog.totalGames, dalPlayers: catalog.dalPlayerIds.length,
      seasons: catalog.availableSeasons.length, queries: timings, warmQueryMs,
      payloadBytes: { catalog: Buffer.byteLength(JSON.stringify(catalog)),
        season: Buffer.byteLength(JSON.stringify(season)), playerPage: Buffer.byteLength(JSON.stringify(player)),
        game: Buffer.byteLength(JSON.stringify(game)) },
      durationMs: Math.round(performance.now()-started),
    };
    await writeFile('data/records/normalized/live-verification.json', JSON.stringify(summary,null,2)+'\n');
    console.log(JSON.stringify(summary));
  } finally { await db.getRecordsPrisma().$disconnect(); }
}

main().catch(error => {
  console.error(error instanceof assert.AssertionError ? error.message : JSON.stringify({stage:verificationStage,error:error.name,code:error.code,sqlState:error.meta?.code}));
  process.exitCode = 1;
});
