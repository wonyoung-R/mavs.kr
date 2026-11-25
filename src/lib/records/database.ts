import { Prisma, PrismaClient } from '@prisma/client';
import { getRecordsDatabaseUrl } from './connection';
import { parseQuery } from './query';
import { STAT_KEYS, type Competition, type DatasetReadResult, type QueryResult, type QueryRow, type RecordDataset, type StatKey, type StatValues } from './types';

type Row = Record<string, any>;
const recordsGlobal=globalThis as unknown as {mavsRecordsPrisma?:{url:string;client:PrismaClient}};
export function getRecordsPrisma(): PrismaClient {
  const url=getRecordsDatabaseUrl();
  if(!url)throw new Error('RECORDS_DATABASE_URL is required for database record reads.');
  if(recordsGlobal.mavsRecordsPrisma?.url!==url) {
    recordsGlobal.mavsRecordsPrisma={url,client:new PrismaClient({datasources:{db:{url}},log:[]})};
  }
  return recordsGlobal.mavsRecordsPrisma.client;
}
export type DatabaseSnapshot = DatasetReadResult & { releaseId:string|null;availableSeasons:number[];totalGames:number;scopeTotal?:number;dalPlayerIds:string[];totalPlayerStatRows?:number;venueClassifiedGames?:number };
export type DatabaseFilters = {season?:number;competition?:Competition;venue?:'home'|'away'|'neutral';opponentId?:string;releaseId?:string};
export type DatabaseScope = DatabaseFilters & {kind:'game'|'season'|'player';id?:string;offset?:number;limit?:number;releaseId?:string};
const blank = ():RecordDataset=>({version:1,teams:[],players:[],games:[],playerStats:[],teamStats:[],coverage:[],sources:[]});
const empty = ():DatabaseSnapshot=>({status:'empty',dataset:blank(),releaseId:null,availableSeasons:[],totalGames:0,dalPlayerIds:[]});
export function isRecordsDatabaseConfigured(env:Record<string,string|undefined>=process.env):boolean { return Boolean(getRecordsDatabaseUrl(env))&&env.RECORDS_DATA_BACKEND!=='local'; }
const catalogCache=new Map<string,{expires:number;promise:Promise<DatabaseSnapshot>}>();
type CachedResult={expires:number;bytes:number;promise:Promise<unknown>};
const resultCache=new Map<string,CachedResult>();
const MAX_RESULT_BYTES=10*1024*1024,MAX_RESULT_ENTRIES=64;
let resultCacheBytes=0;

function removeCachedResult(key:string):void {
  const entry=resultCache.get(key);
  if(entry)resultCacheBytes-=entry.bytes;
  resultCache.delete(key);
}
async function cachedResult<T>(key:string,load:()=>Promise<T>):Promise<T> {
  const previous=resultCache.get(key);
  if(previous&&previous.expires>Date.now()) {
    resultCache.delete(key);resultCache.set(key,previous);
    return structuredClone(await previous.promise) as T;
  }
  removeCachedResult(key);
  const entry:CachedResult={expires:Date.now()+300000,bytes:0,promise:Promise.resolve().then(load)};
  resultCache.set(key,entry);
  while(resultCache.size>MAX_RESULT_ENTRIES)removeCachedResult(resultCache.keys().next().value!);
  try {
    const result=await entry.promise;
    if(resultCache.get(key)===entry) {
      const bytes=Buffer.byteLength(JSON.stringify(result));
      if(bytes>MAX_RESULT_BYTES)removeCachedResult(key);
      else {
        entry.bytes=bytes;entry.expires=Date.now()+300000;resultCacheBytes+=bytes;
        while(resultCacheBytes>MAX_RESULT_BYTES)removeCachedResult(resultCache.keys().next().value!);
      }
    }
    return structuredClone(result) as T;
  } catch(error) {if(resultCache.get(key)===entry)removeCachedResult(key);throw error;}
}

function normalizedFilters(filters:DatabaseFilters,releaseId:string):DatabaseFilters {
  return {releaseId,season:filters.season,competition:filters.competition,venue:filters.venue,opponentId:filters.opponentId};
}
const readDb={
  $queryRaw:async <T=unknown>(statement:Prisma.Sql|TemplateStringsArray,...values:unknown[]):Promise<T>=>{
    const prisma=getRecordsPrisma();
    const query=Array.isArray(statement)?Prisma.sql(statement as TemplateStringsArray,...values):statement as Prisma.Sql;
    // These reads need no application code between statements. A fixed batch
    // keeps the read-only/SQL time limits without an interactive transaction
    // clock also expiring during remote connection and result-transfer delays.
    const [, , result]=await prisma.$transaction([
      prisma.$executeRaw`SET TRANSACTION READ ONLY`,
      prisma.$executeRaw`SET LOCAL statement_timeout = '5000ms'`,
      prisma.$queryRaw<T>(query),
    ]);
    return result;
  },
};

function decode(row:Row):Row {
  const result:Row={};
  for(const [key,value] of Object.entries(row)) {
    if(key==='release_id') continue;
    const timestamp=value instanceof Date?value:typeof value==='string'&&(key==='retrieved_at'||key==='tipoff_utc')?new Date(value):null;
    result[key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase())]=timestamp?(key==='date'?timestamp.toISOString().slice(0,10):timestamp.toISOString()):value;
  }
  if(result.metadata) {for(const [key,value] of Object.entries(result.metadata)) if(!(key in result)) result[key]=value;delete result.metadata;}
  return result;
}
function statRow(row:Row):Row {
  const result=decode(row),values:Row={};
  for(const stat of STAT_KEYS) {values[stat]=row[stat.toLowerCase()];delete result[stat.toLowerCase().replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase())];}
  return {...result,values};
}
function basicStatRow(row:Row):Row {const result=statRow(row);delete result.advanced;return result;}
function combine(conditions:Prisma.Sql[]):Prisma.Sql { return Prisma.join(conditions,' AND '); }
function gameFilters(filters:DatabaseFilters, dalId:string, teamExpression:Prisma.Sql=Prisma.sql`s.team_id`):Prisma.Sql[] {
  const result:Prisma.Sql[]=[];
  if(filters.season!==undefined) result.push(Prisma.sql`g.season=${filters.season}`);
  if(filters.competition) result.push(Prisma.sql`g.competition=${filters.competition}`);
  if(filters.opponentId) result.push(Prisma.sql`CASE WHEN g.home_team_id=${dalId} THEN g.away_team_id ELSE g.home_team_id END=${filters.opponentId}`);
  if(filters.venue==='neutral') result.push(Prisma.sql`g.neutral=true`);
  if(filters.venue==='home') result.push(Prisma.sql`g.neutral=false AND g.home_team_id=${teamExpression}`);
  if(filters.venue==='away') result.push(Prisma.sql`g.neutral=false AND g.away_team_id=${teamExpression}`);
  return result;
}
function statColumn(stat:StatKey):Prisma.Sql {
  if(!STAT_KEYS.includes(stat)) throw new Error('Unsupported statistic.');
  return Prisma.raw(`s.${stat.toLowerCase()}`);
}

export async function readDatabaseCatalog(releaseId?:string):Promise<DatabaseSnapshot> {
  const key=releaseId??'current',cached=catalogCache.get(key);
  if(cached&&cached.expires>Date.now()) return structuredClone(await cached.promise);
  const promise=loadDatabaseCatalog(releaseId);
  catalogCache.set(key,{expires:Date.now()+60000,promise});
  while(catalogCache.size>4) catalogCache.delete(catalogCache.keys().next().value!);
  try {
    const result=await promise;
    if(result.releaseId) catalogCache.set(result.releaseId,{expires:Date.now()+60000,promise});
    while(catalogCache.size>4) catalogCache.delete(catalogCache.keys().next().value!);
    return structuredClone(result);
  } catch(error) {if(catalogCache.get(key)?.promise===promise)catalogCache.delete(key);throw error;}
}

async function loadDatabaseCatalog(releaseId?:string):Promise<DatabaseSnapshot> {
  // One SQL response avoids six separately protected remote transactions.
  // The selected release anchors every subquery to the same immutable dataset.
  const selection=releaseId?Prisma.sql`SELECT id,counts FROM records.releases WHERE id=${releaseId}`:Prisma.sql`SELECT r.id,r.counts FROM records.current_release c JOIN records.releases r ON r.id=c.release_id WHERE c.singleton=true`;
  const releases=await readDb.$queryRaw<Row[]>(Prisma.sql`
    WITH selected_release AS (${selection})
    SELECT r.id,r.counts,
      (SELECT count(*)::integer FROM records.games WHERE release_id=r.id AND neutral IS NOT NULL) AS venue_classified_games,
      COALESCE((SELECT jsonb_agg(t ORDER BY t.abbreviation) FROM
        (SELECT id,abbreviation,name,name_ko,aliases FROM records.teams WHERE release_id=r.id) t),'[]'::jsonb) AS teams,
      COALESCE((SELECT jsonb_agg(p ORDER BY p.name) FROM
        (SELECT p.id,p.name,p.name_ko,p.aliases FROM records.players p WHERE p.release_id=r.id
          AND EXISTS (SELECT 1 FROM records.player_game_stats s JOIN records.teams t ON t.release_id=s.release_id AND t.id=s.team_id
            WHERE s.release_id=p.release_id AND s.player_id=p.id AND t.abbreviation='DAL')) p),'[]'::jsonb) AS players,
      COALESCE((SELECT jsonb_agg(s ORDER BY s.id) FROM records.sources s WHERE s.release_id=r.id),'[]'::jsonb) AS sources,
      COALESCE((SELECT jsonb_agg(c ORDER BY c.season,c.competition,c.dataset) FROM records.coverage c WHERE c.release_id=r.id AND c.field='all'),'[]'::jsonb) AS coverage,
      COALESCE((SELECT jsonb_agg(s.season ORDER BY s.season DESC) FROM
        (SELECT DISTINCT season FROM records.games WHERE release_id=r.id) s),'[]'::jsonb) AS seasons
    FROM selected_release r`);
  if(!releases.length) return empty();
  const release=releases[0];
  const {teams,players,sources,coverage,seasons}=release as {teams:Row[];players:Row[];sources:Row[];coverage:Row[];seasons:number[]};
  return {status:'ready',releaseId:release.id,venueClassifiedGames:release.venue_classified_games,totalGames:release.counts.games,totalPlayerStatRows:release.counts.playerStats,availableSeasons:seasons,dalPlayerIds:players.map(row=>row.id),dataset:{...blank(),teams:teams.map(decode),players:players.map(decode),sources:sources.map(decode),coverage:coverage.map(decode)} as RecordDataset};
}

export async function readDatabaseScope(scope:DatabaseScope):Promise<DatabaseSnapshot> {
  const catalog=await readDatabaseCatalog(scope.releaseId);if(!catalog.releaseId)return catalog;
  const pinned:DatabaseScope={...normalizedFilters(scope,catalog.releaseId),kind:scope.kind,id:scope.id,
    offset:Math.max(0,Number.isFinite(scope.offset)?Math.trunc(scope.offset!):0),
    limit:Math.max(1,Math.min(200,Number.isFinite(scope.limit)?Math.trunc(scope.limit!):200))};
  // A game ID identifies its complete box score, independently of list filters.
  if(pinned.kind==='game'){delete pinned.season;delete pinned.competition;delete pinned.venue;delete pinned.opponentId;}
  return cachedResult(JSON.stringify(['scope',pinned]),()=>loadDatabaseScope(pinned));
}

async function loadDatabaseScope(scope:DatabaseScope):Promise<DatabaseSnapshot> {
  const catalog=await readDatabaseCatalog(scope.releaseId),id=catalog.releaseId;
  if(!id) return catalog;
  const dalId=catalog.dataset.teams.find(team=>team.abbreviation==='DAL')?.id;
  if(!dalId) return empty();
  const conditions=[Prisma.sql`g.release_id=${id}`,...(scope.kind==='game'?[]:gameFilters(scope,dalId,Prisma.sql`${dalId}`))];
  if(scope.kind==='game') conditions.push(Prisma.sql`g.id=${scope.id??''}`);
  if(scope.kind==='player') conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM records.player_game_stats s WHERE s.release_id=g.release_id AND s.game_id=g.id AND s.player_id=${scope.id??''} AND s.team_id=${dalId})`);
  const limit=Math.max(1,Math.min(200,Number.isFinite(scope.limit)?Math.trunc(scope.limit!):200));
  const offset=Math.max(0,Number.isFinite(scope.offset)?Math.trunc(scope.offset!):0);
  const playerFilter=scope.kind==='player'?Prisma.sql`AND s.player_id=${scope.id??''} AND s.team_id=${dalId}`:Prisma.empty;
  const details=scope.kind==='season'?Prisma.empty:Prisma.sql`,
    COALESCE((SELECT jsonb_agg(p ORDER BY p.name) FROM records.players p WHERE p.release_id=${id} AND
      ${scope.kind==='player'?Prisma.sql`p.id=${scope.id??''}`:Prisma.sql`EXISTS (SELECT 1 FROM records.player_game_stats s WHERE s.release_id=p.release_id AND s.player_id=p.id AND s.game_id IN (SELECT id FROM selected_games))`}
    ),'[]'::jsonb) AS players,
    COALESCE((SELECT jsonb_agg(${scope.kind==='player'?Prisma.sql`to_jsonb(s)-'advanced'`:Prisma.sql`to_jsonb(s)`}) FROM records.player_game_stats s
      WHERE s.release_id=${id} AND s.game_id IN (SELECT id FROM selected_games) ${playerFilter}),'[]'::jsonb) AS player_stats
    ${scope.kind==='game'?Prisma.sql`,COALESCE((SELECT jsonb_agg(s) FROM records.team_game_stats s WHERE s.release_id=${id} AND s.game_id IN (SELECT id FROM selected_games)),'[]'::jsonb) AS team_stats`:Prisma.empty}`;
  // Matching and pagination stay in SQL, including the count for empty pages.
  // Box scores share the bounded selected_games CTE instead of a second trip.
  const [result]=await readDb.$queryRaw<Row[]>(Prisma.sql`
    WITH matched_games AS MATERIALIZED (SELECT g.* FROM records.games g WHERE ${combine(conditions)}),
      selected_games AS (SELECT * FROM matched_games ORDER BY date DESC,id DESC LIMIT ${limit} OFFSET ${offset})
    SELECT (SELECT count(*)::integer FROM matched_games) AS total,
      COALESCE((SELECT jsonb_agg(g ORDER BY g.date DESC,g.id DESC) FROM selected_games g),'[]'::jsonb) AS games
      ${details}`);
  const games:Row[]=result.games;
  if(!games.length) return {...catalog,status:'empty',scopeTotal:result.total};
  if(scope.kind==='season') return {...catalog,scopeTotal:result.total,dataset:{...catalog.dataset,games:games.map(decode)} as RecordDataset};
  const players:Row[]=result.players,playerStats:Row[]=result.player_stats;
  if(scope.kind==='player') {
    const updatedPlayers=catalog.dataset.players.map(player=>player.id===scope.id&&players.length?decode(players[0]):player);
    return {...catalog,scopeTotal:result.total,dataset:{...catalog.dataset,players:updatedPlayers,games:games.map(decode),playerStats:playerStats.map(basicStatRow)} as RecordDataset};
  }
  const teamStats:Row[]=result.team_stats;
  const allPlayers=new Map([...catalog.dataset.players,...players.map(decode)].map(player=>[player.id,player]));
  return {...catalog,scopeTotal:result.total,dataset:{...catalog.dataset,players:[...allPlayers.values()],games:games.map(decode),playerStats:playerStats.map(statRow),teamStats:teamStats.map(statRow)} as RecordDataset};
}

function baseStats(catalog:DatabaseSnapshot,filters:DatabaseFilters,playerIds:string[]=[]):Prisma.Sql[] {
  const dalId=catalog.dataset.teams.find(team=>team.abbreviation==='DAL')?.id??'';
  return [Prisma.sql`s.release_id=${catalog.releaseId}`,Prisma.sql`s.team_id=${dalId}`,Prisma.sql`g.status='final'`,Prisma.sql`s.participation='played'`,...gameFilters(filters,dalId),...(playerIds.length?[Prisma.sql`s.player_id IN (${Prisma.join(playerIds)})`]:[])];
}
const joinGames=Prisma.sql`FROM records.player_game_stats s JOIN records.games g ON g.release_id=s.release_id AND g.id=s.game_id`;

export async function readDatabaseLeaderboard(filters:DatabaseFilters&{stat:StatKey}):Promise<{playerId:string;games:number;known:number;value:number|null}[]> {
  const catalog=await readDatabaseCatalog(filters.releaseId);if(!catalog.releaseId)return [];
  const pinned={...normalizedFilters(filters,catalog.releaseId),stat:filters.stat};
  return cachedResult(JSON.stringify(['leaderboard',pinned]),()=>loadDatabaseLeaderboard(pinned));
}
async function loadDatabaseLeaderboard(filters:DatabaseFilters&{stat:StatKey}):Promise<{playerId:string;games:number;known:number;value:number|null}[]> {
  const catalog=await readDatabaseCatalog(filters.releaseId);if(!catalog.releaseId)return [];
  const stat=statColumn(filters.stat);
  return readDb.$queryRaw(Prisma.sql`SELECT s.player_id AS "playerId",count(*)::integer AS games,count(${stat})::integer AS known,CASE WHEN count(*)=count(${stat}) THEN sum(${stat})::double precision ELSE NULL END AS value ${joinGames} WHERE ${combine(baseStats(catalog,filters))} GROUP BY s.player_id ORDER BY value DESC NULLS LAST,s.player_id`);
}
export async function readDatabaseComparison(filters:DatabaseFilters&{playerIds:string[]}):Promise<{playerId:string;games:number;values:StatValues;known:Partial<Record<StatKey,number>>}[]> {
  if(!filters.playerIds.length||filters.playerIds.length>20)return [];
  const catalog=await readDatabaseCatalog(filters.releaseId);if(!catalog.releaseId)return [];
  const pinned={...normalizedFilters(filters,catalog.releaseId),playerIds:[...new Set(filters.playerIds)].sort()};
  return cachedResult(JSON.stringify(['comparison',pinned]),()=>loadDatabaseComparison(pinned));
}
async function loadDatabaseComparison(filters:DatabaseFilters&{playerIds:string[]}):Promise<{playerId:string;games:number;values:StatValues;known:Partial<Record<StatKey,number>>}[]> {
  if(!filters.playerIds.length||filters.playerIds.length>20) return [];
  const catalog=await readDatabaseCatalog(filters.releaseId);if(!catalog.releaseId)return [];
  const expressions=STAT_KEYS.flatMap(stat=>{const column=statColumn(stat);return [Prisma.sql`${stat}::text,CASE WHEN count(*)=count(${column}) THEN avg(${column})::double precision ELSE NULL END`];});
  const known=STAT_KEYS.map(stat=>Prisma.sql`${stat}::text,count(${statColumn(stat)})::integer`);
  return readDb.$queryRaw(Prisma.sql`SELECT s.player_id AS "playerId",count(*)::integer AS games,jsonb_build_object(${Prisma.join(expressions)}) AS values,jsonb_build_object(${Prisma.join(known)}) AS known ${joinGames} WHERE ${combine(baseStats(catalog,filters,filters.playerIds))} GROUP BY s.player_id`);
}

export async function queryDatabaseRecords(query:string,releaseId?:string):Promise<QueryResult> {
  const catalog=await readDatabaseCatalog(releaseId),parsed=parseQuery(query,catalog.dataset);
  if(parsed.status!=='ok')return {...parsed,rows:[],summaries:[],total:0,coverage:[],incomplete:true};
  if(!catalog.releaseId)return {status:'empty',plan:parsed.plan,rows:[],summaries:[],total:0,coverage:[],incomplete:true};
  return cachedResult(JSON.stringify(['query',catalog.releaseId,parsed.plan]),()=>loadQueryDatabaseRecords(query,catalog.releaseId!));
}
async function loadQueryDatabaseRecords(query:string,releaseId:string):Promise<QueryResult> {
  const catalog=await readDatabaseCatalog(releaseId),parsed=parseQuery(query,catalog.dataset);
  if(parsed.status!=='ok')return {...parsed,rows:[],summaries:[],total:0,coverage:[],incomplete:true};
  const plan=parsed.plan;
  let coverage=catalog.dataset.coverage.filter(c=>(plan.season===undefined||c.season===plan.season)&&c.competition===plan.competition);
  if(!catalog.releaseId)return {status:'empty',plan,rows:[],summaries:[],total:0,coverage,incomplete:true};
  const coverageRows=await readDb.$queryRaw<Row[]>(Prisma.sql`SELECT * FROM records.coverage WHERE release_id=${catalog.releaseId} AND competition=${plan.competition} AND (field='all' OR field=${plan.stat}) ${plan.season!==undefined?Prisma.sql`AND season=${plan.season}`:Prisma.empty}`);
  coverage=coverageRows.map(decode) as typeof coverage;
  const base=baseStats(catalog,plan,plan.playerIds),filtered=[...base],column=statColumn(plan.stat);
  if(plan.threshold){const operators={gte:'>=',gt:'>',lte:'<=',lt:'<',eq:'='};filtered.push(Prisma.sql`${column} ${Prisma.raw(operators[plan.threshold.operator])} ${plan.threshold.value}`);}
  const [rows,aggregate,missing]=await Promise.all([
    readDb.$queryRaw<Row[]>(Prisma.sql`SELECT s.*,g.date,g.season,g.competition,g.neutral,g.home_team_id,g.away_team_id,p.name AS player_name,p.name_ko AS player_name_ko ${joinGames} JOIN records.players p ON p.release_id=s.release_id AND p.id=s.player_id WHERE ${combine(filtered)} ORDER BY ${column} ${Prisma.raw(plan.direction==='asc'?'ASC':'DESC')} NULLS LAST,g.date,s.player_id LIMIT ${plan.limit}`),
    readDb.$queryRaw<Row[]>(Prisma.sql`SELECT ${plan.aggregation==='compare'?Prisma.sql`s.player_id`:Prisma.sql`NULL::text`} AS player_id,count(*)::integer AS total,count(DISTINCT s.game_id)::integer AS games,count(*) FILTER(WHERE ${column} IS NULL)::integer AS missing,sum(${column})::double precision AS sum,avg(${column})::double precision AS average ${joinGames} WHERE ${combine(filtered)} ${plan.aggregation==='compare'?Prisma.sql`GROUP BY s.player_id`:Prisma.empty}`),
    readDb.$queryRaw<Row[]>(Prisma.sql`SELECT count(*) FILTER(WHERE ${column} IS NULL)::integer AS missing ${joinGames} WHERE ${combine(base)}`),
  ]);
  const unknown=await readDb.$queryRaw<Row[]>(Prisma.sql`SELECT count(*)::integer AS total ${joinGames} WHERE ${combine(base.filter((_,index)=>index!==3))} AND s.participation='unknown'`);
  const unknownVenue=plan.venue?await readDb.$queryRaw<Row[]>(Prisma.sql`SELECT count(*)::integer AS total ${joinGames} WHERE ${combine(baseStats(catalog,{...plan,venue:undefined},plan.playerIds))} AND g.neutral IS NULL`):[{total:0}];
  const complete=plan.season!==undefined&&coverage.some(c=>c.dataset==='games'&&c.status==='complete'&&c.field==='all')&&coverage.some(c=>c.dataset==='playerStats'&&c.status==='complete'&&(c.field===plan.stat||c.field==='all'))&&!unknown[0].total&&!unknownVenue[0].total;
  const summaries=plan.aggregation==='games'?[]:(plan.aggregation==='compare'?plan.playerIds:[null]).map(playerId=>{
    const item=aggregate.find(row=>row.player_id===playerId)??{games:0,total:0,missing:0,sum:null,average:null};
    return {playerId,label:playerId?catalog.dataset.players.find(player=>player.id===playerId)?.name??playerId:plan.aggregation,games:item.games,missing:item.missing,value:plan.aggregation==='count'?(!complete||missing[0].missing?null:item.games):item.missing?null:plan.aggregation==='sum'?item.sum:item.average};
  });
  const decoded=rows.map(row=>{const mapped=statRow(row);return {gameId:mapped.gameId,date:mapped.date,season:mapped.season,competition:mapped.competition,playerId:mapped.playerId,playerName:mapped.playerName,playerNameKo:mapped.playerNameKo,teamId:mapped.teamId,opponentId:mapped.homeTeamId===mapped.teamId?mapped.awayTeamId:mapped.homeTeamId,venue:mapped.neutral===null?'unknown':mapped.neutral?'neutral':mapped.homeTeamId===mapped.teamId?'home':'away',values:mapped.values} as QueryRow;});
  const total=aggregate.reduce((sum,row)=>sum+row.total,0);
  const venueUncertain=!total&&unknownVenue[0].total>0;
  return {status:total?'ready':'empty',plan,rows:decoded,summaries,total,coverage,incomplete:!complete||missing[0].missing>0,
    ...(venueUncertain?{message:'Unknown neutral-court status prevents confirming the requested venue condition.',messageKo:'중립 여부를 확인하지 못해 홈·원정 조건으로 확정할 수 없습니다.'}:{})};
}
