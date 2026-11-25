import { createHash } from 'node:crypto';
import { RecordDataset, RecordPlayerStat, StatValues, STAT_KEYS } from './types';
import { validateRecordDataset } from './validation';

type Competitor = { homeAway: string; score: string | { value: number }; team: { id: string; abbreviation: string } };
type Competition = { date: string; neutralSite?: boolean; competitors: Competitor[]; notes?: { headline?: string; text?: string }[]; type?: { text?: string }; status?: { type?: { completed?: boolean; name?: string } }; venue?: { fullName?: string } };
type Event = { id: string; date: string; season?: { year: number }; seasonType?: { type?: number; id?: string }; name?: string; competitions: Competition[] };
type AthleteRow = { athlete: { id: string; displayName: string; position?: { abbreviation?: string } }; active?: boolean; starter?: boolean; didNotPlay?: boolean; reason?: string; stats: string[] };
type StatGroup = { labels?: string[]; names?: string[]; keys?: string[]; athletes: AthleteRow[]; totals?: string[] };
type Summary = { header: { id: string; season: { year: number; type: number }; competitions: Competition[] }; boxscore?: { players?: { team: { abbreviation: string }; statistics: StatGroup[] }[]; teams?: { team: { abbreviation: string }; statistics: { name: string; displayValue: string }[] }[] } };
export interface SeasonCollectionOptions { season: number; asOf?: Date; baseline: RecordDataset; fetchImpl?: typeof fetch; timeoutMs?: number; concurrency?: number }
export interface SeasonCollectionReport { season: number; completedExpected: number; completedCollected: number; firstGame: string | null; lastGame: string | null; rawHashes: Record<string, string>; urls: string[]; excludedCupFinals: string[]; playerMappings: { espnId: string; name: string; playerId: string; basis: string }[] }
const API = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ABBREVIATIONS: Record<string, string> = { GS: 'GSW', NY: 'NYK', NO: 'NOP', SA: 'SAS', SAN: 'SAS', UTAH: 'UTA', WSH: 'WAS' };
const emptyValues = (): StatValues => Object.fromEntries(STAT_KEYS.map(k => [k, null])) as StatValues;
const normalizeName = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const integer = (v: unknown): number | null => typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^[+-]?\d+$/.test(v.trim()) ? Number(v) : null;
const final = (c: Competition) => c?.status?.type?.completed === true && /^STATUS_FINAL(?:_OT)?$/.test(c.status.type.name || '');
const cupText = (event: Event, competition: Competition) => [event.name, competition.type?.text, ...(competition.notes || []).map(n => n.headline || n.text)].filter(Boolean).join(' ');
export function classifySeasonGame(event: Event): 'regular' | 'cup_final' | 'playoffs' | 'playin' {
  const text = cupText(event, event.competitions[0]);
  if (/(?:NBA|Emirates|in.season).*?(?:cup|tournament)/i.test(text) && /championship|\bfinal\b/i.test(text) && !/semi[ -]?final|quarter[ -]?final/i.test(text)) return 'cup_final';
  if (Number(event.seasonType?.type ?? event.seasonType?.id) === 3) return /play.in/i.test(text) ? 'playin' : 'playoffs';
  return 'regular';
}
const SIMPLE: Record<string, keyof StatValues> = { PTS: 'PTS', points: 'PTS', REB: 'REB', rebounds: 'REB', totalRebounds: 'REB', AST: 'AST', assists: 'AST', STL: 'STL', steals: 'STL', BLK: 'BLK', blocks: 'BLK', TO: 'TOV', turnovers: 'TOV', PF: 'PF', fouls: 'PF', OREB: 'OREB', offensiveRebounds: 'OREB', DREB: 'DREB', defensiveRebounds: 'DREB', '+/-': 'PLUS_MINUS', plusMinus: 'PLUS_MINUS' };
function parseValues(labels: string[], cells: string[]): StatValues {
  const values = emptyValues();
  labels.forEach((label, index) => {
    const cell = cells[index];
    if (cell == null || cell === '' || cell === '--' || cell === '-') return;
    if (SIMPLE[label]) { values[SIMPLE[label]] = integer(cell); if (values[SIMPLE[label]] === null) throw new Error(`Invalid ${label} cell: ${cell}`); return; }
    if (label === 'MIN' || label === 'minutes') {
      const match = /^(\d+)(?::([0-5]\d))?$/.exec(cell);
      if (!match) throw new Error(`Invalid minutes: ${cell}`);
      values.MIN_SECONDS = Number(match[1]) * 60 + Number(match[2] || 0); return;
    }
    const pairs: Record<string, [keyof StatValues, keyof StatValues]> = { FG: ['FGM', 'FGA'], 'fieldGoalsMade-fieldGoalsAttempted': ['FGM', 'FGA'], '3PT': ['FG3M', 'FG3A'], 'threePointFieldGoalsMade-threePointFieldGoalsAttempted': ['FG3M', 'FG3A'], FT: ['FTM', 'FTA'], 'freeThrowsMade-freeThrowsAttempted': ['FTM', 'FTA'] };
    if (pairs[label]) {
      const match = /^(\d+)-(\d+)$/.exec(cell); if (!match) throw new Error(`Invalid shots: ${cell}`);
      const [made, attempts] = pairs[label]; values[made] = Number(match[1]); values[attempts] = Number(match[2]);
    }
  });
  return values;
}

/** Public factual boxscores only; no credential forwarding, access-control bypass, or database writes. */
export async function collectSeason(options: SeasonCollectionOptions) {
  const { season, baseline } = options;
  const asOf = options.asOf || new Date();
  if (!Number.isInteger(season) || season < 1980 || season > 2099 || !Number.isFinite(asOf.getTime())) throw new Error('Invalid season/asOf');
  const raw: Record<string, unknown> = {};
  const rawBodies: Record<string, string> = {};
  const rawHashes: Record<string, string> = {};
  const fetchImpl = options.fetchImpl || fetch;
  let stopped = false;
  async function read<T>(url: string): Promise<T> {
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (stopped) throw new Error('Collection stopped');
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.min(20_000, Math.max(1, options.timeoutMs || 20_000)));
      try {
        const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
        if ([401, 403].includes(response.status)) { stopped = true; throw new Error(`ESPN access denied: ${response.status}`); }
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < 2) continue;
          throw new Error(`ESPN HTTP ${response.status}: ${url}`);
        }
        const body = await response.text();
        const parsed = JSON.parse(body);
        raw[url] = parsed; rawBodies[url] = body; rawHashes[url] = createHash('sha256').update(body).digest('hex');
        return parsed as T;
      } catch (error) {
        if (stopped || attempt === 2 || !(error instanceof Error) || !['AbortError', 'TimeoutError', 'TypeError'].includes(error.name)) throw error;
      } finally { clearTimeout(timer); }
    }
    throw new Error('ESPN retries exhausted');
  }
  const scheduleUrl = `${API}/teams/6/schedule?season=${season + 1}&seasontype=2`;
  const schedule = await read<{ season: { year: number; type: number }; events: Event[] }>(scheduleUrl);
  if (schedule.season?.year !== season + 1 || schedule.season.type !== 2 || !Array.isArray(schedule.events)) throw new Error('Schedule season/type mismatch');
  const postseasonUrl = `${API}/teams/6/schedule?season=${season + 1}&seasontype=3`;
  const postseason = await read<{ events: Event[] }>(postseasonUrl);
  // ESPN top-level season is the current league context even for historical playoff requests.
  // Validate each event's own year/type; an empty postseason is normal before qualification.
  if (!Array.isArray(postseason.events)) throw new Error('Missing postseason schedule');
  for (const event of postseason.events) if (event.season?.year !== season + 1 || Number(event.seasonType?.type ?? event.seasonType?.id) !== 3) throw new Error('Postseason event season/type mismatch');
  const excludedCupFinals: string[] = [];
  const selected = new Map<string, Event>();
  for (const event of [...schedule.events, ...postseason.events]) {
    if (!/^\d+$/.test(event.id) || event.competitions?.length !== 1) throw new Error('Invalid scheduled event');
    if (event.season?.year !== season + 1 || ![2, 3].includes(Number(event.seasonType?.type ?? event.seasonType?.id))) throw new Error('Event season/type mismatch');
    const date = Date.parse(event.date);
    if (!Number.isFinite(date) || date < Date.UTC(season, 8, 1) || date >= Date.UTC(season + 1, 6, 1)) throw new Error('Event outside season window');
    if (classifySeasonGame(event) === 'cup_final') { excludedCupFinals.push(event.id); continue; }
    if (date > asOf.getTime() || !final(event.competitions[0])) continue;
    if (selected.has(event.id) && JSON.stringify(selected.get(event.id)) !== JSON.stringify(event)) throw new Error('Conflicting duplicate schedule event');
    selected.set(event.id, event);
  }
  const events = [...selected.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  // 82 regular games + up to 28 playoff games + explicit play-in games.
  if (events.length > 120) throw new Error('Too many completed games');
  const summaries = new Map<string, Summary>(); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(events.length, Math.max(1, Math.min(3, options.concurrency || 2))) }, async () => {
    while (cursor < events.length && !stopped) {
      const event = events[cursor++];
      try { summaries.set(event.id, await read<Summary>(`${API}/summary?event=${event.id}`)); } catch (e) { stopped = true; throw e; }
    }
  }));
  const sourceId = `espn-season-${season}`;
  const dataset: RecordDataset = { version: 1, teams: baseline.teams.map(t => ({ ...t })), players: [], games: [], playerStats: [], teamStats: [], coverage: [], sources: [{ id: sourceId, name: `ESPN NBA ${season}–${String(season + 1).slice(-2)} factual boxscores`, url: 'https://www.espn.com/nba/team/schedule/_/name/dal', retrievedAt: asOf.toISOString(), transformVersion: 'espn-season-v1', rights: { storage: true, display: true, commercial: false, evidence: 'User requested collection/display of publicly accessible factual game records. Original ESPN schedule/boxscore URLs and SHA-256 hashes retained in collection report; no media/licensed commentary copied. Commercial reuse not granted.' } }] };
  const nameIndex = new Map<string, typeof baseline.players>();
  for (const player of baseline.players) { const name = normalizeName(player.name); nameIndex.set(name, [...(nameIndex.get(name) || []), player]); }
  const playerMappings: SeasonCollectionReport['playerMappings'] = [];
  const mapped = new Map<string, string>();
  const teamId = (abbreviation: string) => { const matches = baseline.teams.filter(t => (ABBREVIATIONS[t.abbreviation] || t.abbreviation) === (ABBREVIATIONS[abbreviation] || abbreviation)); if (matches.length !== 1) throw new Error(`Unknown/ambiguous team ${abbreviation}`); return matches[0].id; };
  for (const event of events) {
    const summary = summaries.get(event.id)!;
    const competition = summary?.header?.competitions?.[0];
    if (summary?.header?.id !== event.id || summary.header.season?.year !== season + 1 || summary.header.season.type !== Number(event.seasonType?.type ?? event.seasonType?.id) || !competition || !final(competition) || Date.parse(competition.date) !== Date.parse(event.date)) throw new Error(`Summary identity/final mismatch ${event.id}`);
    const competitors = competition.competitors;
    const home = competitors?.find(c => c.homeAway === 'home'), away = competitors?.find(c => c.homeAway === 'away');
    if (competitors?.length !== 2 || !home || !away) throw new Error(`Missing opponents ${event.id}`);
    const score = (c: Competitor) => integer(typeof c.score === 'object' ? c.score.value : c.score);
    for (const competitor of competitors) {
      const scheduled = event.competitions[0].competitors.filter(c => c.homeAway === competitor.homeAway && teamId(c.team.abbreviation) === teamId(competitor.team.abbreviation));
      if (scheduled.length !== 1 || score(scheduled[0]) !== score(competitor)) throw new Error(`Schedule/summary score or opponent disagreement ${event.id}`);
    }
    const gameId = `espn:game:${event.id}`;
    dataset.games.push({ id: gameId, season, competition: classifySeasonGame(event), date: new Date(event.date).toISOString().slice(0, 10), tipoffUtc: event.date, homeTeamId: teamId(home.team.abbreviation), awayTeamId: teamId(away.team.abbreviation), neutral: typeof competition.neutralSite === 'boolean' ? competition.neutralSite : null, status: 'final', homeScore: score(home), awayScore: score(away), sourceId, sourceGameId: event.id, cup: /cup|in.season tournament/i.test(cupText(event, event.competitions[0])), arenaName: competition.venue?.fullName || event.competitions[0].venue?.fullName });
    if (summary.boxscore?.players?.length !== 2 || summary.boxscore?.teams?.length !== 2) throw new Error(`Missing final boxscore ${event.id}`);
    const seen = new Set<string>();
    for (const group of summary.boxscore.players) {
      const id = teamId(group.team.abbreviation); if (seen.has(id) || ![teamId(home.team.abbreviation), teamId(away.team.abbreviation)].includes(id)) throw new Error('Duplicate/unexpected boxscore team'); seen.add(id);
      if (group.statistics.length !== 1 || !group.statistics[0].athletes?.length) throw new Error('Missing player stats');
      const stats = group.statistics[0]; const labels = stats.keys || stats.labels || stats.names || [];
      if (!labels.length) throw new Error('Missing stat labels');
      const rows: RecordPlayerStat[] = stats.athletes.map(row => {
        const athlete = row.athlete; if (!/^\d+$/.test(athlete.id) || !athlete.displayName) throw new Error('Invalid athlete');
        let playerId = mapped.get(athlete.id);
        if (!playerId) {
          const matches = nameIndex.get(normalizeName(athlete.displayName)) || [];
          playerId = matches.length === 1 ? matches[0].id : `espn:player:${athlete.id}`; mapped.set(athlete.id, playerId);
          playerMappings.push({ espnId: athlete.id, name: athlete.displayName, playerId, basis: matches.length === 1 ? 'unique normalized baseline full name (suffix retained)' : matches.length ? 'ambiguous baseline name; kept ESPN identity' : 'no baseline full-name match; kept ESPN identity' });
          if (!dataset.players.some(p => p.id === playerId)) dataset.players.push(matches.length === 1 ? { ...matches[0] } : { id: playerId, name: athlete.displayName, nameKo: athlete.displayName, aliases: [] });
        }
        const participation = row.didNotPlay === true ? (row.active === false && /inactive|injur|susp|illness/i.test(row.reason || '') ? 'inactive' : 'dnp') : row.didNotPlay === false ? 'played' : 'unknown';
        if (participation === 'unknown') throw new Error(`Unknown participation ${athlete.id}`);
        const position = athlete.position?.abbreviation; const starterPosition = position && ({ G: 'G', PG: 'G', SG: 'G', F: 'F', SF: 'F', PF: 'F', C: 'C' } as const)[position];
        return { gameId, teamId: id, playerId, participation, starter: typeof row.starter === 'boolean' && participation === 'played' ? row.starter : null, starterPosition: starterPosition || null, reason: participation === 'played' ? null : row.reason || null, values: participation === 'played' ? parseValues(labels, row.stats) : emptyValues(), sourceId };
      });
      if (rows.filter(r => r.starter === true).length !== 5 || rows.some(r => r.participation === 'played' && r.starter === null)) rows.forEach(r => { r.starter = null; });
      const played = rows.filter(r => r.participation === 'played');
      const expectedScore = id === teamId(home.team.abbreviation) ? score(home) : score(away);
      if (!played.length || played.some(r => r.values.PTS === null) || played.reduce((sum, r) => sum + r.values.PTS!, 0) !== expectedScore) throw new Error(`Player score disagreement ${event.id}/${id}`);
      dataset.playerStats.push(...rows);
      const team = summary.boxscore.teams.filter(t => teamId(t.team.abbreviation) === id);
      if (team.length !== 1) throw new Error('Missing team statistics');
      const values = parseValues(team[0].statistics.map(s => s.name), team[0].statistics.map(s => s.displayValue));
      const totals = parseValues(labels, stats.totals || []);
      // PTS is explicitly supplied by ESPN totals; never infer it from shooting arithmetic.
      values.PTS = totals.PTS;
      if (values.PTS !== expectedScore) throw new Error('Team score disagreement');
      for (const key of STAT_KEYS.filter(k => !['MIN_SECONDS', 'PLUS_MINUS'].includes(k))) {
        if (values[key] !== null && totals[key] !== null && values[key] !== totals[key]) throw new Error(`Team boxscore totals disagree ${event.id}/${id}/${key}`);
        if (values[key] !== null && played.every(r => r.values[key] !== null) && played.reduce((sum, r) => sum + r.values[key]!, 0) !== values[key]) throw new Error(`Player/team stat totals disagree ${event.id}/${id}/${key}`);
      }

      dataset.teamStats.push({ gameId, teamId: id, sourceId, values, teamRebounds: integer(team[0].statistics.find(s => s.name === 'teamRebounds')?.displayValue), teamTurnovers: integer(team[0].statistics.find(s => s.name === 'teamTurnovers')?.displayValue) });
    }
  }
  for (const competition of ['regular', 'playoffs', 'playin'] as const) {
    const games = dataset.games.filter(g => g.competition === competition);
    const gameIds = new Set(games.map(g => g.id));
    for (const kind of ['games', 'playerStats', 'teamStats'] as const) dataset.coverage.push({ season, competition, dataset: kind, field: 'all', expected: kind === 'games' ? games.length : kind === 'teamStats' ? games.length * 2 : null, observed: kind === 'games' ? games.length : dataset[kind].filter(r => gameIds.has(r.gameId)).length, status: kind === 'playerStats' ? 'partial' : 'complete', evidence: `ESPN DAL ${competition} schedule; ${games.length} confirmed final games, latest tipoff ${games.at(-1)?.tipoffUtc || 'none'}. Player rows include explicit DNP; missing metrics remain null.` });
  }
  const validation = validateRecordDataset(dataset); if (!validation.valid) throw new Error(`Invalid collected dataset: ${validation.errors.join('; ')}`);
  const report: SeasonCollectionReport = { season, completedExpected: events.length, completedCollected: dataset.games.length, firstGame: dataset.games[0]?.date || null, lastGame: dataset.games.at(-1)?.date || null, rawHashes, urls: Object.keys(raw).sort(), excludedCupFinals, playerMappings };
  return { dataset, report, raw, rawBodies };
}
