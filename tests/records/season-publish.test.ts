import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertSeasonReplacement, inheritSeasonLayers, seasonContentHash } from '../../src/lib/records/season-publish';
import { emptyRecordDataset } from '../../src/lib/records/repository';

test('unchanged basketball content has stable identity across fetch clocks and ordering',()=>{
  const a=emptyRecordDataset();
  a.sources=[{id:'s',name:'NBA',url:'https://example.com',retrievedAt:'2026-11-13T00:00:00Z',transformVersion:'v1',rights:{storage:true,display:true,commercial:false,evidence:'source'}}];
  a.players=[{id:'b',name:'B',nameKo:'',aliases:[]},{id:'a',name:'A',nameKo:'',aliases:[]}];
  const b=structuredClone(a);
  b.sources[0].retrievedAt='2026-11-14T00:00:00Z';b.players.reverse();
  assert.equal(seasonContentHash(a),seasonContentHash(b));
  b.players[0].name='Correction';
  assert.notEqual(seasonContentHash(a),seasonContentHash(b));
});

test('season replacement retains historical base and every other season',()=>{
  const previous=[{storage_release_id:'base',priority:0,season:null},{storage_release_id:'2026-old',priority:2026,season:2026},{storage_release_id:'2027',priority:2027,season:2027}];
  const next=inheritSeasonLayers(previous,'base',2026,'2026-new');
  assert.deepEqual(next.map(l=>l.storage_release_id),['base','2026-new','2027']);
  assert.equal(previous[1].storage_release_id,'2026-old');
  assert.deepEqual(inheritSeasonLayers(next,'base',2028,'2028').map(l=>l.season),[null,2026,2027,2028]);
});

test('unrelated base and ambiguous priorities fail closed',()=>{
  assert.throws(()=>inheritSeasonLayers([{storage_release_id:'other',season:null,priority:0}],'base',2026,'new'),/historical base/);
  assert.throws(()=>inheritSeasonLayers([{storage_release_id:'base',season:null,priority:2026}],'base',2026,'new'),/priorities/);
});

test('migration retains original physical constraints and exposes all reader relations',()=>{
  const sql=readFileSync(new URL('../../scripts/records/sql/003_release_layers.sql',import.meta.url),'utf8');
  assert.match(sql,/ALTER TABLE records\.%I RENAME TO %I/);
  assert.match(sql,/DISTINCT ON \(l.published_release_id,s.id\)/);
  assert.match(sql,/s.release_id=l.storage_release_id/);
  for(const table of ['sources','teams','players','games','player_game_stats','team_game_stats','coverage','source_artifacts']) assert.ok(sql.includes(`'${table}'`));
  assert.match(sql,/SELECT id,id,0 FROM records.releases/);
  assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM/);
});

test('incomplete crawl cannot erase games or collide with historical IDs',()=>{
  const d=emptyRecordDataset();
  assert.throws(()=>assertSeasonReplacement([{id:'missing',season:2026}],d,2026),/remove/);
  d.games=[{id:'collision',season:2026} as any];
  assert.throws(()=>assertSeasonReplacement([{id:'collision',season:2025}],d,2026),/collides/);
  assert.throws(()=>assertSeasonReplacement([],d,2026),/both team box scores/);
});
