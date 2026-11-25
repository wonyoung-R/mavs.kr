import { parseQuery } from "../../lib/records/query";
import type {
  Competition,
  QueryPlan,
  QueryResult,
  RecordDataset,
  StatKey,
} from "../../lib/records/types";

type Locale = "ko" | "en";
const metrics: Record<StatKey, [string, string]> = {
  PTS: ["득점", "points"],
  REB: ["리바운드", "rebounds"],
  AST: ["어시스트", "assists"],
  STL: ["스틸", "steals"],
  BLK: ["블록", "blocks"],
  TOV: ["턴오버", "turnovers"],
  FG3M: ["3점슛 성공", "threes"],
  MIN_SECONDS: ["출전시간", "minutes"],
  PLUS_MINUS: ["플러스마이너스", "plus minus"],
  PF: ["파울", "fouls"],
  FGM: ["야투 성공", "field goals made"],
  FGA: ["야투 시도", "field goals attempted"],
  FG3A: ["3점슛 시도", "threes attempted"],
  FTM: ["자유투 성공", "free throws made"],
  FTA: ["자유투 시도", "free throws attempted"],
  OREB: ["공격 리바운드", "offensive rebounds"],
  DREB: ["수비 리바운드", "defensive rebounds"],
};
const competitions: Record<Competition, [string, string]> = {
  regular: ["정규시즌", "Regular season"],
  playoffs: ["플레이오프", "Playoffs"],
  playin: ["플레이인", "Play-in"],
  cup_final: ["컵 결승", "Cup final"],
  preseason: ["프리시즌", "Preseason"],
  summer: ["서머리그", "Summer league"],
};
const aggregationNames = {
  games: ["개별 경기 기록", "Individual game records"],
  average: ["평균", "Average"],
  sum: ["합계", "Total"],
  count: ["고유 경기 수", "Distinct game count"],
  compare: ["선수별 평균 비교", "Per-player average comparison"],
};
const choose = (pair: readonly string[], locale: Locale) =>
  pair[locale === "ko" ? 0 : 1];
export const queryStatLabel = (stat: StatKey, locale: Locale) =>
  choose(metrics[stat], locale);
export function formatQueryValue(
  value: number | null | undefined,
  stat: StatKey,
  locale: Locale = "ko",
): string {
  if (value === null || value === undefined)
    return locale === "ko" ? "미확정" : "Unconfirmed";
  if (stat === "MIN_SECONDS") {
    const seconds = Math.round(value);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
const seasonText = (season: number) =>
  `${season}–${String(season + 1).slice(-2)}`;
function playerLabel(id: string, dataset: RecordDataset, locale: Locale) {
  const player = dataset.players.find((item) => item.id === id);
  return player
    ? locale === "ko"
      ? player.nameKo || player.name
      : player.name
    : id;
}

export function presentQuery(
  result: QueryResult,
  dataset: RecordDataset,
  locale: Locale,
) {
  const ko = locale === "ko";
  const t = (kr: string, en: string) => (ko ? kr : en);
  const plan = result.plan;
  const base = {
    status: result.status,
    answers: [] as {
      label: string;
      value: string;
      unit: string;
      detail: string;
    }[],
    chips: [] as string[],
    scope: "",
    metric: plan?.stat ?? ("PTS" as StatKey),
    coverage: result.incomplete
      ? t(
          "확보된 기록 기준 · 범위 불완전",
          "Available records only · incomplete coverage",
        )
      : t("표시된 검증 범위 기준", "Within the verified scope"),
    rowsLabel: t(
      `${result.total.toLocaleString()}개 선수-경기 행 중 ${result.rows.length.toLocaleString()}개 표시`,
      `Showing ${result.rows.length.toLocaleString()} of ${result.total.toLocaleString()} player-game rows`,
    ),
    context: "",
  };
  if (!plan || result.status === "unsupported" || result.status === "ambiguous")
    return base;
  const stat = queryStatLabel(plan.stat, locale);
  const target = plan.playerIds.length
    ? plan.playerIds.map((id) => playerLabel(id, dataset, locale)).join(" · ")
    : t("DAL 소속 선수 전체", "All DAL players");
  base.scope = target;
  base.chips = [
    target,
    plan.season === undefined
      ? t("전체 확보 시즌", "All available seasons")
      : seasonText(plan.season),
    choose(competitions[plan.competition ?? "regular"], locale),
    stat,
    choose(aggregationNames[plan.aggregation], locale),
  ];
  if (plan.venue)
    base.chips.push(
      choose(
        {
          home: ["홈", "Home"],
          away: ["원정", "Away"],
          neutral: ["중립", "Neutral"],
        }[plan.venue],
        locale,
      ),
    );
  if (plan.opponentId) {
    const team = dataset.teams.find((item) => item.id === plan.opponentId);
    base.chips.push(
      `${t("상대", "Opponent")}: ${team ? (ko ? team.nameKo || team.name : team.name) : plan.opponentId}`,
    );
  }
  if (plan.threshold) {
    const symbols = { gte: "≥", gt: ">", lte: "≤", lt: "<", eq: "=" };
    base.chips.push(
      `${stat} ${symbols[plan.threshold.operator]} ${formatQueryValue(plan.threshold.value, plan.stat, locale)}${plan.stat === "MIN_SECONDS" ? t(" (분:초)", " (min:sec)") : ""}`,
    );
  }
  base.chips.push(
    t(
      `근거 표: ${plan.direction === "asc" ? "낮은" : "높은"} 값부터 · 최대 ${plan.limit}행`,
      `Evidence: ${plan.direction === "asc" ? "lowest" : "highest"} first · up to ${plan.limit} rows`,
    ),
  );
  base.context = plan.playerIds.length
    ? t(
        "DAL 재적 중 출전이 확인된 선수 경기기록입니다.",
        "Only confirmed player appearances while with DAL are included.",
      )
    : t(
        "팀 경기당 수치가 아닌, DAL 선수들의 개별 출전 기록을 계산합니다.",
        "Calculated from individual DAL player appearances, not team per-game statistics.",
      );
  if (plan.threshold)
    base.context += t(
      " 수치 조건을 먼저 적용한 뒤 집계합니다.",
      " The threshold is applied before aggregation.",
    );
  if (plan.aggregation === "games") {
    base.answers = [
      {
        label: t(
          `${stat} 조건에 맞는 선수-경기 기록`,
          `Player-game records matching ${stat}`,
        ),
        value: result.total.toLocaleString("en-US"),
        unit: t("행", "rows"),
        detail: t(
          "같은 경기의 여러 선수는 각각 1행입니다. 선수별 시즌 순위가 아닙니다.",
          "Different players in the same game count as separate rows. This is not a season player ranking.",
        ),
      },
    ];
    return base;
  }
  base.answers = result.summaries.map((summary) => {
    const count = plan.aggregation === "count";
    const label = summary.playerId
      ? `${playerLabel(summary.playerId, dataset, locale)} · ${t("평균", "Average")} ${stat}`
      : `${choose(aggregationNames[plan.aggregation], locale)}${count ? "" : ` ${stat}`}`;
    const denominator =
      summary.playerId || plan.playerIds.length === 1
        ? t(
            `${summary.games.toLocaleString()}개 고유 경기`,
            `${summary.games.toLocaleString()} distinct games`,
          )
        : t(
            `${result.total.toLocaleString()}개 선수-경기 행 · ${summary.games.toLocaleString()}개 고유 경기`,
            `${result.total.toLocaleString()} player-game rows · ${summary.games.toLocaleString()} distinct games`,
          );
    return {
      label,
      value:
        summary.value === null
          ? t("미확정", "Unconfirmed")
          : count
            ? summary.value.toLocaleString("en-US")
            : formatQueryValue(summary.value, plan.stat, locale),
      unit: count
        ? t("경기", "games")
        : plan.stat === "MIN_SECONDS"
          ? t("분:초", "min:sec")
          : stat,
      detail: `${denominator} · ${t("해당 지표 미기록", "missing values")}: ${summary.missing.toLocaleString()}${summary.value === null ? t(" · 0으로 대체하지 않습니다", " · never replaced with zero") : ""}`,
    };
  });
  return base;
}

/** Parser validation proves syntax, not data completeness or appearance in a particular season. */
export function querySuggestions(
  dataset: RecordDataset,
  seasons: number[],
  locale: Locale,
  playerIds: string[] = [],
) {
  const year = [...seasons].sort((a, b) => b - a)[0];
  const prefix =
    year === undefined ? "" : `${year}-${String(year + 1).slice(-2)} `;
  const player = playerIds
    .map((id) => dataset.players.find((p) => p.id === id))
    .find(Boolean);
  const name = player
    ? locale === "ko"
      ? player.nameKo || player.name
      : player.name
    : "";
  const candidates =
    locale === "ko"
      ? [
          `${prefix}평균 득점`,
          `${prefix}30득점 이상 경기`,
          name ? `${name} 평균 리바운드` : `${prefix}득점 상위 10`,
        ]
      : [
          `${prefix}average points`,
          `${prefix}games with at least 30 points`,
          name ? `${name} average rebounds` : `${prefix}points top 10`,
        ];
  return candidates.filter(
    (question) => parseQuery(question, dataset).status === "ok",
  );
}

function questionFromPlan(
  plan: QueryPlan,
  dataset: RecordDataset,
  locale: Locale,
) {
  if (locale === "ko") {
    const players = plan.playerIds
      .map((id) => playerLabel(id, dataset, locale))
      .join(" 와 ");
    const opponent = dataset.teams.find((team) => team.id === plan.opponentId);
    const value = plan.threshold
      ? plan.threshold.value / (plan.stat === "MIN_SECONDS" ? 60 : 1)
      : 0;
    const threshold = plan.threshold
      ? {
          gte: `${value} 이상`,
          gt: `${value} 초과`,
          lte: `${value} 이하`,
          lt: `${value} 미만`,
          eq: `정확히 ${value}`,
        }[plan.threshold.operator]
      : "";
    const metric = plan.stat === "FG3M" ? "3점슛" : metrics[plan.stat][0];
    const aggregation = {
      games: "",
      average: "평균",
      sum: "합계",
      count: "경기 수",
      compare: "비교",
    }[plan.aggregation];
    return `${players} ${plan.season ?? ""} ${plan.competition === "playoffs" ? "플레이오프" : "정규시즌"} ${plan.venue ? { home: "홈", away: "원정", neutral: "중립" }[plan.venue] : ""} ${opponent ? opponent.nameKo || opponent.name : ""} ${aggregation} ${metric} ${threshold} ${plan.direction === "asc" ? "최저" : ""} 상위 ${plan.limit}`
      .replace(/\s+/g, " ")
      .trim();
  }
  const players = plan.playerIds
    .map((id) => dataset.players.find((p) => p.id === id)?.name ?? "")
    .join(" vs ");
  const team = dataset.teams.find((t) => t.id === plan.opponentId)?.name ?? "";
  const threshold = plan.threshold
    ? {
        gte: `at least ${plan.threshold.value}`,
        gt: `over ${plan.threshold.value}`,
        lte: `${plan.threshold.value} or fewer`,
        lt: `under ${plan.threshold.value}`,
        eq: `exactly ${plan.threshold.value}`,
      }[plan.threshold.operator]
    : "";
  // The parser reads duration thresholds in minutes, while QueryPlan stores seconds.
  const durationThreshold =
    plan.stat === "MIN_SECONDS" && plan.threshold
      ? threshold.replace(
          String(plan.threshold.value),
          String(plan.threshold.value / 60),
        )
      : threshold;
  return `${players} ${plan.season ?? ""} ${plan.competition === "playoffs" ? "playoffs" : "regular season"} ${plan.venue ?? ""} ${team} ${plan.aggregation === "games" ? "" : plan.aggregation} ${metrics[plan.stat][1]} ${durationThreshold} ${plan.direction === "asc" ? "lowest" : ""} top ${plan.limit}`
    .replace(/\s+/g, " ")
    .trim();
}
export function relatedQuerySuggestions(
  result: QueryResult,
  dataset: RecordDataset,
  locale: Locale = "en",
) {
  if (!result.plan) return [];
  const plan = result.plan;
  const variants: QueryPlan[] = [
    { ...plan, aggregation: "games" },
    { ...plan, aggregation: "average" },
    {
      ...plan,
      stat: plan.stat === "REB" ? "PTS" : "REB",
      threshold: undefined,
      aggregation: plan.aggregation === "compare" ? "compare" : "average",
    },
  ];
  return [
    ...new Set(variants.map((p) => questionFromPlan(p, dataset, locale))),
  ].filter((question) => {
    const parsed = parseQuery(question, dataset);
    return (
      parsed.status === "ok" &&
      JSON.stringify(parsed.plan) !== JSON.stringify(plan)
    );
  });
}
