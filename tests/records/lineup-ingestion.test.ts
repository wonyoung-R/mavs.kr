import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseRows } from '../../scripts/records/database.mjs';
import { validateRecordDataset } from '../../src/lib/records/validation';
import { emptyRecordDataset } from '../../src/lib/records/repository';
import { STAT_KEYS, type StatValues } from '../../src/lib/records/types';

test('source G/F/C positions survive database mapping without becoming an advanced metric', () => {
  for (const starterPosition of ['G', 'F', 'C', null]) {
    const [row] = databaseRows('player_game_stats', [{ starterPosition, starter: starterPosition !== null, advanced: { offensiveRating: 120 } }]);
    assert.equal(row.starter_position, starterPosition);
    assert.deepEqual(row.advanced, { offensiveRating: 120 });
  }
});

test('ingestion rejects invented positions and accepts legacy missing positions', () => {
  const d = emptyRecordDataset();
  d.teams = ['dal', 'chi'].map(id => ({id, abbreviation: id.toUpperCase(), name:id, nameKo:'', aliases:[]}));
  d.players = [{id:'p', name:'Player', nameKo:'', aliases:[]}];
  d.sources = [{id:'s', name:'Source', url:'https://example.com/data', retrievedAt:'2026-01-01T00:00:00Z', rights:{storage:true,display:true,commercial:false,evidence:'Fixture'}, transformVersion:'fixture'}];
  d.games = [{id:'g',season:2025,competition:'regular',date:'2026-04-12',tipoffUtc:null,homeTeamId:'dal',awayTeamId:'chi',neutral:null,status:'final',homeScore:149,awayScore:128,sourceId:'s',sourceGameId:'g',cup:false}];
  d.playerStats = [{gameId:'g',teamId:'dal',playerId:'p',participation:'played',starter:true,reason:null,sourceId:'s',values:Object.fromEntries(STAT_KEYS.map(key=>[key,null])) as StatValues}];
  assert.equal(validateRecordDataset(d).valid, true);
  d.playerStats[0].starterPosition = 'G';
  assert.equal(validateRecordDataset(d).valid, true);
  (d.playerStats[0] as any).starterPosition = 'PG';
  assert.equal(validateRecordDataset(d).valid, false);
});
