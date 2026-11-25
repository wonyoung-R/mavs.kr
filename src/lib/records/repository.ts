import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type {
  Competition,
  DatasetReadResult,
  QueryResult,
  RecordDataset,
  StatKey,
  StatValues,
} from "./types";
import { STAT_KEYS } from "./types";
import { validateRecordDataset } from "./validation";
import { executeQuery } from "./query";

export interface PortalSnapshot extends DatasetReadResult {
  releaseId: string | null;
  availableSeasons: number[];
  totalGames: number;
  dalPlayerIds: string[];
  totalPlayerStatRows?: number;
  scopeTotal?: number;
  venueClassifiedGames?: number;
}
export interface RecordFilters {
  releaseId?: string;
  season?: number;
  competition?: Competition;
  venue?: "home" | "away" | "neutral";
  opponentId?: string;
}
export interface RecordScope extends RecordFilters {
  kind: "game" | "season" | "player";
  id?: string;
  offset?: number;
  limit?: number;
}
export interface LeaderboardRow {
  playerId: string;
  games: number;
  known: number;
  value: number | null;
}
export interface ComparisonRow {
  playerId: string;
  games: number;
  values: StatValues;
  known: Partial<Record<StatKey, number>>;
}
export function emptyRecordDataset(): RecordDataset {
  return {
    version: 1,
    teams: [],
    players: [],
    games: [],
    playerStats: [],
    teamStats: [],
    coverage: [],
    sources: [],
  };
}
let localCache: { signature: string; result: DatasetReadResult } | undefined;
// Local validation is performed once per file revision, never in the browser.
export async function readRecordDataset(): Promise<DatasetReadResult> {
  try {
    const file = path.join(process.cwd(), "data", "records", "dataset.json");
    const info = await stat(file);
    const signature = `${info.mtimeMs}:${info.size}`;
    if (localCache?.signature === signature) return localCache.result;
    const raw = JSON.parse(await readFile(file, "utf8"));
    const checked = validateRecordDataset(raw);
    const result: DatasetReadResult = checked.valid
      ? { dataset: raw, status: raw.games.length ? "ready" : "empty" }
      : {
          dataset: emptyRecordDataset(),
          status: "invalid",
          message: "Local records failed validation; records were withheld.",
        };
    localCache = { signature, result };
    return result;
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return {
      dataset: emptyRecordDataset(),
      status: missing ? "empty" : "invalid",
      message: missing
        ? "Verified historical records have not been imported."
        : "Local records could not be read; records were withheld.",
    };
  }
}
export function catalogFromDataset(
  snapshot: DatasetReadResult,
): PortalSnapshot {
  const d = snapshot.dataset;
  const dal = d.teams.find((team) => team.abbreviation === "DAL");
  const dalPlayerIds = [
    ...new Set(
      d.playerStats
        .filter((row) => row.teamId === dal?.id)
        .map((row) => row.playerId),
    ),
  ];
  return {
    ...snapshot,
    releaseId: null,
    availableSeasons: [...new Set(d.games.map((game) => game.season))].sort(
      (a, b) => b - a,
    ),
    totalGames: d.games.length,
    venueClassifiedGames: d.games.filter(
      (game) => game.neutral === true || game.neutral === false,
    ).length,
    totalPlayerStatRows: d.playerStats.length,
    dalPlayerIds,
    dataset: {
      ...d,
      players: d.players
        .filter((player) => dalPlayerIds.includes(player.id))
        .map(({ id, name, nameKo, aliases }) => ({
          id,
          name,
          nameKo,
          aliases,
        })),
      coverage: d.coverage.filter((row) => row.field === "all"),
      games: [],
      playerStats: [],
      teamStats: [],
    },
  };
}
export function scopeDataset(
  snapshot: DatasetReadResult,
  scope: RecordScope,
): PortalSnapshot {
  const catalog = catalogFromDataset(snapshot),
    d = snapshot.dataset;
  const dal = d.teams.find((team) => team.abbreviation === "DAL");
  const playerGameIds = new Set(
    d.playerStats
      .filter((row) => row.teamId === dal?.id && row.playerId === scope.id)
      .map((row) => row.gameId),
  );
  const offset = Math.max(0, Math.min(20000, Math.trunc(scope.offset || 0)));
  const limit = Math.max(1, Math.min(200, Math.trunc(scope.limit || 200)));
  const matchingGames = d.games
    .filter((game) => {
      if (scope.kind === "game") return game.id === scope.id;
      if (scope.kind === "player" && !playerGameIds.has(game.id)) return false;
      if (scope.season !== undefined && game.season !== scope.season)
        return false;
      if (scope.competition && game.competition !== scope.competition)
        return false;
      if (
        scope.opponentId &&
        ![game.homeTeamId, game.awayTeamId].includes(scope.opponentId)
      )
        return false;
      const venue =
        game.neutral === null
          ? "unknown"
          : game.neutral
            ? "neutral"
            : game.homeTeamId === dal?.id
              ? "home"
              : "away";
      return !scope.venue || venue === scope.venue;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const games = matchingGames.slice(offset, offset + limit);
  const gameIds = new Set(games.map((game) => game.id));
  const playerStats =
    scope.kind === "season"
      ? []
      : d.playerStats
          .filter(
            (row) =>
              gameIds.has(row.gameId) &&
              (scope.kind === "game" ||
                (row.playerId === scope.id && row.teamId === dal?.id)),
          )
          .map((row) =>
            scope.kind === "game"
              ? row
              : {
                  gameId: row.gameId,
                  teamId: row.teamId,
                  playerId: row.playerId,
                  participation: row.participation,
                  starter: row.starter,
                  starterPosition: row.starterPosition,
                  reason: row.reason,
                  values: row.values,
                  sourceId: row.sourceId,
                },
          );
  const playerIds = new Set([
    ...catalog.dalPlayerIds,
    ...playerStats.map((row) => row.playerId),
  ]);
  return {
    ...catalog,
    scopeTotal: matchingGames.length,
    dataset: {
      ...catalog.dataset,
      players: d.players
        .filter((player) => playerIds.has(player.id))
        .map((player) =>
          scope.kind === "player" && player.id === scope.id
            ? player
            : {
                id: player.id,
                name: player.name,
                nameKo: player.nameKo,
                aliases: player.aliases,
              },
        ),
      games,
      playerStats,
      teamStats:
        scope.kind === "game"
          ? d.teamStats.filter((row) => gameIds.has(row.gameId))
          : [],
    },
  };
}
const database = () => import("./database");
export class RecordReleaseError extends Error {
  constructor(
    public readonly status: 400 | 404,
    message: string,
  ) {
    super(message);
    this.name = "RecordReleaseError";
  }
}
export function requestedRecordRelease(
  params: URLSearchParams,
): string | undefined {
  const values = params.getAll("releaseId");
  if (!values.length) return undefined;
  if (values.length !== 1 || !/^r_[a-f0-9]{24}$/.test(values[0]))
    throw new RecordReleaseError(
      400,
      "releaseId must match r_ followed by 24 lowercase hexadecimal characters.",
    );
  return values[0];
}
export function requireRecordRelease(
  requested: string | undefined,
  actual: string | null,
): void {
  if (requested && requested !== actual)
    throw new RecordReleaseError(
      404,
      "The requested record release was not found.",
    );
}
export function recordsCacheControl(
  releaseId: string | undefined,
  seconds = 60,
): string {
  return releaseId
    ? "public, max-age=31536000, s-maxage=31536000, immutable"
    : `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=300`;
}
export async function readRecordCatalog(
  releaseId?: string,
): Promise<PortalSnapshot> {
  const db = await database();
  if (!db.isRecordsDatabaseConfigured()) {
    requireRecordRelease(releaseId, null);
    return catalogFromDataset(await readRecordDataset());
  }
  const snapshot = await db.readDatabaseCatalog(releaseId);
  requireRecordRelease(releaseId, snapshot.releaseId);
  return snapshot;
}
export async function readRecordScope(
  scope: RecordScope,
): Promise<PortalSnapshot> {
  const db = await database();
  if (!db.isRecordsDatabaseConfigured()) {
    requireRecordRelease(scope.releaseId, null);
    return scopeDataset(await readRecordDataset(), scope);
  }
  const snapshot = await db.readDatabaseScope(scope);
  requireRecordRelease(scope.releaseId, snapshot.releaseId);
  return snapshot;
}
export async function queryRecords(
  query: string,
  releaseId?: string,
): Promise<QueryResult & { releaseId: string | null }> {
  const db = await database();
  if (db.isRecordsDatabaseConfigured()) {
    const catalog = await db.readDatabaseCatalog(releaseId);
    // A missing pinned release must never fall through to the current release.
    requireRecordRelease(releaseId, catalog.releaseId);
    if (!catalog.releaseId)
      return { ...executeQuery(query, catalog.dataset), releaseId: null };
    return {
      ...(await db.queryDatabaseRecords(query, catalog.releaseId ?? undefined)),
      releaseId: catalog.releaseId,
    };
  }
  requireRecordRelease(releaseId, null);
  const snapshot = await readRecordDataset();
  if (snapshot.status === "invalid") throw new Error("Records unavailable");
  return { ...executeQuery(query, snapshot.dataset), releaseId: null };
}
// One API adapter also allows route behavior to be verified without connecting to production.
export const recordReadRepository = {
  readRecordCatalog,
  readRecordScope,
  queryRecords,
};
function localRows(dataset: RecordDataset, filters: RecordFilters) {
  const dal = dataset.teams.find((team) => team.abbreviation === "DAL");
  const games = new Map(dataset.games.map((game) => [game.id, game]));
  return dataset.playerStats.filter((row) => {
    const game = games.get(row.gameId);
    if (
      row.teamId !== dal?.id ||
      row.participation !== "played" ||
      game?.status !== "final"
    )
      return false;
    if (filters.season !== undefined && game.season !== filters.season)
      return false;
    if (filters.competition && game.competition !== filters.competition)
      return false;
    if (
      filters.opponentId &&
      ![game.homeTeamId, game.awayTeamId].includes(filters.opponentId)
    )
      return false;
    const venue =
      game.neutral === null
        ? "unknown"
        : game.neutral
          ? "neutral"
          : game.homeTeamId === dal?.id
            ? "home"
            : "away";
    return !filters.venue || venue === filters.venue;
  });
}
export async function readLeaderboard(
  filters: RecordFilters & { stat: StatKey },
): Promise<LeaderboardRow[]> {
  const db = await database();
  if (db.isRecordsDatabaseConfigured())
    return db.readDatabaseLeaderboard(filters);
  const { dataset } = await readRecordDataset();
  const rows = localRows(dataset, filters);
  return [...new Set(rows.map((row) => row.playerId))]
    .map((playerId) => {
      const selected = rows.filter((row) => row.playerId === playerId);
      const known = selected.filter((row) => row.values[filters.stat] !== null);
      return {
        playerId,
        games: selected.length,
        known: known.length,
        value:
          known.length === selected.length
            ? known.reduce((sum, row) => sum + row.values[filters.stat]!, 0)
            : null,
      };
    })
    .sort(
      (a, b) =>
        (b.value ?? -Infinity) - (a.value ?? -Infinity) ||
        a.playerId.localeCompare(b.playerId),
    );
}
export async function readComparison(
  filters: RecordFilters & { playerIds: string[] },
): Promise<ComparisonRow[]> {
  const db = await database();
  if (db.isRecordsDatabaseConfigured())
    return db.readDatabaseComparison(filters);
  const { dataset } = await readRecordDataset();
  const rows = localRows(dataset, filters);
  return filters.playerIds.slice(0, 2).map((playerId) => {
    const selected = rows.filter((row) => row.playerId === playerId);
    const known = Object.fromEntries(
      STAT_KEYS.map((key) => [
        key,
        selected.filter((row) => row.values[key] !== null).length,
      ]),
    );
    const values = Object.fromEntries(
      STAT_KEYS.map((key) => [
        key,
        known[key] && known[key] === selected.length
          ? selected.reduce((sum, row) => sum + (row.values[key] ?? 0), 0) /
            known[key]
          : null,
      ]),
    ) as StatValues;
    return { playerId, games: selected.length, known, values };
  });
}
