import { RecordDataset, STAT_KEYS } from './types';
const competitions=['regular','playoffs','playin','cup_final','preseason','summer'];
function validateInternal(input: unknown): { valid: boolean; errors: string[] } {
  const errors:string[]=[]; const fail=(m:string)=>errors.push(m);
  if(!input||typeof input!=='object') return {valid:false,errors:['Dataset must be an object.']};
  const d=input as RecordDataset;
  if(d.version!==1)fail('Unsupported dataset version.');
  for(const name of ['teams','players','games','playerStats','teamStats','coverage','sources'] as const)if(!Array.isArray(d[name]))fail(`${name} must be an array.`);
  if(errors.length)return {valid:false,errors};
  const ids=(rows:{id:string}[],label:string)=>{const result=new Set<string>();for(const r of rows){if(!r||typeof r.id!=='string'||!r.id.trim()||result.has(r.id))fail(`${label}: missing or duplicate ID.`);else result.add(r.id);}return result;};
  const teams=ids(d.teams,'teams'),players=ids(d.players,'players'),games=ids(d.games,'games'),sources=ids(d.sources,'sources');
  const dal=d.teams.filter(t=>t?.abbreviation==='DAL'); if(d.games.length&&dal.length!==1)fail('Exactly one DAL team is required.');
  for(const t of d.teams)if(!t||typeof t.name!=='string'||typeof t.nameKo!=='string'||!Array.isArray(t.aliases)||t.aliases.some(a=>typeof a!=='string')||typeof t.abbreviation!=='string')fail('Invalid team metadata.');
  for(const p of d.players)if(!p||typeof p.name!=='string'||typeof p.nameKo!=='string'||!Array.isArray(p.aliases)||p.aliases.some(a=>typeof a!=='string'))fail('Invalid player metadata.');
  for(const s of d.sources){if(!s||!s.rights||s.rights.storage!==true||s.rights.display!==true||!s.rights.evidence?.trim()||typeof s.rights.commercial!=='boolean')fail('Source requires evidenced storage and display rights.');if(!s||typeof s.url!=='string'||!safeSourceUrl(s.url)||!Number.isFinite(Date.parse(s.retrievedAt))||!s.transformVersion)fail('Invalid source provenance.');}
  const gameMap=new Map(d.games.filter(Boolean).map(g=>[g.id,g]));const external=new Set<string>();
  for(const g of d.games){if(!g)continue;
    if(!Number.isInteger(g.season)||g.season<1980||g.season>2100||!competitions.includes(g.competition))fail(`Invalid season or competition: ${g.id}`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(g.date)||!Number.isFinite(Date.parse(g.date))||new Date(g.date).toISOString().slice(0,10)!==g.date)fail(`Invalid game date: ${g.id}`);
    if(!teams.has(g.homeTeamId)||!teams.has(g.awayTeamId)||g.homeTeamId===g.awayTeamId||!dal.some(t=>t.id===g.homeTeamId||t.id===g.awayTeamId))fail(`Game must contain DAL and two distinct known teams: ${g.id}`);
    if(!sources.has(g.sourceId)||typeof g.sourceGameId!=='string'||!g.sourceGameId)fail(`Missing source ID: ${g.id}`);
    const key=`${g.sourceId}:${g.sourceGameId}`;if(external.has(key))fail(`Duplicate source game ID: ${key}`);external.add(key);
    if((g.neutral!==null&&typeof g.neutral!=='boolean')||typeof g.cup!=='boolean'||!['final','scheduled','postponed','cancelled'].includes(g.status))fail(`Invalid game status: ${g.id}`);
    for(const v of [g.homeScore,g.awayScore])if(v!==null&&(!Number.isInteger(v)||v<0))fail(`Invalid score: ${g.id}`);
    if(g.status==='final'&&(g.homeScore===null||g.awayScore===null||g.homeScore===g.awayScore))fail(`Final requires distinct known scores: ${g.id}`);
    if(g.tipoffUtc!==null&&(typeof g.tipoffUtc!=='string'||!g.tipoffUtc.endsWith('Z')||!Number.isFinite(Date.parse(g.tipoffUtc))))fail(`Invalid UTC tipoff: ${g.id}`);
  }
  const statValues=(values:unknown,label:string)=>{if(!values||typeof values!=='object'){fail(`Missing values: ${label}`);return;}const v=values as Record<string,unknown>;
    for(const key of STAT_KEYS)if(v[key]!==null&&(typeof v[key]!=='number'||!Number.isFinite(v[key])||!Number.isInteger(v[key])||(key!=='PLUS_MINUS'&&(v[key] as number)<0)))fail(`Invalid or missing ${key}: ${label}`);
    for(const [made,attempt] of [['FGM','FGA'],['FG3M','FG3A'],['FTM','FTA']])if(typeof v[made]==='number'&&typeof v[attempt]==='number'&&v[made]>v[attempt])fail(`Makes exceed attempts: ${label}`);
    if(typeof v.FG3A==='number'&&typeof v.FGA==='number'&&v.FG3A>v.FGA)fail(`3PA exceeds FGA: ${label}`);
    if(typeof v.FG3M==='number'&&typeof v.FGM==='number'&&v.FG3M>v.FGM)fail(`3PM exceeds FGM: ${label}`);
    if(typeof v.OREB==='number'&&typeof v.DREB==='number'&&typeof v.REB==='number'&&v.OREB+v.DREB!==v.REB)fail(`Rebounds disagree: ${label}`);
    if(typeof v.FGM==='number'&&typeof v.FG3M==='number'&&typeof v.FTM==='number'&&typeof v.PTS==='number'&&v.FGM*2+v.FG3M+v.FTM!==v.PTS)fail(`Points disagree with shots: ${label}`);
  };
  for(const [kind,rows] of [['player',d.playerStats],['team',d.teamStats]] as const){const unique=new Set<string>();for(const r of rows){if(!r){fail('Null stat row.');continue;}const g=gameMap.get(r.gameId);if(!g||!games.has(r.gameId)||![g.homeTeamId,g.awayTeamId].includes(r.teamId)||!sources.has(r.sourceId))fail(`Invalid stat references: ${r.gameId}`);const p=kind==='player'?r as typeof d.playerStats[number]:null;const key=p?`${r.gameId}:${p.playerId}`:`${r.gameId}:${r.teamId}`;if(unique.has(key))fail(`Duplicate stat row: ${key}`);unique.add(key);statValues(r.values,key);
    if(p){if(!players.has(p.playerId)||!['played','dnp','inactive','unknown'].includes(p.participation)||(p.starter!==null&&typeof p.starter!=='boolean')||(p.reason!==null&&typeof p.reason!=='string'))fail(`Invalid participation: ${key}`);if(p.starterPosition!=null&&!['G','F','C'].includes(p.starterPosition))fail(`Invalid source starting position: ${key}`);if(['dnp','inactive'].includes(p.participation)&&p.values&&STAT_KEYS.some(k=>p.values[k]!==null))fail(`Non-playing rows must retain null statistics: ${key}`);}
    else {const t=r as typeof d.teamStats[number];for(const v of [t.teamRebounds,t.teamTurnovers])if(v!==null&&(!Number.isInteger(v)||v<0))fail(`Invalid team-only stat: ${key}`);if(g&&r.values&&r.values.PTS!==null&&r.values.PTS!==(g.homeTeamId===r.teamId?g.homeScore:g.awayScore))fail(`Team score disagreement: ${key}`);}
  }}
  const coverageKeys=new Set<string>();for(const c of d.coverage){if(!c){fail('Null coverage row.');continue;}const key=`${c.season}:${c.competition}:${c.dataset}:${c.field}`;if(coverageKeys.has(key))fail(`Duplicate coverage: ${key}`);coverageKeys.add(key);if(!Number.isInteger(c.season)||c.season<1980||!competitions.includes(c.competition)||!['games','playerStats','teamStats'].includes(c.dataset)||!(c.field==='all'||STAT_KEYS.includes(c.field))||!['unverified','partial','complete'].includes(c.status)||!Number.isInteger(c.observed)||c.observed<0||(c.expected!==null&&(!Number.isInteger(c.expected)||c.expected<0||c.observed>c.expected)))fail(`Invalid coverage: ${key}`);if(c.status==='complete'&&(c.expected===null||c.expected!==c.observed||!c.evidence?.trim()))fail(`Complete coverage requires a known denominator and evidence: ${key}`);
    const scopedGames=d.games.filter(g=>g&&g.season===c.season&&g.competition===c.competition&&g.status==='final');
    const scopeIds=new Set(scopedGames.map(g=>g.id));
    const rows=c.dataset==='games'?scopedGames:c.dataset==='playerStats'?d.playerStats.filter(r=>r&&scopeIds.has(r.gameId)):d.teamStats.filter(r=>r&&scopeIds.has(r.gameId));
    const actual=c.field==='all'?rows.length:c.dataset==='games'?0:rows.filter(r=>('values' in r)&&r.values[c.field]!==null).length;
    if(c.observed!==actual)fail(`Coverage observed count disagrees with loaded records: ${key}`);
    if(c.status==='complete'&&c.dataset!=='games')for(const game of scopedGames)for(const teamId of [game.homeTeamId,game.awayTeamId])if(!rows.some(r=>('teamId' in r)&&r.gameId===game.id&&r.teamId===teamId))fail(`Complete coverage omits a game side: ${key}:${game.id}`);
}
  return {valid:errors.length===0,errors};
}

function safeSourceUrl(raw:string):boolean{try{const u=new URL(raw);return !/[\u0000-\u0020\u007f]/.test(raw)&&u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}
export function validateRecordDataset(input:unknown):{valid:boolean;errors:string[]}{try{return validateInternal(input);}catch{return {valid:false,errors:['Malformed dataset metadata or rows.']};}}
// CLI ESM and the Next server bundle share this validator across module formats.
export default { validateRecordDataset };
