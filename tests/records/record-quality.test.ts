import test from "node:test";
import assert from "node:assert/strict";
import {
  auditPlayerPoints,
  hasVenueClassification,
} from "../../src/components/records/record-quality";
import {
  STAT_KEYS,
  type RecordPlayerStat,
  type StatValues,
} from "../../src/lib/records/types";

function row(
  participation: RecordPlayerStat["participation"],
  points: number | null,
): RecordPlayerStat {
  return {
    gameId: "game",
    teamId: "dal",
    playerId: participation,
    participation,
    starter: null,
    reason: null,
    sourceId: "source",
    values: Object.fromEntries(
      STAT_KEYS.map((key) => [key, key === "PTS" ? points : null]),
    ) as StatValues,
  };
}
test("venue filters require explicit known metadata, including catalog-only pages", () => {
  assert.equal(hasVenueClassification({}), false);
  assert.equal(hasVenueClassification({ venueClassifiedGames: 0 }), false);
  assert.equal(hasVenueClassification({ venueClassifiedGames: 2 }), true);
});
test("box score audit preserves team points and distinguishes unknown participation, missing points, and zero", () => {
  const rows = [
    row("played", 30),
    row("unknown", 12),
    row("played", 0),
    row("unknown", null),
    row("dnp", null),
    row("inactive", null),
  ];
  assert.deepEqual(auditPlayerPoints(rows, 50), {
    playerPoints: 42,
    teamPoints: 50,
    difference: -8,
    missingPoints: 1,
    unknownParticipation: 2,
  });
  assert.equal(rows[1].values.PTS, 12);
  assert.deepEqual(auditPlayerPoints([row("unknown", null)], null), {
    playerPoints: null,
    teamPoints: null,
    difference: null,
    missingPoints: 1,
    unknownParticipation: 1,
  });
  assert.equal(auditPlayerPoints([row("played", 0)], 0).difference, 0);
});
