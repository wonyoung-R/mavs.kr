import { emptyRecordDataset } from './repository';
import { Competition, RecordDataset, RecordGame, RecordPlayer, RecordPlayerStat, RecordSource, RecordTeam, StatKey, StatValues, STAT_KEYS } from './types';
import { validateRecordDataset } from './validation';
type Raw = Record<string, unknown>;
export interface BalldontliePackage { games: unknown[]; stats: unknown[]; teamStats?: unknown[]; source: RecordSource }
// This adapter is intentionally offline. It never infers unavailable team totals or roster rows.
const object=(v:unknown):Raw=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid offline source object.');return v as Raw;};
function id(v:unknown,kind:string):string {if(!(typeof v==='number'&&Number.isSafeInteger(v)&&v>0)&&!(typeof v==='string'&&/^\d+$/.test(v)&&Number(v)>0))throw new Error('Invalid provider identifier.');return `bdl:${kind}:${v}`;}
function integer(v:unknown,signed=false):number|null{if(v===null||v===undefined||v===''||v==='-'||v==='--'||v==='N/A')return null;if(typeof v!=='number'||!Number.isInteger(v)||(!signed&&v<0))throw new Error('Invalid source statistic.');return v;}
function seconds(v:unknown):number|null {if(v===null||v===undefined||v===''||v==='-'||v==='--')return null;if(typeof v==='number'&&v>=0&&Number.isFinite(v))return Math.round(v*60);if(typeof v==='string'&&/^\d+(?::[0-5]\d)?$/.test(v)){const [m,s='0']=v.split(':');return Number(m)*60+Number(s);}throw new Error('Invalid source playing time.');}
const fields:Partial<Record<StatKey,string>>={PTS:'pts',REB:'reb',AST:'ast',STL:'stl',BLK:'blk',TOV:'turnover',PF:'pf',FGM:'fgm',FGA:'fga',FG3M:'fg3m',FG3A:'fg3a',FTM:'ftm',FTA:'fta',OREB:'oreb',DREB:'dreb',PLUS_MINUS:'plus_minus'};
function stats(row:Raw):StatValues{return Object.fromEntries(STAT_KEYS.map(k=>[k,k==='MIN_SECONDS'?seconds(row.min):integer(row[fields[k]!],k==='PLUS_MINUS')])) as StatValues;}
function text(v:unknown,fallback=''):string{return typeof v==='string'?v:fallback;}
export function importBalldontliePackage(input:unknown):RecordDataset {
 const pack=object(input);if(!Array.isArray(pack.games)||!Array.isArray(pack.stats)||(pack.teamStats!==undefined&&!Array.isArray(pack.teamStats)))throw new Error('Offline package requires games and stats arrays.');
 const source=object(pack.source) as unknown as RecordSource;const sourceValidation=validateRecordDataset({...emptyRecordDataset(),sources:[source]});if(!sourceValidation.valid)throw new Error('Source rights and provenance manifest failed validation.');
 const result=emptyRecordDataset();result.sources=[source];const teams=new Map<string,RecordTeam>(),players=new Map<string,RecordPlayer>();
 const team=(value:unknown)=>{const r=object(value),internal=id(r.id,'team');if(!teams.has(internal))teams.set(internal,{id:internal,abbreviation:text(r.abbreviation),name:text(r.full_name)||`${text(r.city)} ${text(r.name)}`.trim(),nameKo:text(r.name_ko),aliases:Array.isArray(r.aliases)?r.aliases.filter((a):a is string=>typeof a==='string'):[]});return internal;};
 const player=(value:unknown)=>{const r=object(value),internal=id(r.id,'player');if(!players.has(internal))players.set(internal,{id:internal,name:`${text(r.first_name)} ${text(r.last_name)}`.trim()||text(r.name),nameKo:text(r.name_ko),aliases:Array.isArray(r.aliases)?r.aliases.filter((a):a is string=>typeof a==='string'):[]});return internal;};
 for(const value of pack.games){const r=object(value),gameId=id(r.id,'game');const rawStatus=text(r.status_state!==undefined?r.status_state:r.status).toLowerCase();const status:RecordGame['status']=['final','final/ot','final ot','completed'].includes(rawStatus)?'final':rawStatus==='postponed'?'postponed':rawStatus==='cancelled'||rawStatus==='canceled'?'cancelled':rawStatus==='scheduled'||/^\d+:\d+\s*(am|pm)\s*(et)?$/.test(rawStatus)?'scheduled':null;if(!status)throw new Error('Unsupported source game status.');
   let competition:Competition;if(!['regular','playoffs','playin','cup_final','preseason','summer'].includes(text(r.competition)))throw new Error('Explicit reviewed competition annotation is required.');competition=r.competition as Competition;
   if(typeof r.neutral!=='boolean')throw new Error('Explicit reviewed neutral-venue annotation is required.');
   if(r.postseason===true&&competition!=='playoffs')throw new Error('Competition annotation contradicts source postseason metadata.');
   if(r.postseason===false&&competition==='playoffs')throw new Error('Competition annotation contradicts source postseason metadata.');
   const stage=text(r.ist_stage).toLowerCase();if(['championship','final','finals'].includes(stage)&&competition!=='cup_final')throw new Error('Cup championship cannot be included in regular-season totals.');

   const date=text(r.date).slice(0,10);const datetime=typeof r.datetime==='string'&&Number.isFinite(Date.parse(r.datetime))?new Date(r.datetime).toISOString():null;
   result.games.push({id:gameId,season:integer(r.season)!,competition,date,tipoffUtc:datetime,homeTeamId:team(r.home_team),awayTeamId:team(r.visitor_team),neutral:r.neutral===true,status,homeScore:integer(r.home_team_score),awayScore:integer(r.visitor_team_score),sourceId:source.id,sourceGameId:String(r.id),cup:r.cup===true});
 }
 const gameMap=new Map(result.games.map(g=>[g.id,g]));
 for(const value of pack.stats){const r=object(value);const gameRef=object(r.game);const gameId=id(gameRef.id,'game');if(!gameMap.has(gameId))throw new Error('Statistic references a game absent from the supplied ledger.');const values=stats(r);const explicit=text(r.participation).toLowerCase();let participation:RecordPlayerStat['participation'];if(explicit){if(!['played','dnp','inactive','unknown'].includes(explicit))throw new Error('Unsupported participation label.');participation=explicit as RecordPlayerStat['participation'];}else participation=values.MIN_SECONDS!==null&&values.MIN_SECONDS>0?'played':'unknown';
   if(participation==='dnp'||participation==='inactive')for(const key of STAT_KEYS){if(values[key]!==null&&values[key]!==0)throw new Error('Non-playing source row contains nonzero statistics.');values[key]=null;}
   result.playerStats.push({gameId,teamId:team(r.team),playerId:player(r.player),participation,starter:typeof r.starter==='boolean'?r.starter:null,reason:typeof r.reason==='string'?r.reason:null,values,sourceId:source.id});
 }
 for(const value of (pack.teamStats||[]) as unknown[]){const r=object(value);const gameId=id(object(r.game).id,'game');result.teamStats.push({gameId,teamId:team(r.team),values:stats(r),teamRebounds:integer(r.team_rebounds),teamTurnovers:integer(r.team_turnovers),sourceId:source.id});}
 result.teams=[...teams.values()];result.players=[...players.values()];
 for(const g of result.games){for(const dataset of ['games','playerStats','teamStats'] as const){if(result.coverage.some(c=>c.season===g.season&&c.competition===g.competition&&c.dataset===dataset))continue;const gameIds=new Set(result.games.filter(x=>x.season===g.season&&x.competition===g.competition&&x.status==='final').map(x=>x.id));const observed=dataset==='games'?gameIds.size:result[dataset].filter(r=>gameIds.has(r.gameId)).length;result.coverage.push({season:g.season,competition:g.competition,dataset,field:'all',expected:null,observed,status:'unverified',evidence:'Offline supplied subset; historical denominator and DNP completeness unverified.'});}}
 const validation=validateRecordDataset(result);if(!validation.valid)throw new Error('Normalized records failed integrity validation.');return result;
}
