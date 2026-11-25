import test from "node:test";
import assert from "node:assert/strict";
import { executeQuery, parseQuery } from "../../src/lib/records/query";
import { emptyRecordDataset } from "../../src/lib/records/repository";
import {
  STAT_KEYS,
  type RecordDataset,
  type StatValues,
} from "../../src/lib/records/types";
import {
  presentQuery,
  formatQueryValue,
  querySuggestions,
  relatedQuerySuggestions,
} from "../../src/components/records/query-presentation";

function values(points: number | null, seconds = 1200): StatValues {
  return Object.fromEntries(
    STAT_KEYS.map((key) => [
      key,
      key === "PTS" ? points : key === "MIN_SECONDS" ? seconds : 0,
    ]),
  ) as StatValues;
}
function fixture(): RecordDataset {
  const dataset = emptyRecordDataset();
  dataset.players = [
    {
      id: "dirk",
      name: "Dirk Nowitzki",
      nameKo: "디르크 노비츠키",
      aliases: ["dirk", "노비츠키"],
    },
    {
      id: "other",
      name: "Other Player",
      nameKo: "다른 선수",
      aliases: ["other"],
    },
  ];
  dataset.teams = [
    {
      id: "dal",
      abbreviation: "DAL",
      name: "Dallas Mavericks",
      nameKo: "댈러스",
      aliases: ["mavs"],
    },
    {
      id: "mia",
      abbreviation: "MIA",
      name: "Miami Heat",
      nameKo: "마이애미",
      aliases: ["heat"],
    },
  ];
  for (let i = 0; i < 2; i++) {
    dataset.games.push({
      id: `g${i}`,
      season: 2010,
      competition: "playoffs",
      date: `2011-06-0${i + 1}`,
      tipoffUtc: null,
      homeTeamId: i ? "mia" : "dal",
      awayTeamId: i ? "dal" : "mia",
      neutral: false,
      status: "final",
      homeScore: 100,
      awayScore: 90,
      sourceId: "source",
      sourceGameId: `g${i}`,
      cup: false,
    });
    dataset.playerStats.push({
      gameId: `g${i}`,
      playerId: "dirk",
      teamId: "dal",
      participation: "played",
      starter: true,
      reason: null,
      values: values(i ? 40 : 20, i ? 1425 : 1350),
      sourceId: "source",
    });
  }
  dataset.playerStats.push({
    ...dataset.playerStats[0],
    playerId: "other",
    values: values(60),
  });
  dataset.coverage = [
    {
      season: 2010,
      competition: "playoffs",
      dataset: "games",
      field: "all",
      expected: 2,
      observed: 2,
      status: "complete",
      evidence: "Synthetic verified game scope",
    },
    {
      season: 2010,
      competition: "playoffs",
      dataset: "playerStats",
      field: "all",
      expected: 3,
      observed: 3,
      status: "complete",
      evidence: "Synthetic verified player scope",
    },
  ];
  return dataset;
}

test("all-player average explains player-game denominator, not team per-game statistics", () => {
  const d = fixture();
  const p = presentQuery(
    executeQuery("2010 playoffs average points", d),
    d,
    "ko",
  );
  assert.equal(p.answers[0].value, "40");
  assert.match(p.answers[0].detail, /3개 선수-경기 행 · 2개 고유 경기/);
  assert.match(p.context, /팀 경기당 수치가 아닌/);
  assert.equal(p.scope, "DAL 소속 선수 전체");
});
test("aggregate uses all matches while evidence-row limit remains visible", () => {
  const d = fixture();
  const result = executeQuery("2010 playoffs total points top 1", d);
  const p = presentQuery(result, d, "en");
  assert.equal(p.answers[0].value, "120");
  assert.equal(p.rowsLabel, "Showing 1 of 3 player-game rows");
  assert.match(p.chips.at(-1)!, /up to 1 rows/);
});
test("games means player-game rows and does not imply player ranking", () => {
  const d = fixture();
  const p = presentQuery(
    executeQuery("2010 playoffs points top 1", d),
    d,
    "ko",
  );
  assert.equal(p.answers[0].value, "3");
  assert.equal(p.answers[0].unit, "행");
  assert.match(p.answers[0].detail, /선수별 시즌 순위가 아닙니다/);
});
test("count displays distinct games instead of matching player rows", () => {
  const d = fixture();
  const result = executeQuery("2010 playoffs count at least 0 points", d);
  const p = presentQuery(result, d, "en");
  assert.equal(result.total, 3);
  assert.equal(p.answers[0].value, "2");
  assert.equal(p.answers[0].unit, "games");
});
test("unknown count is unconfirmed, while a verified zero remains zero", () => {
  const d = fixture();
  const zero = presentQuery(
    executeQuery("2010 playoffs count over 99 points", d),
    d,
    "ko",
  );
  assert.equal(zero.answers[0].value, "0");
  d.coverage = [];
  const unknown = presentQuery(
    executeQuery("2010 playoffs count over 99 points", d),
    d,
    "ko",
  );
  assert.equal(unknown.answers[0].value, "미확정");
  assert.match(unknown.coverage, /불완전/);
});
test("missing aggregate remains null and is never rendered as zero", () => {
  const d = fixture();
  d.playerStats[0].values.PTS = null;
  const p = presentQuery(
    executeQuery("2010 playoffs total points", d),
    d,
    "ko",
  );
  assert.equal(p.answers[0].value, "미확정");
  assert.match(p.answers[0].detail, /미기록: 1/);
  assert.match(p.coverage, /확보된 기록/);
});
test("comparison preserves individual averages, order and game denominators", () => {
  const d = fixture();
  const p = presentQuery(
    executeQuery("other vs dirk 2010 playoffs compare points", d),
    d,
    "en",
  );
  assert.deepEqual(
    p.answers.map((a) => a.value),
    ["60", "30"],
  );
  assert.match(p.answers[0].label, /^Other Player/);
  assert.match(p.answers[1].detail, /2 distinct games/);
});
test("single-player aggregation uses that player’s game denominator", () => {
  const d = fixture();
  const p = presentQuery(
    executeQuery("dirk 2010 playoffs average points", d),
    d,
    "ko",
  );
  assert.equal(p.answers[0].value, "30");
  assert.match(p.answers[0].detail, /^2개 고유 경기/);
});
test("duration is formatted as minutes and seconds, including sum and rounded average", () => {
  const d = fixture();
  assert.equal(
    presentQuery(executeQuery("dirk 2010 playoffs total minutes", d), d, "en")
      .answers[0].value,
    "46:15",
  );
  assert.equal(
    presentQuery(executeQuery("dirk 2010 playoffs average minutes", d), d, "en")
      .answers[0].value,
    "23:08",
  );
  assert.equal(formatQueryValue(0, "MIN_SECONDS"), "0:00");
  assert.equal(formatQueryValue(null, "MIN_SECONDS"), "미확정");
});
test("every parsed restriction is visible, including duration threshold units", () => {
  const d = fixture();
  const p = presentQuery(
    executeQuery(
      "dirk 2010 playoffs home heat at least 20 minutes lowest top 5",
      d,
    ),
    d,
    "ko",
  );
  assert.ok(p.chips.includes("디르크 노비츠키"));
  assert.ok(p.chips.includes("2010–11"));
  assert.ok(p.chips.includes("플레이오프"));
  assert.ok(p.chips.includes("홈"));
  assert.ok(p.chips.includes("상대: 마이애미"));
  assert.ok(p.chips.includes("출전시간 ≥ 20:00 (분:초)"));
  assert.match(p.chips.at(-1)!, /낮은 값부터 · 최대 5행/);
});
test("unsupported and ambiguous results never manufacture a numeric answer", () => {
  const d = fixture();
  for (const query of ["dirk clutch points", "dirk 2010 2011 points"]) {
    const p = presentQuery(executeQuery(query, d), d, "en");
    assert.deepEqual(p.answers, []);
    assert.deepEqual(p.chips, []);
  }
});
test("examples parse in both languages and never combine a retired player with a latest season", () => {
  const d = fixture();
  for (const locale of ["ko", "en"] as const) {
    const questions = querySuggestions(d, [2024, 2010], locale, ["dirk"]);
    assert.equal(questions.length, 3);
    for (const q of questions) assert.equal(parseQuery(q, d).status, "ok");
    assert.ok(questions[0].includes("2024-25"));
    assert.ok(!questions[2].includes("2024"));
  }
});
test("follow-up questions are independently parseable and preserve duration thresholds", () => {
  const d = fixture();
  const result = executeQuery(
    "dirk 2010 playoffs away heat at least 20 minutes",
    d,
  );
  for (const locale of ["ko", "en"] as const) {
    const questions = relatedQuerySuggestions(result, d, locale);
    assert.ok(questions.length > 0);
    for (const q of questions) {
      const parsed = parseQuery(q, d);
      assert.equal(parsed.status, "ok");
      if (parsed.status === "ok" && parsed.plan.stat === "MIN_SECONDS")
        assert.equal(parsed.plan.threshold?.value, 1200);
    }
  }
});
test("threshold aggregation description states the threshold is applied first", () => {
  const d = fixture();
  const p = presentQuery(
    executeQuery("2010 playoffs average at least 30 points", d),
    d,
    "en",
  );
  assert.equal(p.answers[0].value, "50");
  assert.match(p.context, /threshold is applied before aggregation/);
});
