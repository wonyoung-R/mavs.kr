/** Read-only cold/warm timings and output fingerprints; never changes the database. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { getRecordsDatabaseUrl } from '../../src/lib/records/connection';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

async function main() {
  dotenv.config({ path: '.env.local', quiet: true });
  const recordsUrl = getRecordsDatabaseUrl();
  if (!recordsUrl) throw new Error('Explicit RECORDS_DATABASE_URL required.');
  const connection = new URL(recordsUrl);
  connection.searchParams.set('connection_limit', '2');
  process.env.RECORDS_DATABASE_URL = connection.toString();
  const db = await import('../../src/lib/records/database');
  const cases = [
    { name: 'catalog', load: () => db.readDatabaseCatalog() },
    { name: 'game', load: () => db.readDatabaseScope({ kind: 'game', id: 'nba:game:0022501193' }) },
    { name: 'player-page2', load: () => db.readDatabaseScope({ kind: 'player', id: 'nba:player:1717', limit: 200, offset: 200 }) },
    { name: 'season', load: () => db.readDatabaseScope({ kind: 'season', season: 2010, competition: 'regular' }) },
  ];
  const results = [];
  try {
    for (const item of cases) {
      const started = performance.now();
      const result = await item.load();
      const coldMs = Math.round(performance.now() - started);
      assert.equal(result.status, 'ready', item.name);
      const warmStart = performance.now();
      const warm = await item.load();
      const warmMs = Math.round(performance.now() - warmStart);
      assert.deepEqual(warm, result, `${item.name}: warm cache changed output`);
      const normalized = { ...result, dataset: { ...result.dataset,
        playerStats: [...result.dataset.playerStats].sort((a, b) => `${a.gameId}:${a.playerId}`.localeCompare(`${b.gameId}:${b.playerId}`)),
        teamStats: [...result.dataset.teamStats].sort((a, b) => `${a.gameId}:${a.teamId}`.localeCompare(`${b.gameId}:${b.teamId}`)),
      } };
      results.push({ name: item.name, coldMs, warmMs,
        sha256: createHash('sha256').update(JSON.stringify(canonical(normalized))).digest('hex'),
        bytes: Buffer.byteLength(JSON.stringify(result)), totalGames: result.totalGames,
        scopeTotal: result.scopeTotal ?? null, games: result.dataset.games.length,
        players: result.dataset.players.length, playerStats: result.dataset.playerStats.length,
        teamStats: result.dataset.teamStats.length,
      });
    }
    const baselinePath = process.argv[2];
    if (baselinePath) {
      const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
      for (const result of results) assert.equal(result.sha256, baseline.results.find((item: {name:string}) => item.name === result.name)?.sha256, `${result.name}: output differs from baseline`);
    }
    console.log(JSON.stringify({ comparedWithBaseline: Boolean(baselinePath), results }, null, 2));
  } finally { await db.getRecordsPrisma().$disconnect(); }
}

main().catch(error => {
  console.error(error instanceof assert.AssertionError ? error.message : JSON.stringify({ error: error.name, code: error.code, sqlState: error.meta?.code }));
  process.exitCode = 1;
});
