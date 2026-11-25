import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDataset, databaseRows, assertBudget, parseArguments, assertLegacySchemaWritable } from '../../scripts/records/database.mjs';
import { STAT_KEYS } from '../../src/lib/records/types';
import { getRecordsPrisma, readDatabaseCatalog, readDatabaseScope, queryDatabaseRecords } from '../../src/lib/records/database';

function fixture() {
  return { version:1,teams:[{id:'dal',abbreviation:'DAL',name:'Dallas',nameKo:'댈러스',aliases:[]},{id:'nyk',abbreviation:'NYK',name:'New York',nameKo:'뉴욕',aliases:[]}],players:[],
    sources:[{id:'fixture',name:'Synthetic fixture',url:'https://example.com/fixture',retrievedAt:'2026-01-01T00:00:00Z',rights:{storage:true,display:true,commercial:false,evidence:'Synthetic fixture only'},transformVersion:'test'}],
    games:[{id:'g1',season:2010,competition:'regular',date:'2010-11-01',tipoffUtc:null,homeTeamId:'dal',awayTeamId:'nyk',neutral:false,status:'final',homeScore:100,awayScore:90,sourceId:'fixture',sourceGameId:'1',cup:false}],playerStats:[],teamStats:[],coverage:[] };
}
test('identical normalized input yields same immutable release ID and counts',()=>{
  const a=prepareDataset(fixture()),b=prepareDataset(JSON.parse(JSON.stringify(fixture())));
  assert.equal(a.sha256,b.sha256);assert.equal(a.releaseId,b.releaseId);assert.equal(a.counts.games,1);
  const changed=fixture();changed.games[0].homeScore=101;assert.notEqual(prepareDataset(changed).releaseId,a.releaseId);
});
test('invalid source rights fail before any database operation',()=>{
  const invalid=fixture();invalid.sources[0].rights.storage=false;
  assert.throws(()=>prepareDataset(invalid),/validation failed/);
});
test('correction evidence is required and changes the release digest',()=>{
  const original=fixture(),corrected:any=fixture();
  corrected.corrections=[{gameId:'g1',entityType:'game',entityId:'g1',field:'homeScore',previous:99,replacement:100,evidence:'Synthetic official ledger',reason:'Source transcription error'}];
  assert.notEqual(prepareDataset(original).sha256,prepareDataset(corrected).sha256);
  delete corrected.corrections[0].evidence;
  assert.throws(()=>prepareDataset(corrected),/Corrections require/);
});
test('bulk rows retain real zero, null, metadata, and quoted text as values',()=>{
  const values=Object.fromEntries(STAT_KEYS.map(key=>[key,key==='PTS'?0:null]));
  const [row]=databaseRows('player_game_stats',[{gameId:'g1',playerId:"x'); DROP SCHEMA public;--",values,starter:null}]);
  assert.equal(row.pts,0);assert.equal(row.reb,null);assert.equal(row.starter,null);assert.equal(row.player_id,"x'); DROP SCHEMA public;--");
  const [game]=databaseRows('games',[{id:'g1',neutral:null,arenaName:'Reunion Arena'}]);
  assert.equal(game.neutral,null);assert.equal(game.metadata.arenaName,'Reunion Arena');
  assert.throws(()=>databaseRows('public.users',[]),/Unknown/);
});
test('write commands require matching explicit flags; default is read only',()=>{
  assert.equal(parseArguments(['apply']).write,false);assert.equal(parseArguments(['import']).write,false);
  assert.equal(parseArguments(['apply','--apply']).write,true);assert.equal(parseArguments(['import','--import']).write,true);
  assert.throws(()=>parseArguments(['check','--import']),/Unsupported/);
  assert.throws(()=>parseArguments(['import','--max-db-mb','NaN']),/positive/);
});
test('legacy import refuses a layered records schema before any write',async()=>{
  let writes=0;
  const db:any={
    $queryRaw:async()=>[{release_layers_table:'records.release_layers'}],
    $executeRaw:async()=>{writes++;},
  };
  await assert.rejects(assertLegacySchemaWritable(db),/layer|sync/i);
  assert.equal(writes,0);
  db.$queryRaw=async()=>[{release_layers_table:null}];
  await assertLegacySchemaWritable(db);
});
test('free-tier size budgets reject oversized inputs and invalid limits',()=>{
  const mb=1024*1024;assert.equal(assertBudget(100*mb,20*mb,450,150),40*mb);
  assert.throws(()=>assertBudget(430*mb,20*mb,450,150),/budget exceeded/);
  assert.throws(()=>assertBudget(100*mb,80*mb,450,150),/budget exceeded/);
  assert.throws(()=>assertBudget(100*mb,1,NaN,150),/Invalid/);
});
test('a measured storage estimate still respects total and added size budgets',()=>{
  const mb=1024*1024;
  assert.equal(assertBudget(202*mb,153*mb,450,350,180),180*mb);
  assert.throws(()=>assertBudget(300*mb,153*mb,450,350,180),/budget exceeded/);
  assert.throws(()=>assertBudget(202*mb,153*mb,450,150,180),/budget exceeded/);
  for (const value of [NaN,Infinity,0,-1]) assert.throws(()=>assertBudget(0,1,450,350,value),/Invalid storage estimate/);
  assert.equal(parseArguments(['import','--estimated-added-mb','180']).estimatedAddedMb,180);
  assert.throws(()=>parseArguments(['import','--estimated-added-mb','NaN']),/positive/);
});

async function withDatabaseMock(releaseId:string,run:(queries:{text:string;values:unknown[]}[])=>Promise<void>,intercept?:(text:string)=>unknown[]|undefined) {
  const previousUrl=process.env.RECORDS_DATABASE_URL,previousBackend=process.env.RECORDS_DATA_BACKEND;
  process.env.RECORDS_DATABASE_URL='postgresql://fixture:fixture@localhost:55432/records';
  delete process.env.RECORDS_DATA_BACKEND;
  const prisma=getRecordsPrisma();
  const original={transaction:prisma.$transaction,executeRaw:prisma.$executeRaw,queryRaw:prisma.$queryRaw},queries:{text:string;values:unknown[]}[]=[];
  const respond=(query:any)=>{
    const text=query.strings.join('?');queries.push({text,values:query.values});
    const overridden=intercept?.(text);if(overridden!==undefined)return overridden;
    if(text.includes('WITH selected_release AS'))return [{id:releaseId,counts:{games:1,playerStats:1},
      teams:fixture().teams.map(team=>({id:team.id,abbreviation:team.abbreviation,name:team.name,name_ko:team.nameKo,aliases:[]})),
      players:[{id:'dirk',name:'Dirk Nowitzki',name_ko:'노비츠키',aliases:['dirk']}],
      sources:[{id:'fixture',retrieved_at:'2026-01-01T00:00:00+00:00'}],
      coverage:['games','playerStats'].map(dataset=>({season:2010,competition:'regular',dataset,field:'all',expected:1,observed:1,status:'complete',evidence:'Synthetic fixture'})),
      seasons:[2010],
    }];
    if(text.includes('WITH matched_games AS'))return [{total:1,games:[{...fixture().games[0],date:'2010-11-01'}],
      players:[{id:'dirk',name:'Dirk Nowitzki',name_ko:'노비츠키',aliases:[],metadata:{birthdate:'1978-06-19'}}],
      player_stats:[{game_id:'g1',team_id:'dal',player_id:'dirk',participation:'played',pts:30,advanced:{offensiveRating:120}}],team_stats:[],
    }];
    if(text.includes('SELECT id,counts FROM records.releases'))return [{id:releaseId,counts:{games:1,playerStats:1}}];
    if(text.includes('FROM records.teams WHERE'))return fixture().teams.map(team=>({id:team.id,abbreviation:team.abbreviation,name:team.name,name_ko:team.nameKo,aliases:[]}));
    if(text.includes('SELECT p.id,p.name'))return [{id:'dirk',name:'Dirk Nowitzki',name_ko:'노비츠키',aliases:['dirk']}];
    if(text.includes('FROM records.sources'))return [];
    if(text.includes('FROM records.coverage'))return ['games','playerStats'].map(dataset=>({season:2010,competition:'regular',dataset,field:'all',expected:1,observed:1,status:'complete',evidence:'Synthetic fixture'}));
    if(text.includes('DISTINCT season'))return [{season:2010}];
    if(text.includes('SELECT g.*'))return [{...fixture().games[0],id:'g1',date:new Date('2010-11-01')}];
    if(text.includes('FROM records.games g WHERE'))return [{total:1}];
    if(text.includes('SELECT * FROM records.player_game_stats'))return [{game_id:'g1',team_id:'dal',player_id:'dirk',participation:'played',pts:30,advanced:{offensiveRating:120}}];
    if(text.includes('SELECT * FROM records.players WHERE'))return [{id:'dirk',name:'Dirk Nowitzki',name_ko:'노비츠키',aliases:[],metadata:{birthdate:'1978-06-19'}}];
    if(text.includes('SELECT s.*,g.date'))return [];
    if(text.includes('count(DISTINCT s.game_id)'))return [{player_id:null,total:0,games:0,missing:0,sum:null,average:null}];
    if(text.includes('AS missing'))return [{missing:0}];
    if(text.includes("s.participation='unknown'"))return [{total:0}];
    if(text.includes('g.neutral IS NULL'))return [{total:1}];
    throw new Error(`Unexpected mock SQL: ${text}`);
  };
  (prisma as any).$executeRaw=(parts:TemplateStringsArray)=>({kind:'setting',text:parts.join('')});
  (prisma as any).$queryRaw=(query:any)=>({kind:'query',query});
  (prisma as any).$transaction=async(operations:any[])=>{
    assert(Array.isArray(operations),'Reads must not use an interactive transaction timeout');
    assert.equal(operations.length,3);
    assert.deepEqual(operations.slice(0,2),[
      {kind:'setting',text:'SET TRANSACTION READ ONLY'},
      {kind:'setting',text:"SET LOCAL statement_timeout = '5000ms'"},
    ]);
    assert.equal(operations[2].kind,'query');
    return [0,0,respond(operations[2].query)];
  };
  try{await run(queries);}finally{
    (prisma as any).$transaction=original.transaction;(prisma as any).$executeRaw=original.executeRaw;(prisma as any).$queryRaw=original.queryRaw;
    if(previousUrl===undefined)delete process.env.RECORDS_DATABASE_URL;else process.env.RECORDS_DATABASE_URL=previousUrl;
    if(previousBackend===undefined)delete process.env.RECORDS_DATA_BACKEND;else process.env.RECORDS_DATA_BACKEND=previousBackend;
  }
}
test('catalog cache coalesces calls and season scope fetches no box scores',async()=>{
  await withDatabaseMock('fixture-scope',async queries=>{
    const [a,b]=await Promise.all([readDatabaseCatalog('fixture-scope'),readDatabaseCatalog('fixture-scope')]);
    assert.equal(a.releaseId,b.releaseId);assert.equal(a.totalGames,1);
    assert.equal(queries.length,1);
    assert.equal(a.dataset.sources[0].retrievedAt,'2026-01-01T00:00:00.000Z');
    assert(queries[0].text.includes("c.field='all'"));
    queries.length=0;
    const result=await readDatabaseScope({kind:'season',season:2010,releaseId:'fixture-scope',limit:20});
    assert.equal(result.dataset.games.length,1);assert.equal(result.dataset.playerStats.length,0);assert.equal(result.scopeTotal,1);
    assert.equal(queries.length,1);assert(queries.every(query=>!query.text.includes('records.player_game_stats')));
  });
});
test('venue search with unknown neutral status stays incomplete even with full record coverage',async()=>{
  await withDatabaseMock('fixture-neutral',async()=>{
    const result=await queryDatabaseRecords('dirk 2010 regular season home count points','fixture-neutral');
    assert.equal(result.status,'empty');assert.equal(result.incomplete,true);assert.equal(result.summaries[0].value,null);
    assert.equal(result.plan?.venue,'home');
    assert.equal(result.messageKo,'중립 여부를 확인하지 못해 홈·원정 조건으로 확정할 수 없습니다.');
  });
});
test('result cache shares in-flight requests and isolates caller mutations',async()=>{
  await withDatabaseMock('fixture-cached-results',async queries=>{
    const scope={kind:'season' as const,season:2010,releaseId:'fixture-cached-results'};
    const [first,second]=await Promise.all([readDatabaseScope(scope),readDatabaseScope({...scope,limit:200,offset:0})]);
    assert.equal(queries.filter(query=>query.text.includes('SELECT g.*')).length,1);
    first.dataset.games[0].homeScore=999;
    assert.equal(second.dataset.games[0].homeScore,100);
    queries.length=0;
    const again=await readDatabaseScope(scope);
    assert.equal(again.dataset.games[0].homeScore,100);assert.equal(queries.length,0);
  });
});
test('player history omits advanced fields while preserving basic stats and biography',async()=>{
  await withDatabaseMock('fixture-player-history',async()=>{
    const result=await readDatabaseScope({kind:'player',id:'dirk',releaseId:'fixture-player-history'});
    assert.equal(result.dataset.playerStats[0].values.PTS,30);
    assert.equal('advanced' in result.dataset.playerStats[0],false);
    assert.equal((result.dataset.players[0] as any).birthdate,'1978-06-19');
  });
});
test('failed database requests are retried and never cached',async()=>{
  let failed=false;
  await withDatabaseMock('fixture-retry',async queries=>{
    const scope={kind:'season' as const,season:2010,releaseId:'fixture-retry'};
    await assert.rejects(readDatabaseScope(scope),/Temporary query failure/);
    const result=await readDatabaseScope(scope);assert.equal(result.dataset.games.length,1);
    assert.equal(queries.filter(query=>query.text.includes('SELECT g.*')).length,2);
  },text=>{if(text.includes('SELECT g.*')&&!failed){failed=true;throw new Error('Temporary query failure');}return undefined;});
});
test('result cache evicts old keys after its 64 entry bound',async()=>{
  await withDatabaseMock('fixture-cache-eviction',async queries=>{
    for(let season=1980;season<2045;season++) await readDatabaseScope({kind:'season',season,releaseId:'fixture-cache-eviction'});
    queries.length=0;
    await readDatabaseScope({kind:'season',season:1980,releaseId:'fixture-cache-eviction'});
    assert.equal(queries.filter(query=>query.text.includes('SELECT g.*')).length,1);
  });
});
test('equivalent Korean and English questions reuse the normalized-plan cache',async()=>{
  await withDatabaseMock('fixture-language-cache',async queries=>{
    const english=await queryDatabaseRecords('dirk 2010 regular season home count points','fixture-language-cache');
    queries.length=0;
    const korean=await queryDatabaseRecords('노비츠키 2010 정규시즌 홈 경기 수 득점','fixture-language-cache');
    assert.deepEqual(korean.plan,english.plan);assert.equal(queries.length,0);
  });
});
test('a response exceeding the 10 MiB budget is returned without caching',async()=>{
  const payload='x'.repeat(10*1024*1024);
  await withDatabaseMock('fixture-oversized-cache',async queries=>{
    const scope={kind:'season' as const,season:2010,releaseId:'fixture-oversized-cache'};
    await readDatabaseScope(scope);queries.length=0;
    const result=await readDatabaseScope(scope);
    assert.equal(result.dataset.games.length,1);
    assert.equal(queries.filter(query=>query.text.includes('SELECT g.*')).length,1);
  },text=>text.includes('SELECT g.*')?[{total:1,games:[{...fixture().games[0],metadata:{payload}}]}]:undefined);
});
test('an empty page preserves the full matched count without loading unrelated records',async()=>{
  await withDatabaseMock('fixture-empty-page',async queries=>{
    const result=await readDatabaseScope({kind:'player',id:'dirk',releaseId:'fixture-empty-page',offset:1000});
    assert.equal(result.status,'empty');assert.equal(result.scopeTotal,501);
    assert.deepEqual(result.dataset.games,[]);assert.deepEqual(result.dataset.playerStats,[]);
    const scopes=queries.filter(query=>query.text.includes('WITH matched_games AS'));
    assert.equal(scopes.length,1);assert(scopes[0].values.includes(1000));
  },text=>text.includes('WITH matched_games AS')?[{total:501,games:[],players:[],player_stats:[]}]:undefined);
});
test('a game scope retains DNP rows, source metadata, and advanced position clues in one query',async()=>{
  await withDatabaseMock('fixture-game-payload',async queries=>{
    const result=await readDatabaseScope({kind:'game',id:'g1',releaseId:'fixture-game-payload'});
    assert.equal(result.dataset.playerStats[0].participation,'dnp');
    assert.equal(result.dataset.playerStats[0].values.PTS,null);
    assert.deepEqual((result.dataset.playerStats[0] as any).advanced,{position:'F',source:{startingPosition:'SF'}});
    assert.equal((result.dataset.players[0] as any).position,'F');
    assert.equal(result.dataset.games[0].tipoffUtc,'2010-11-02T01:00:00.000Z');
    assert.equal(queries.filter(query=>query.text.includes('WITH matched_games AS')).length,1);
  },text=>text.includes('WITH matched_games AS')?[{total:1,games:[{...fixture().games[0],tipoff_utc:'2010-11-02T01:00:00+00:00'}],
    players:[{id:'dirk',name:'Dirk Nowitzki',name_ko:'노비츠키',aliases:[],metadata:{position:'F'}}],
    player_stats:[{game_id:'g1',team_id:'dal',player_id:'dirk',participation:'dnp',pts:null,advanced:{position:'F',source:{startingPosition:'SF'}}}],team_stats:[],
  }]:undefined);
});
test('a missing pinned release stays empty and never selects the current release',async()=>{
  await withDatabaseMock('fixture-missing-release',async queries=>{
    const result=await readDatabaseCatalog('fixture-missing-release');
    assert.equal(result.status,'empty');assert.equal(result.releaseId,null);
    assert.equal(queries.length,1);
    assert(queries[0].values.includes('fixture-missing-release'));
    assert(!queries[0].text.includes('records.current_release'));
  },text=>text.includes('WITH selected_release AS')?[]:undefined);
});
test('scoped identifiers and filters remain bound values with a 200 game limit',async()=>{
  await withDatabaseMock('fixture-bound-scope',async queries=>{
    const hostileId="x'); DROP SCHEMA public;--";
    await readDatabaseScope({kind:'player',id:hostileId,opponentId:'nyk',season:2010,releaseId:'fixture-bound-scope',limit:9999,offset:-10});
    const scope=queries.find(query=>query.text.includes('WITH matched_games AS'))!;
    assert(!scope.text.includes(hostileId));assert(scope.values.includes(hostileId));
    assert(scope.values.includes('nyk'));assert(scope.values.includes(2010));
    assert(scope.values.includes(200));assert(scope.values.includes(0));assert(!scope.values.includes(9999));
  });
});
