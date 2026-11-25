// Next-only adapter. CLI import/verification continues to use repository.ts.
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import {
  recordReadRepository,
  readLeaderboard as readUncachedLeaderboard,
  readComparison as readUncachedComparison,
  RecordReleaseError,
  requireRecordRelease,
} from "./repository";
import type { PortalSnapshot, RecordFilters, RecordScope } from "./repository";
import type { QueryResult, StatKey } from "./types";
import { parseQuery } from "./query";
import { getRecordsDatabaseUrl } from "./connection";

const CURRENT_SECONDS = 60;
const RELEASE_SECONDS = 86400;
const RELEASE_ID = /^r_[a-f0-9]{24}$/;
type Backend = typeof recordReadRepository & {
  readLeaderboard: typeof readUncachedLeaderboard;
  readComparison: typeof readUncachedComparison;
};
type CacheFunction = <T>(
  load: () => Promise<T>,
  keys: string[],
  options: { revalidate: number },
) => () => Promise<T>;

export function recordsCacheNamespace(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const databaseUrl = getRecordsDatabaseUrl(env);
  if (!databaseUrl || env.RECORDS_DATA_BACKEND === "local") return null;
  // The database identity isolates projects; credentials never enter cache keys.
  return createHash("sha256").update(databaseUrl).digest("hex");
}

class UncacheableResult<T> extends Error {
  constructor(readonly result: T) {
    super("Records result must not be cached.");
  }
}

function validateRelease(releaseId?: string) {
  if (releaseId !== undefined && !RELEASE_ID.test(releaseId))
    throw new RecordReleaseError(400, "Invalid record release ID.");
}

function normalizedFilters(
  filters: RecordFilters,
  releaseId: string,
): RecordFilters {
  return {
    releaseId,
    season: filters.season,
    competition: filters.competition,
    venue: filters.venue,
    opponentId: filters.opponentId || undefined,
  };
}

function normalizedScope(scope: RecordScope, releaseId: string): RecordScope {
  if (scope.kind === "game") return { kind: "game", id: scope.id, releaseId };
  return {
    ...normalizedFilters(scope, releaseId),
    kind: scope.kind,
    id: scope.kind === "player" ? scope.id : undefined,
    offset: Math.max(
      0,
      Number.isFinite(scope.offset) ? Math.trunc(scope.offset!) : 0,
    ),
    limit: Math.max(
      1,
      Math.min(
        200,
        Number.isFinite(scope.limit) ? Math.trunc(scope.limit!) : 200,
      ),
    ),
  };
}

export function isRecordScopeCacheable(
  snapshot: PortalSnapshot,
  scope: RecordScope,
): boolean {
  if (snapshot.status === "invalid" || !snapshot.releaseId) return false;
  if (scope.kind === "game")
    return snapshot.dataset.games.some((game) => game.id === scope.id);
  if (scope.kind === "player")
    return snapshot.dalPlayerIds.includes(scope.id ?? "");
  return true;
}

export function compactGameSnapshot(
  snapshot: PortalSnapshot,
  gameId: string,
): PortalSnapshot {
  const dataset = snapshot.dataset;
  const games = dataset.games.filter((game) => game.id === gameId);
  const playerStats = dataset.playerStats.filter(
    (row) => row.gameId === gameId,
  );
  const teamStats = dataset.teamStats.filter((row) => row.gameId === gameId);
  const teams = new Set(
    games.flatMap((game) => [game.homeTeamId, game.awayTeamId]),
  );
  const players = new Set(playerStats.map((row) => row.playerId));
  const sources = new Set(
    [...games, ...playerStats, ...teamStats].map((row) => row.sourceId),
  );
  return {
    ...snapshot,
    dataset: {
      version: dataset.version,
      teams: dataset.teams.filter((team) => teams.has(team.id)),
      players: dataset.players
        .filter((player) => players.has(player.id))
        .map(({ id, name, nameKo, aliases }) => ({
          id,
          name,
          nameKo,
          aliases,
        })),
      games,
      playerStats,
      teamStats,
      sources: dataset.sources.filter((source) => sources.has(source.id)),
      coverage: dataset.coverage.filter((row) =>
        games.some(
          (game) =>
            game.season === row.season && game.competition === row.competition,
        ),
      ),
    },
  };
}

// Dependency injection tests cache behavior without connecting to Supabase or
// requiring a Next request context. Default backend dispatch remains mockable.
export function createServerRecordRepository(
  options: {
    cache?: CacheFunction;
    backend?: Backend;
    namespace?: () => string | null;
  } = {},
) {
  const cache: CacheFunction =
    options.cache ??
    ((load, keys, config) => unstable_cache(load, keys, config));
  const backend = options.backend ?? {
    readRecordCatalog: (...args: Parameters<Backend["readRecordCatalog"]>) =>
      recordReadRepository.readRecordCatalog(...args),
    readRecordScope: (...args: Parameters<Backend["readRecordScope"]>) =>
      recordReadRepository.readRecordScope(...args),
    queryRecords: (...args: Parameters<Backend["queryRecords"]>) =>
      recordReadRepository.queryRecords(...args),
    readLeaderboard: readUncachedLeaderboard,
    readComparison: readUncachedComparison,
  };
  const namespace = options.namespace ?? recordsCacheNamespace;

  async function cached<T>(
    kind: string,
    key: unknown,
    seconds: number,
    load: () => Promise<T>,
    eligible: (value: T) => boolean,
  ): Promise<T> {
    const space = namespace();
    if (!space) return load();
    try {
      return await cache(
        async () => {
          const result = await load();
          if (!eligible(result)) throw new UncacheableResult(result);
          return result;
        },
        ["mavs-records-v2", space, kind, JSON.stringify(key)],
        { revalidate: seconds },
      )();
    } catch (error) {
      if (error instanceof UncacheableResult) return error.result as T;
      throw error;
    }
  }

  async function readRecordCatalog(
    releaseId?: string,
  ): Promise<PortalSnapshot> {
    validateRelease(releaseId);
    return cached(
      "catalog",
      releaseId ?? "current",
      releaseId ? RELEASE_SECONDS : CURRENT_SECONDS,
      async () => {
        const result = await backend.readRecordCatalog(releaseId);
        requireRecordRelease(releaseId, result.releaseId);
        return result;
      },
      (result) =>
        result.status === "ready" && RELEASE_ID.test(result.releaseId ?? ""),
    );
  }

  async function readRecordScope(scope: RecordScope): Promise<PortalSnapshot> {
    validateRelease(scope.releaseId);
    if (!namespace()) return backend.readRecordScope(scope);
    const releaseId = scope.releaseId ?? (await readRecordCatalog()).releaseId;
    if (!releaseId) return backend.readRecordScope(scope);
    const pinned = normalizedScope(scope, releaseId);
    return cached(
      "scope",
      pinned,
      RELEASE_SECONDS,
      async () => {
        const result = await backend.readRecordScope(pinned);
        requireRecordRelease(releaseId, result.releaseId);
        return result;
      },
      (result) => isRecordScopeCacheable(result, pinned),
    );
  }

  async function queryRecords(
    query: string,
    releaseId?: string,
  ): Promise<QueryResult & { releaseId: string | null }> {
    validateRelease(releaseId);
    if (!namespace()) return backend.queryRecords(query, releaseId);
    const catalog = await readRecordCatalog(releaseId);
    if (!catalog.releaseId || catalog.status !== "ready")
      return backend.queryRecords(query, releaseId);
    const parsed = parseQuery(query, catalog.dataset);
    if (parsed.status !== "ok")
      return {
        ...parsed,
        releaseId: catalog.releaseId,
        rows: [],
        summaries: [],
        total: 0,
        coverage: [],
        incomplete: true,
      };
    return cached(
      "query",
      [catalog.releaseId, parsed.plan],
      RELEASE_SECONDS,
      async () => {
        const result = await backend.queryRecords(query, catalog.releaseId!);
        requireRecordRelease(catalog.releaseId!, result.releaseId);
        return result;
      },
      (result) => result.status === "ready" || result.status === "empty",
    );
  }

  async function readLeaderboard(filters: RecordFilters & { stat: StatKey }) {
    validateRelease(filters.releaseId);
    if (!namespace()) return backend.readLeaderboard(filters);
    const catalog = await readRecordCatalog(filters.releaseId);
    if (!catalog.releaseId || catalog.status !== "ready")
      return backend.readLeaderboard(filters);
    const pinned = {
      ...normalizedFilters(filters, catalog.releaseId),
      stat: filters.stat,
    };
    return cached(
      "leaderboard",
      pinned,
      RELEASE_SECONDS,
      () => backend.readLeaderboard(pinned),
      () => true,
    );
  }

  async function readComparison(
    filters: RecordFilters & { playerIds: string[] },
  ) {
    validateRelease(filters.releaseId);
    if (!namespace()) return backend.readComparison(filters);
    const catalog = await readRecordCatalog(filters.releaseId);
    if (!catalog.releaseId || catalog.status !== "ready")
      return backend.readComparison(filters);
    const playerIds = [...new Set(filters.playerIds)];
    if (
      !playerIds.length ||
      playerIds.some((id) => !catalog.dalPlayerIds.includes(id))
    )
      return backend.readComparison(filters);
    const pinned = {
      ...normalizedFilters(filters, catalog.releaseId),
      playerIds,
    };
    return cached(
      "comparison",
      pinned,
      RELEASE_SECONDS,
      () => backend.readComparison(pinned),
      () => true,
    );
  }
  return {
    readRecordCatalog,
    readRecordScope,
    queryRecords,
    readLeaderboard,
    readComparison,
  };
}

export const serverRecordRepository = createServerRecordRepository();
export const {
  readRecordCatalog,
  readRecordScope,
  queryRecords,
  readLeaderboard,
  readComparison,
} = serverRecordRepository;
