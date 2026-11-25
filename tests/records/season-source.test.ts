import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { collectSeason } from '../../src/lib/records/season-source';
import type { RecordDataset } from '../../src/lib/records/types';
const baseline: RecordDataset = { version: 1, teams: ['DAL', 'GSW'].map((abbreviation, i) => ({ id: `nba:${i}`, abbreviation, name: abbreviation, nameKo: abbreviation, aliases: [] })), players: [{ id: 'nba:player:1', name: 'Luka Dončić Jr.', nameKo: '루카', aliases: [] }], games: [], playerStats: [], teamStats: [], coverage: [], sources: [] };
const asOf = new Date('2026-11-13T00:00:00Z');
const keys = ['minutes', 'points', 'fieldGoalsMade-fieldGoalsAttempted', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'freeThrowsMade-freeThrowsAttempted', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'offensiveRebounds', 'defensiveRebounds', 'fouls', 'plusMinus'];
function fixture() {
  const competition = { date: '2026-10-22T00:30Z', neutralSite: false, status: { type: { completed: true, name: 'STATUS_FINAL' } }, competitors: [{ homeAway: 'home', team: { id: '6', abbreviation: 'DAL' }, score: '2' }, { homeAway: 'away', team: { id: '9', abbreviation: 'GS' }, score: '0' }], notes: [] as { headline: string }[] };
  const event = { id: '123', date: competition.date, name: 'Dallas vs Golden State', season: { year: 2027 }, seasonType: { type: 2 }, competitions: [competition] };
  const players = ['DAL', 'GS'].map((abbreviation, team) => ({ team: { abbreviation }, statistics: [{ keys, athletes: Array.from({ length: 7 }, (_, i) => ({ athlete: { id: `${team + 1}${i}`, displayName: team === 0 && i === 0 ? 'Luka Doncic Jr' : `Player ${team} ${i}`, position: { abbreviation: i === 0 ? 'PG' : 'F' } }, active: i < 6, starter: i < 5, didNotPlay: i === 6, reason: i === 6 ? "COACH'S DECISION" : undefined, stats: i === 6 ? [] : ['0', team === 0 && i === 0 ? '2' : '0', team === 0 && i === 0 ? '1-1' : '0-0', '0-0', '0-0', '0', '0', '0', '0', '0', '0', '0', '0', '0'] })), totals: ['', team === 0 ? '2' : '0', team === 0 ? '1-1' : '0-0', '0-0', '0-0', '0', '0', '0', '0', '0', '0', '0', '0', ''] }] }));
  const teams = ['DAL', 'GS'].map((abbreviation, team) => ({ team: { abbreviation }, statistics: [{ name: 'fieldGoalsMade-fieldGoalsAttempted', displayValue: team === 0 ? '1-1' : '0-0' }, { name: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', displayValue: '0-0' }, { name: 'freeThrowsMade-freeThrowsAttempted', displayValue: '0-0' }, ...['totalRebounds', 'offensiveRebounds', 'defensiveRebounds', 'turnovers', 'teamTurnovers'].map(name => ({ name, displayValue: '0' }))] }));
  return { schedule: { season: { year: 2027, type: 2 }, events: [event] }, summary: { header: { id: '123', season: { year: 2027, type: 2 }, competitions: [structuredClone(competition)] }, boxscore: { players, teams } } };
}
function mock(f: ReturnType<typeof fixture>, status = 200) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => { calls.push(url); return new Response(JSON.stringify(url.includes('seasontype=3') ? { events: [] } : url.includes('/schedule?') ? f.schedule : f.summary), { status }); }) as typeof fetch;
  return { fetchImpl, calls };
}
test('collects both sides, canonical IDs, explicit zero/DNP, UTC date and provenance deterministically', async () => {
  const f = fixture(), m = mock(f);
  const first = await collectSeason({ season: 2026, asOf, baseline, fetchImpl: m.fetchImpl });
  const again = await collectSeason({ season: 2026, asOf, baseline, fetchImpl: m.fetchImpl });
  assert.deepEqual(first.dataset, again.dataset);
  assert.equal(first.dataset.games[0].id, 'espn:game:123');
  assert.equal(first.dataset.games[0].awayTeamId, 'nba:1');
  assert.equal(first.dataset.games[0].neutral, false);
  assert.equal(first.dataset.games[0].date, '2026-10-22');
  assert.equal(first.dataset.playerStats[0].playerId, 'nba:player:1');
  assert.equal(first.dataset.playerStats[0].starterPosition, 'G');
  assert.equal(first.dataset.playerStats[5].participation, 'played');
  assert.equal(first.dataset.playerStats[5].values.MIN_SECONDS, 0);
  assert.equal(first.dataset.playerStats[6].participation, 'dnp');
  assert.equal(first.dataset.playerStats[6].values.PTS, null);
  assert.equal(first.dataset.teamStats.length, 2);
  assert.equal(first.report.completedCollected, 1);
  assert.equal(Object.keys(first.raw).length, 3);
  for (const [url, body] of Object.entries(first.rawBodies)) assert.equal(createHash('sha256').update(body).digest('hex'), first.report.rawHashes[url]);
  const later = await collectSeason({ season: 2026, asOf: new Date('2026-11-14T00:00:00Z'), baseline, fetchImpl: m.fetchImpl });
  assert.deepEqual(first.dataset.coverage, later.dataset.coverage);
});
test('only confirmed finals before asOf; duplicate event IDs count once', async () => {
  const f = fixture(); f.schedule.events.push(structuredClone(f.schedule.events[0]));
  const future = structuredClone(f.schedule.events[0]); future.id = '124'; future.date = '2026-12-01T00:30Z'; f.schedule.events.push(future);
  const live = structuredClone(f.schedule.events[0]); live.id = '125'; live.competitions[0].status.type.completed = false; f.schedule.events.push(live);
  const result = await collectSeason({ season: 2026, asOf, baseline, ...mock(f) });
  assert.equal(result.report.completedExpected, 1);
});
test('rejects wrong season, out-of-window date and missing final boxscore', async () => {
  let f = fixture(); f.schedule.season.year = 2026;
  await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...mock(f) }), /season\/type/);
  f = fixture(); f.schedule.events[0].date = '2025-10-01T00:00Z';
  await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...mock(f) }), /season window/);
  f = fixture(); f.summary.boxscore.players = [];
  await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...mock(f) }), /Missing final boxscore/);
});
test('fails closed on score and shot/rebound inconsistencies', async () => {
  let f = fixture(); f.summary.boxscore.players[0].statistics[0].athletes[0].stats[1] = '3';
  await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...mock(f) }), /score disagreement/);
  f = fixture(); f.summary.boxscore.players[0].statistics[0].athletes[0].stats[5] = '1';
  await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...mock(f) }), /Rebounds disagree|totals disagree.*REB/);
});
test('access denial and missing endpoint are never retried', async () => {
  for (const status of [401, 403, 404]) { const m = mock(fixture(), status); await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...m }), /access denied|HTTP 404/); assert.equal(m.calls.length, 1); }
});
test('transient HTTP errors get at most two retries', async () => {
  const m = mock(fixture(), 503); await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...m }), /HTTP 503/); assert.equal(m.calls.length, 3);
});
test('Cup group finals count; Cup championship excluded; semifinal retained', async () => {
  const f = fixture(); f.schedule.events[0].competitions[0].notes = [{ headline: 'NBA Cup - Group Play' }];
  assert.equal((await collectSeason({ season: 2026, asOf, baseline, ...mock(f) })).dataset.games[0].cup, true);
  f.schedule.events[0].competitions[0].notes = [{ headline: 'Emirates NBA Cup - Championship' }];
  const result = await collectSeason({ season: 2026, asOf, baseline, ...mock(f) });
  assert.equal(result.report.completedCollected, 0); assert.deepEqual(result.report.excludedCupFinals, ['123']);
  f.schedule.events[0].competitions[0].notes = [{ headline: 'NBA Cup - Semifinal' }];
  assert.equal((await collectSeason({ season: 2026, asOf, baseline, ...mock(f) })).dataset.games.length, 1);
});
test('ambiguous names remain separate; suffixes retained; uncertain starters null', async () => {
  const f = fixture(); const b = structuredClone(baseline); b.players.push({ ...b.players[0], id: 'duplicate' });
  f.summary.boxscore.players[0].statistics[0].athletes[0].starter = false;
  const result = await collectSeason({ season: 2026, asOf, baseline: b, ...mock(f) });
  assert.equal(result.dataset.playerStats[0].playerId, 'espn:player:10');
  assert.equal(result.dataset.playerStats[0].starter, null);
  b.players = [{ ...baseline.players[0], name: 'Luka Doncic' }];
  assert.equal((await collectSeason({ season: 2026, asOf, baseline: b, ...mock(f) })).dataset.playerStats[0].playerId, 'espn:player:10');
});

test('postseason event metadata determines playoffs despite ESPN global current-season context', async () => {
  const f = fixture(); f.schedule.events[0].seasonType.type = 3; f.summary.header.season.type = 3;
  const fetchImpl = (async (url: string) => new Response(JSON.stringify(url.includes('seasontype=2') ? { season: { year: 2027, type: 2 }, events: [] } : url.includes('seasontype=3') ? f.schedule : f.summary))) as typeof fetch;
  const result = await collectSeason({ season: 2026, asOf, baseline, fetchImpl });
  assert.equal(result.dataset.games[0].competition, 'playoffs');
  assert.equal(result.dataset.coverage.find(c => c.competition === 'playoffs' && c.dataset === 'games')?.observed, 1);
});

test('legacy SAN and ESPN SA resolve to the same canonical team', async () => {
  const f = fixture(), b = structuredClone(baseline); b.teams[1].abbreviation = 'SAN';
  f.schedule.events[0].competitions[0].competitors[1].team.abbreviation = 'SA';
  f.summary.header.competitions[0].competitors[1].team.abbreviation = 'SA';
  f.summary.boxscore.players[1].team.abbreviation = 'SA'; f.summary.boxscore.teams[1].team.abbreviation = 'SA';
  assert.equal((await collectSeason({ season: 2026, asOf, baseline: b, ...mock(f) })).dataset.games[0].awayTeamId, 'nba:1');
});
test('schedule and boxscore disagreement blocks collection', async () => {
  const f = fixture(); f.summary.header.competitions[0].competitors[0].score = '3';
  await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...mock(f) }), /Schedule\/summary score/);
});

test('individual shot sums must match explicit team shooting totals', async () => {
  const f = fixture(); f.summary.boxscore.teams[0].statistics[0].displayValue = '1-2';
  await assert.rejects(collectSeason({ season: 2026, asOf, baseline, ...mock(f) }), /totals disagree/);
});
