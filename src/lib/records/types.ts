export type Competition = 'regular' | 'playoffs' | 'playin' | 'cup_final' | 'preseason' | 'summer';
export type StatKey = 'PTS' | 'REB' | 'AST' | 'STL' | 'BLK' | 'TOV' | 'PF' | 'FGM' | 'FGA' | 'FG3M' | 'FG3A' | 'FTM' | 'FTA' | 'OREB' | 'DREB' | 'PLUS_MINUS' | 'MIN_SECONDS';
export const STAT_KEYS: StatKey[] = ['PTS','REB','AST','STL','BLK','TOV','PF','FGM','FGA','FG3M','FG3A','FTM','FTA','OREB','DREB','PLUS_MINUS','MIN_SECONDS'];
export type StatValues = Record<StatKey, number | null>;
export interface RecordTeam { id: string; abbreviation: string; name: string; nameKo: string; aliases: string[] }
export interface RecordPlayer { id: string; name: string; nameKo: string; aliases: string[] }
export interface RecordSource { id: string; name: string; url: string; retrievedAt: string; rights: { storage: boolean; display: boolean; commercial: boolean; evidence: string }; transformVersion: string }
export interface RecordGame { id: string; season: number; competition: Competition; date: string; tipoffUtc: string | null; homeTeamId: string; awayTeamId: string; neutral: boolean | null; status: 'final' | 'scheduled' | 'postponed' | 'cancelled'; homeScore: number | null; awayScore: number | null; sourceId: string; sourceGameId: string; cup: boolean; homeTeamName?: string; awayTeamName?: string; arenaName?: string }
export interface RecordPlayerStat { gameId: string; teamId: string; playerId: string; participation: 'played' | 'dnp' | 'inactive' | 'unknown'; starter: boolean | null; starterPosition?: 'G' | 'F' | 'C' | null; reason: string | null; values: StatValues; sourceId: string }
export interface RecordTeamStat { gameId: string; teamId: string; values: StatValues; teamRebounds: number | null; teamTurnovers: number | null; sourceId: string }
export interface RecordCoverage { season: number; competition: Competition; dataset: 'games' | 'playerStats' | 'teamStats'; field: StatKey | 'all'; expected: number | null; observed: number; status: 'unverified' | 'partial' | 'complete'; evidence: string }
export interface RecordDataset { version: 1; teams: RecordTeam[]; players: RecordPlayer[]; games: RecordGame[]; playerStats: RecordPlayerStat[]; teamStats: RecordTeamStat[]; coverage: RecordCoverage[]; sources: RecordSource[] }
export interface DatasetReadResult { dataset: RecordDataset; status: 'ready' | 'empty' | 'invalid'; message?: string }
export interface QueryPlan { playerIds: string[]; season?: number; competition?: Competition; venue?: 'home' | 'away' | 'neutral'; opponentId?: string; stat: StatKey; threshold?: { operator: 'gte' | 'gt' | 'lte' | 'lt' | 'eq'; value: number }; aggregation: 'games' | 'sum' | 'average' | 'count' | 'compare'; direction: 'asc' | 'desc'; limit: number }
export type ParsedQuery = { status: 'ok'; plan: QueryPlan } | { status: 'unsupported' | 'ambiguous'; message: string; messageKo: string };
export interface QueryRow { gameId: string; date: string; season: number; competition: Competition; playerId: string; playerName: string; playerNameKo: string; teamId: string; opponentId: string; venue: 'home' | 'away' | 'neutral' | 'unknown'; values: StatValues }
export interface QuerySummary { playerId: string | null; label: string; value: number | null; games: number; missing: number }
export interface QueryResult { status: 'ready' | 'empty' | 'unsupported' | 'ambiguous'; plan?: QueryPlan; rows: QueryRow[]; summaries: QuerySummary[]; total: number; message?: string; messageKo?: string; coverage: RecordCoverage[]; incomplete: boolean }
