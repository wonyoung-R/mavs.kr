import { ParsedQuery, QueryResult, QueryRow, RecordDataset, StatKey } from './types';
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const metrics: [StatKey, string[]][] = [['PTS',['points','point','pts','득점','점']],['REB',['rebounds','rebound','reb','리바운드']],['AST',['assists','assist','ast','어시스트']],['STL',['steals','steal','stl','스틸']],['BLK',['blocks','block','blk','블록']],['TOV',['turnovers','turnover','tov','턴오버']],['FG3M',['threes','three pointers','3pm','3점슛']],['MIN_SECONDS',['minutes','min','출전시간']],['PLUS_MINUS',['plus minus','plus_minus','플러스마이너스']]];
export function parseQuery(query: string, dataset: RecordDataset): ParsedQuery {
  if (query.length > 500 || !query.trim()) return {status:'unsupported',message:'Enter a question of 1–500 characters.',messageKo:'1–500자의 질문을 입력하세요.'};
  let rest = query.toLowerCase().normalize('NFKC');
  const originalQuery = rest;
  const mentionOrder = new Map<string, number>();
  const playerIds: string[] = [];
  const names = new Map<string, Set<string>>();
  for(const p of dataset.players) for(const name of [p.name,p.nameKo,...p.aliases].filter(Boolean)) { const key=name.toLowerCase().normalize('NFKC'); if(!names.has(key)) names.set(key,new Set()); names.get(key)!.add(p.id); }
  for(const [name,ids] of [...names].sort((a,b)=>b[0].length-a[0].length)) {
    const pattern = new RegExp(`(?<![a-z0-9])${escape(name)}(?![a-z0-9])`,'g');
    if(pattern.test(rest)) { if(ids.size>1) return {status:'ambiguous',message:`Specify the full player name: ${name}`,messageKo:`동명이인입니다. 전체 선수 이름으로 지정하세요: ${name}`}; pattern.lastIndex=0;const position=pattern.exec(originalQuery)?.index??originalQuery.length;for(const id of ids)mentionOrder.set(id,Math.min(mentionOrder.get(id)??Infinity,position));playerIds.push(...ids); rest=rest.replace(pattern,' '); }
  }
  const seasons = [...rest.matchAll(/\b(19\d{2}|20\d{2})(?:\s*[-–/]\s*(\d{2}|20\d{2}))?\b/g)];
  if(seasons.length>1) return {status:'ambiguous',message:'Use one season per question.',messageKo:'질문당 시즌 하나를 지정하세요.'};
  const season = seasons[0] ? Number(seasons[0][1]) : undefined;
  if(seasons[0]?.[2] && Number(seasons[0][2]) !== (seasons[0][2].length===2 ? (season!+1)%100 : season!+1)) return {status:'unsupported',message:'Use a season such as 2010-11, not a date range.',messageKo:'2010-11처럼 시즌을 지정하세요. 날짜 범위는 지원하지 않습니다.'};
  rest=rest.replace(/\b(19\d{2}|20\d{2})(?:\s*[-–/]\s*(\d{2}|20\d{2}))?\b/g,' ');
  const playoff=/playoffs?|플레이오프/.test(rest), regular=/regular\s*season|정규시즌/.test(rest);
  if(playoff&&regular) return {status:'ambiguous',message:'Choose regular season or playoffs.',messageKo:'정규시즌과 플레이오프 중 하나를 지정하세요.'};
  const competition = playoff ? 'playoffs' : 'regular'; rest=rest.replace(/playoffs?|플레이오프|regular\s*season|정규시즌/g,' ');
  const venues = [['home','홈'],['away','원정'],['neutral','중립']] as const;
  const matchedVenues=venues.filter(v=>v.some(x=>new RegExp(`(?<![a-z])${x}(?![a-z])`).test(rest)));
  if(matchedVenues.length>1) return {status:'ambiguous',message:'Choose one venue.',messageKo:'홈·원정·중립 중 하나를 지정하세요.'};
  const venue=matchedVenues[0]?.[0]; for(const v of venues) for(const n of v) rest=rest.replace(new RegExp(`(?<![a-z])${n}(?![a-z])`,'g'),' ');
  let opponentId: string | undefined;
  for(const team of dataset.teams) {
    for(const name of [team.name,team.nameKo,team.abbreviation,...team.aliases].filter(Boolean).sort((a,b)=>b.length-a.length)) {
      const pattern=new RegExp(`(?<![a-z0-9])${escape(name.toLowerCase())}(?![a-z0-9])`,'g');
      if(pattern.test(rest)) { if(team.abbreviation==='DAL') {rest=rest.replace(pattern,' ');continue;} if(opponentId&&opponentId!==team.id) return {status:'ambiguous',message:'Choose one opponent.',messageKo:'상대 팀 하나를 지정하세요.'}; opponentId=team.id; rest=rest.replace(pattern,' '); }
    }
  }
  let stat: StatKey='PTS'; const selected: StatKey[]=[];
  for(const [key,aliases] of metrics) for(const alias of aliases) {const p=new RegExp(`(?<![a-z])${escape(alias)}(?![a-z])`,'g'); if(p.test(rest)){selected.push(key);rest=rest.replace(p,' ');}}
  if(new Set(selected).size>1) return {status:'unsupported',message:'Choose one statistic per question.',messageKo:'질문당 지표 하나를 지정하세요.'}; if(selected.length) stat=selected[0];
  let threshold: {operator:'gte'|'gt'|'lte'|'lt'|'eq';value:number}|undefined;
  const thresholdMatchers: [RegExp,'gte'|'gt'|'lte'|'lt'|'eq'][]=[[/([0-9]+(?:\.[0-9]+)?)\s*(?:이상|or more|\+)/,'gte'],[/at least\s*([0-9]+(?:\.[0-9]+)?)/,'gte'],[/([0-9]+(?:\.[0-9]+)?)\s*(?:초과)/,'gt'],[/over\s*([0-9]+(?:\.[0-9]+)?)/,'gt'],[/([0-9]+(?:\.[0-9]+)?)\s*(?:이하|or fewer)/,'lte'],[/under\s*([0-9]+(?:\.[0-9]+)?)/,'lt'],[/([0-9]+(?:\.[0-9]+)?)\s*미만/,'lt'],[/(?:exactly|정확히)\s*([0-9]+(?:\.[0-9]+)?)/,'eq']];
  for(const [p,operator] of thresholdMatchers){const m=rest.match(p);if(m){if(threshold)return {status:'unsupported',message:'Use one threshold.',messageKo:'조건값 하나를 지정하세요.'};threshold={operator,value:Number(m[1])*(stat==='MIN_SECONDS'?60:1)};rest=rest.replace(p,' ');}}
  const aggregation = /compare|비교/.test(rest) ? 'compare' : /average|평균/.test(rest) ? 'average' : /total|sum|합계|총합/.test(rest) ? 'sum' : /how many|count|몇\s*경기|경기\s*수/.test(rest) ? 'count' : 'games';
  rest=rest.replace(/compare|비교|average|평균|total|sum|합계|총합|how many|count|몇\s*경기|경기\s*수/g,' ');
  const direction = /lowest|least|오름차순|최저/.test(rest) ? 'asc' : 'desc';
  rest=rest.replace(/lowest|least|오름차순|최저|highest|most|내림차순|최고|최다/g,' ');
  let limit=50;rest=rest.replace(/(?:top|상위)\s*(\d+)/g,(_,n)=>{limit=Math.min(200,Math.max(1,Number(n)));return ' ';});
  rest=rest.replace(/\b(?:the|a|an|in|for|of|with|and|vs|versus|against|show|games?|season|stats?|statistics|mavericks|mavs|dallas)\b|매버릭스|댈러스|시즌|기록|경기|보여줘|알려줘|상대로|상대|에서|은|는|의|이|가|을|를|와|과|[?,.!:]/g,' ').trim();
  if(rest.replace(/\s/g,'')) return {status:'unsupported',message:'Some conditions could not be understood. Use a player, season and statistic.',messageKo:'해석하지 못한 조건이 있습니다. 선수·시즌·지표 중심으로 입력하세요.'};
  if(aggregation==='compare'&&new Set(playerIds).size!==2) return {status:'ambiguous',message:'Name exactly two players to compare.',messageKo:'비교할 선수 두 명을 지정하세요.'};
  return {status:'ok',plan:{playerIds:[...new Set(playerIds)].sort((a,b)=>(mentionOrder.get(a)!-mentionOrder.get(b)!)||a.localeCompare(b)),season,competition,venue,opponentId,stat,threshold,aggregation,direction,limit}};
}
export function executeQuery(query: string, dataset: RecordDataset): QueryResult {
  const parsed=parseQuery(query,dataset);
  if(parsed.status!=='ok') return {...parsed,rows:[],summaries:[],total:0,coverage:[],incomplete:true};
  const plan=parsed.plan, dal=dataset.teams.find(t=>t.abbreviation==='DAL');
  const coverage=dataset.coverage.filter(c=>(plan.season===undefined||c.season===plan.season)&&c.competition===plan.competition);
  let complete=plan.season!==undefined&&coverage.some(c=>c.dataset==='games'&&c.status==='complete'&&c.field==='all')&&coverage.some(c=>c.dataset==='playerStats'&&c.status==='complete'&&(c.field===plan.stat||c.field==='all'));
  const gameMap=new Map(dataset.games.map(g=>[g.id,g])),playerMap=new Map(dataset.players.map(p=>[p.id,p]));
  if(dataset.playerStats.some(s=>{const g=gameMap.get(s.gameId);return s.participation==='unknown'&&s.teamId===dal?.id&&g?.status==='final'&&g.competition===plan.competition&&(plan.season===undefined||g.season===plan.season)&&(!plan.playerIds.length||plan.playerIds.includes(s.playerId));}))complete=false;
  let rows:QueryRow[]=dataset.playerStats.flatMap(s=>{
    const g=gameMap.get(s.gameId),p=playerMap.get(s.playerId);
    if(!g||!p||!dal||s.teamId!==dal.id||s.participation!=='played'||g.status!=='final'||g.competition!==plan.competition||(plan.season!==undefined&&g.season!==plan.season)||(plan.playerIds.length&&!plan.playerIds.includes(s.playerId))) return [];
    const venue=g.neutral===null?'unknown':g.neutral?'neutral':g.homeTeamId===s.teamId?'home':'away',opponentId=g.homeTeamId===s.teamId?g.awayTeamId:g.homeTeamId;
    if(plan.venue&&g.neutral===null)complete=false;
    if((plan.venue&&plan.venue!==venue)||(plan.opponentId&&plan.opponentId!==opponentId))return [];
    return [{gameId:g.id,date:g.date,season:g.season,competition:g.competition,playerId:p.id,playerName:p.name,playerNameKo:p.nameKo,teamId:s.teamId,opponentId,venue,values:s.values}];
  });
  const missing=rows.filter(r=>r.values[plan.stat]===null).length;
  if(plan.threshold) {const {operator,value}=plan.threshold;rows=rows.filter(r=>{const v=r.values[plan.stat];return v!==null&&(operator==='gte'?v>=value:operator==='gt'?v>value:operator==='lte'?v<=value:operator==='lt'?v<value:v===value);});}
  rows.sort((a,b)=>{const av=a.values[plan.stat],bv=b.values[plan.stat];if(av===null)return bv===null?a.gameId.localeCompare(b.gameId):1;if(bv===null)return -1;return (plan.direction==='asc'?av-bv:bv-av)||a.date.localeCompare(b.date)||a.playerId.localeCompare(b.playerId);});
  const groups=plan.aggregation==='compare'?plan.playerIds:[null];
  const summaries=plan.aggregation==='games'?[]:groups.map(playerId=>{const subset=playerId?rows.filter(r=>r.playerId===playerId):rows;const known=subset.map(r=>r.values[plan.stat]).filter((v):v is number=>v!==null);const m=subset.length-known.length;return {playerId,label:playerId?playerMap.get(playerId)?.name||playerId:plan.aggregation,value:plan.aggregation==='count'?(!complete||missing>0?null:new Set(subset.map(r=>r.gameId)).size):m||!known.length?null:plan.aggregation==='average'||plan.aggregation==='compare'?known.reduce((a,b)=>a+b,0)/known.length:known.reduce((a,b)=>a+b,0),games:new Set(subset.map(r=>r.gameId)).size,missing:m};});
  return {status:rows.length?'ready':'empty',plan,rows:rows.slice(0,plan.limit),summaries,total:rows.length,coverage,incomplete:!complete||missing>0,message:!rows.length?'No matching verified records are loaded.':undefined,messageKo:!rows.length?'현재 적재된 검증 기록에서 일치하는 결과가 없습니다.':undefined};
}
