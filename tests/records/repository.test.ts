import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogFromDataset,
  emptyRecordDataset,
  scopeDataset,
} from "../../src/lib/records/repository";
import {
  STAT_KEYS,
  type DatasetReadResult,
  type StatValues,
} from "../../src/lib/records/types";

function fixture(): DatasetReadResult {
  const dataset = emptyRecordDataset();
  dataset.teams = [
    { id: "dal", abbreviation: "DAL", name: "Dallas", nameKo: "", aliases: [] },
    { id: "mia", abbreviation: "MIA", name: "Miami", nameKo: "", aliases: [] },
  ];
  dataset.players = [
    { id: "dal-player", name: "Maverick Player", nameKo: "", aliases: [] },
    { id: "opponent", name: "Opponent Player", nameKo: "", aliases: [] },
  ];
  const values = Object.fromEntries(
    STAT_KEYS.map((key) => [key, key === "PTS" ? 0 : null]),
  ) as StatValues;
  for (let index = 0; index < 405; index++) {
    const id = `g${String(index).padStart(3, "0")}`;
    dataset.games.push({
      id,
      season: index < 205 ? 2023 : 2024,
      competition: "regular",
      date: "2024-01-01",
      tipoffUtc: null,
      homeTeamId: "dal",
      awayTeamId: "mia",
      homeScore: 90,
      awayScore: 80,
      neutral: index === 404 ? null : false,
      status: "final",
      sourceId: "source",
      sourceGameId: id,
      cup: false,
    });
    for (const [teamId, playerId] of [
      ["dal", "dal-player"],
      ["mia", "opponent"],
    ])
      dataset.playerStats.push({
        gameId: id,
        teamId,
        playerId,
        participation: "played",
        starter: null,
        reason: null,
        values,
        sourceId: "source",
      });
  }
  dataset.coverage = [
    {
      season: 2024,
      competition: "regular",
      dataset: "games",
      field: "all",
      expected: null,
      observed: 200,
      status: "partial",
      evidence: "Synthetic fixture",
    },
  ];
  return { dataset, status: "ready" };
}

test("catalog carries DAL players and global counts without game/stat payload", () => {
  const catalog = catalogFromDataset(fixture());
  assert.equal(catalog.totalGames, 405);
  assert.equal(catalog.totalPlayerStatRows, 810);
  assert.deepEqual(catalog.availableSeasons, [2024, 2023]);
  assert.deepEqual(
    catalog.dataset.players.map((player) => player.id),
    ["dal-player"],
  );
  assert.deepEqual(
    [
      catalog.dataset.games.length,
      catalog.dataset.playerStats.length,
      catalog.dataset.teamStats.length,
    ],
    [0, 0, 0],
  );
});
test("season scope returns only the selected game ledger, preserves global coverage", () => {
  const scope = scopeDataset(fixture(), {
    kind: "season",
    season: 2024,
    competition: "regular",
  });
  assert.equal(scope.dataset.games.length, 200);
  assert.ok(scope.dataset.games.every((game) => game.season === 2024));
  assert.equal(scope.dataset.playerStats.length, 0);
  assert.equal(scope.totalGames, 405);
  assert.equal(scope.dataset.coverage[0].observed, 200);
});
test("player pagination caps 200 DAL rows and does not include opponent statistics", () => {
  const first = scopeDataset(fixture(), {
    kind: "player",
    id: "dal-player",
    limit: 500,
  });
  const second = scopeDataset(fixture(), {
    kind: "player",
    id: "dal-player",
    offset: 200,
    limit: 200,
  });
  assert.equal(first.dataset.playerStats.length, 200);
  assert.equal(first.scopeTotal, 405);
  assert.ok(
    first.dataset.playerStats.every((row) => row.playerId === "dal-player"),
  );
  assert.equal(first.dataset.playerStats[0].values.PTS, 0);
  assert.equal(first.dataset.playerStats[0].values.REB, null);
  const firstIds = new Set(first.dataset.games.map((game) => game.id));
  assert.ok(second.dataset.games.every((game) => !firstIds.has(game.id)));
});
test("game detail includes the opposing player without adding them to the DAL catalog", () => {
  const scope = scopeDataset(fixture(), { kind: "game", id: "g404" });
  assert.equal(scope.dataset.games.length, 1);
  assert.equal(scope.dataset.playerStats.length, 2);
  assert.ok(scope.dataset.players.some((player) => player.id === "opponent"));
  assert.deepEqual(scope.dalPlayerIds, ["dal-player"]);
});
test("unknown venue is excluded from explicit home filter before pagination", () => {
  const scope = scopeDataset(fixture(), {
    kind: "player",
    id: "dal-player",
    venue: "home",
    limit: 200,
  });
  assert.equal(scope.scopeTotal, 404);
  assert.equal(scope.dataset.games.length, 200);
  assert.ok(scope.dataset.games.every((game) => game.neutral === false));
  assert.ok(!scope.dataset.games.some((game) => game.id === "g404"));
});

test("player scope omits raw advanced metadata while game detail preserves it", () => {
  const data = fixture();
  Object.assign(data.dataset.playerStats[0], {
    advanced: { original: "Provider raw record" },
  });
  const player = scopeDataset(data, {
    kind: "player",
    id: "dal-player",
    offset: 400,
  });
  assert.ok(player.dataset.playerStats.every((row) => !("advanced" in row)));
  const game = scopeDataset(data, { kind: "game", id: "g000" });
  assert.deepEqual(
    (
      game.dataset.playerStats[0] as (typeof game.dataset.playerStats)[0] & {
        advanced: unknown;
      }
    ).advanced,
    { original: "Provider raw record" },
  );
});
