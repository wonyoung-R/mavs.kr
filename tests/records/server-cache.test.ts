import test from "node:test";
import assert from "node:assert/strict";
import {
  compactGameSnapshot,
  createServerRecordRepository,
  recordsCacheNamespace,
} from "../../src/lib/records/server-repository";
import {
  emptyRecordDataset,
  type PortalSnapshot,
} from "../../src/lib/records/repository";
import { STAT_KEYS, type StatValues } from "../../src/lib/records/types";
import { getRecordsDatabaseUrl } from "../../src/lib/records/connection";
import { isRecordsDatabaseConfigured } from "../../src/lib/records/database";

const release = "r_0123456789abcdef01234567";
const otherRelease = "r_abcdef0123456789abcdef01";
function snapshot(releaseId = release): PortalSnapshot {
  const dataset = emptyRecordDataset();
  dataset.teams = [
    {
      id: "dal",
      abbreviation: "DAL",
      name: "Dallas",
      nameKo: "댈러스",
      aliases: [],
    },
    {
      id: "chi",
      abbreviation: "CHI",
      name: "Chicago",
      nameKo: "시카고",
      aliases: [],
    },
    {
      id: "mia",
      abbreviation: "MIA",
      name: "Miami",
      nameKo: "마이애미",
      aliases: [],
    },
  ];
  dataset.players = [
    {
      id: "dirk",
      name: "Dirk Nowitzki",
      nameKo: "노비츠키",
      aliases: ["Dirk"],
    },
    { id: "opponent", name: "Opponent", nameKo: "", aliases: [] },
    { id: "other-dal", name: "Other Maverick", nameKo: "", aliases: [] },
  ];
  dataset.games = [
    {
      id: "game",
      season: 2010,
      competition: "playoffs",
      date: "2011-06-12",
      tipoffUtc: null,
      homeTeamId: "dal",
      awayTeamId: "chi",
      neutral: null,
      status: "final",
      homeScore: 100,
      awayScore: 90,
      sourceId: "source",
      sourceGameId: "game",
      cup: false,
    },
  ];
  const values = Object.fromEntries(
    STAT_KEYS.map((key) => [key, null]),
  ) as StatValues;
  dataset.playerStats = ["dirk", "opponent"].map((playerId) => ({
    playerId,
    gameId: "game",
    teamId: playerId === "dirk" ? "dal" : "chi",
    participation: "played",
    starter: true,
    reason: null,
    sourceId: "source",
    values,
  }));
  dataset.sources = ["source", "unrelated-source"].map((id) => ({
    id,
    name: id,
    url: "https://example.com",
    retrievedAt: "2026-01-01",
    transformVersion: "v1",
    rights: {
      storage: true,
      display: true,
      commercial: false,
      evidence: "test",
    },
  }));
  dataset.coverage = [2010, 2011].map((season) => ({
    season,
    competition: "playoffs",
    dataset: "games",
    field: "all",
    expected: 1,
    observed: 1,
    status: "partial",
    evidence: "test",
  }));
  return {
    dataset,
    status: "ready",
    releaseId,
    totalGames: 3956,
    availableSeasons: [2025, 2010],
    totalPlayerStatRows: 92120,
    dalPlayerIds: ["dirk", "other-dal"],
  };
}
function harness(namespace = "database-a") {
  const entries = new Map<string, unknown>();
  const writes: { kind: string; key: string; seconds: number }[] = [];
  const calls = {
    catalog: 0,
    scope: 0,
    query: 0,
    leaderboard: 0,
    comparison: 0,
  };
  const backend = {
    readRecordCatalog: async (id?: string) => {
      calls.catalog++;
      return snapshot(id);
    },
    readRecordScope: async (scope: { releaseId?: string }) => {
      calls.scope++;
      return snapshot(scope.releaseId);
    },
    queryRecords: async (_query: string, id?: string) => {
      calls.query++;
      return {
        status: "empty" as const,
        releaseId: id ?? release,
        rows: [],
        summaries: [],
        total: 0,
        coverage: [],
        incomplete: true,
      };
    },
    readLeaderboard: async () => {
      calls.leaderboard++;
      return [{ playerId: "dirk", games: 21, known: 21, value: 582 }];
    },
    readComparison: async () => {
      calls.comparison++;
      return [];
    },
  };
  const cache =
    <T>(
      load: () => Promise<T>,
      keys: string[],
      options: { revalidate: number },
    ) =>
    async () => {
      const key = JSON.stringify(keys);
      if (entries.has(key)) return structuredClone(entries.get(key)) as T;
      const result = await load();
      entries.set(key, structuredClone(result));
      writes.push({ kind: keys[2], key, seconds: options.revalidate });
      return result;
    };
  const reader = createServerRecordRepository({
    backend,
    cache,
    namespace: () => namespace,
  });
  return { reader, backend, calls, writes, entries, cache };
}

test("current catalogs refresh at 60 seconds and immutable releases cache for one day", async () => {
  const h = harness();
  await h.reader.readRecordCatalog();
  await h.reader.readRecordCatalog();
  await h.reader.readRecordCatalog(release);
  await h.reader.readRecordCatalog(release);
  assert.equal(h.calls.catalog, 2);
  assert.deepEqual(
    h.writes.map((item) => item.seconds),
    [60, 86400],
  );
  await h.reader.readRecordScope({
    kind: "game",
    id: "game",
    releaseId: release,
    competition: "regular",
  });
  await h.reader.readRecordScope({
    releaseId: release,
    kind: "game",
    id: "game",
  });
  await h.reader.readRecordScope({
    kind: "game",
    id: "game",
    releaseId: otherRelease,
  });
  assert.equal(h.calls.scope, 2);
  assert.equal(
    h.writes
      .filter((item) => item.kind === "scope")
      .every((item) => item.seconds === 86400),
    true,
  );
});

test("equivalent Korean and English query plans reuse the same release cache", async () => {
  const h = harness();
  const english = await h.reader.queryRecords(
    "Dirk 2010 playoffs total points",
    release,
  );
  const korean = await h.reader.queryRecords(
    "노비츠키 2010 플레이오프 득점 합계",
    release,
  );
  assert.deepEqual(korean, english);
  assert.equal(h.calls.query, 1);
  assert.equal(h.writes.filter((item) => item.kind === "query").length, 1);
  await h.reader.queryRecords("nonsense unrecognized", release);
  await h.reader.queryRecords("nonsense unrecognized", release);
  assert.equal(h.calls.query, 1);
  assert.equal(h.writes.filter((item) => item.kind === "query").length, 1);
});

test("invalid snapshots, missing IDs, mismatched releases, and failures are not stored", async () => {
  const h = harness();
  h.backend.readRecordCatalog = async () => {
    h.calls.catalog++;
    return { ...snapshot(), status: "invalid" };
  };
  await h.reader.readRecordCatalog();
  await h.reader.readRecordCatalog();
  assert.equal(h.calls.catalog, 2);
  assert.equal(h.entries.size, 0);
  await h.reader.readRecordScope({
    kind: "game",
    id: "missing",
    releaseId: release,
  });
  await h.reader.readRecordScope({
    kind: "game",
    id: "missing",
    releaseId: release,
  });
  assert.equal(h.calls.scope, 2);
  assert.equal(h.entries.size, 0);
  h.backend.readRecordScope = async () => snapshot(otherRelease);
  await assert.rejects(
    h.reader.readRecordScope({ kind: "game", id: "game", releaseId: release }),
    /not found/,
  );
  assert.equal(h.entries.size, 0);
  h.backend.readRecordCatalog = async () => {
    throw new Error("temporary failure");
  };
  await assert.rejects(h.reader.readRecordCatalog(), /temporary failure/);
  assert.equal(h.entries.size, 0);
});

test("local data bypasses Next cache and database namespaces never expose credentials", async () => {
  assert.equal(recordsCacheNamespace({}), null);
  assert.equal(
    recordsCacheNamespace({
      DATABASE_URL: "postgres://sensitive",
      RECORDS_DATA_BACKEND: "local",
    }),
    null,
  );
  const key = recordsCacheNamespace({ RECORDS_DATABASE_URL: "postgresql://sensitive:sensitive@localhost/records" });
  assert.match(key!, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(key!, /postgres|sensitive/);
  const h = harness();
  const local = createServerRecordRepository({
    backend: h.backend,
    cache: h.cache,
    namespace: () => null,
  });
  await local.readRecordCatalog();
  await local.readRecordCatalog();
  assert.equal(h.calls.catalog, 2);
  assert.equal(h.entries.size, 0);
  const otherDatabase = createServerRecordRepository({
    backend: h.backend,
    cache: h.cache,
    namespace: () => "database-b",
  });
  await h.reader.readRecordCatalog();
  await otherDatabase.readRecordCatalog();
  assert.equal(h.entries.size, 2);
});

test("leaderboards and comparisons reuse only the requested release and filters", async () => {
  const h = harness();
  const filters = {
    releaseId: release,
    season: 2010,
    competition: "playoffs" as const,
  };
  await h.reader.readLeaderboard({ ...filters, stat: "PTS" });
  await h.reader.readLeaderboard({ stat: "PTS", ...filters });
  await h.reader.readLeaderboard({ ...filters, stat: "REB" });
  assert.equal(h.calls.leaderboard, 2);
  await h.reader.readComparison({
    ...filters,
    playerIds: ["dirk", "other-dal"],
  });
  await h.reader.readComparison({
    ...filters,
    playerIds: ["dirk", "other-dal"],
  });
  assert.equal(h.calls.comparison, 1);
  assert.equal(
    h.writes
      .filter((item) => ["leaderboard", "comparison"].includes(item.kind))
      .every((item) => item.seconds === 86400),
    true,
  );
});

test("game payload includes only box score references while preserving archive totals", () => {
  const original = snapshot();
  const compact = compactGameSnapshot(original, "game");
  assert.deepEqual(
    compact.dataset.players.map((player) => player.id),
    ["dirk", "opponent"],
  );
  assert.deepEqual(
    compact.dataset.teams.map((team) => team.id),
    ["dal", "chi"],
  );
  assert.deepEqual(
    compact.dataset.sources.map((source) => source.id),
    ["source"],
  );
  assert.deepEqual(
    compact.dataset.coverage.map((row) => row.season),
    [2010],
  );
  assert.equal(compact.totalGames, 3956);
  assert.equal(compact.totalPlayerStatRows, 92120);
  assert.deepEqual(compact.dalPlayerIds, ["dirk", "other-dal"]);
  assert.deepEqual(compact.availableSeasons, [2025, 2010]);
  assert.equal(original.dataset.players.length, 3);
});

test("dedicated records connection is cacheable without a global database", () => {
  const key = recordsCacheNamespace({
    RECORDS_DATABASE_URL: "postgresql://reader:secret@localhost:55432/records",
  });
  assert.match(key!, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(key!, /reader|secret|localhost|55432/);
});

test("records cache follows the selected records database, not the unrelated global connection", () => {
  const records = "postgresql://reader:secret@localhost:55432/records";
  const global = "postgresql://app:other@cloud.example/postgres";
  assert.equal(
    recordsCacheNamespace({ RECORDS_DATABASE_URL: records, DATABASE_URL: global }),
    recordsCacheNamespace({ RECORDS_DATABASE_URL: records }),
  );
  assert.notEqual(
    recordsCacheNamespace({ RECORDS_DATABASE_URL: records, DATABASE_URL: global }),
    recordsCacheNamespace({ DATABASE_URL: global }),
  );
  assert.equal(
    recordsCacheNamespace({ RECORDS_DATABASE_URL: records, DATABASE_URL: "postgresql://another/global" }),
    recordsCacheNamespace({ RECORDS_DATABASE_URL: records, DATABASE_URL: global }),
  );
});

test("records connection resolution preserves the global URL and accepts dedicated-only configuration", () => {
  const global = "postgresql://app:password@cloud.example/postgres";
  const dedicated = "postgresql://reader:secret@localhost:55432/records";
  const env = { DATABASE_URL: global, RECORDS_DATABASE_URL: ` ${dedicated} ` };
  assert.equal(getRecordsDatabaseUrl(env), dedicated);
  assert.equal(env.DATABASE_URL, global);
  assert.equal(isRecordsDatabaseConfigured({ RECORDS_DATABASE_URL: dedicated }), true);
  assert.equal(isRecordsDatabaseConfigured({ DATABASE_URL: global }), false);
  assert.equal(isRecordsDatabaseConfigured({}), false);
});

test("blank dedicated URLs never fall back, while JSON local mode bypasses PostgreSQL", () => {
  const global = "postgresql://app:password@cloud.example/postgres";
  assert.equal(getRecordsDatabaseUrl({ DATABASE_URL: global }), undefined);
  assert.equal(getRecordsDatabaseUrl({ DATABASE_URL: global, RECORDS_DATABASE_URL: " \n " }), undefined);
  assert.equal(getRecordsDatabaseUrl({ RECORDS_DATABASE_URL: " " }), undefined);
  assert.equal(isRecordsDatabaseConfigured({ RECORDS_DATABASE_URL: " " }), false);
  assert.equal(recordsCacheNamespace({ DATABASE_URL: global, RECORDS_DATABASE_URL: " " }), recordsCacheNamespace({ DATABASE_URL: global }));
  const local = { DATABASE_URL: global, RECORDS_DATABASE_URL: "postgresql://reader/local", RECORDS_DATA_BACKEND: "local" };
  assert.equal(isRecordsDatabaseConfigured(local), false);
  assert.equal(recordsCacheNamespace(local), null);
});
