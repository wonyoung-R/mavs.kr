import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecordsPortal from "@/components/records/RecordsPortal";
import {
  catalogFromDataset,
  emptyRecordDataset,
} from "@/lib/records/repository";
import {
  readRecordCatalog,
  readRecordScope,
  queryRecords,
  readLeaderboard,
  readComparison,
  compactGameSnapshot,
} from "@/lib/records/server-repository";
import type {
  RecordFilters,
  PortalSnapshot,
  LeaderboardRow,
  ComparisonRow,
} from "@/lib/records/repository";
import { STAT_KEYS } from "@/lib/records/types";
import type { Competition, QueryResult, StatKey } from "@/lib/records/types";
import { recordHref } from "@/lib/records/paths";

export type RecordSection =
  | "home"
  | "search"
  | "seasons"
  | "players"
  | "records"
  | "compare"
  | "history"
  | "data"
  | "game"
  | "player";
export type PageSearch = Promise<Record<string, string | string[] | undefined>>;
const titles: Record<RecordSection, [string, string]> = {
  home: ["매버릭스 기록 검색", "Mavericks stats, in your words"],
  search: ["기록 검색", "Search stats"],
  seasons: ["시즌 기록", "Seasons"],
  players: ["매버릭스 선수", "Mavericks players"],
  records: ["구단 기록", "Records"],
  compare: ["선수 비교", "Compare players"],
  history: ["구단 역사", "Team history"],
  data: ["데이터와 출처", "Data & sources"],
  game: ["경기 기록", "Game box score"],
  player: ["선수 기록", "Player stats"],
};

export function recordMetadata(
  locale: "ko" | "en",
  section: RecordSection,
  path = "",
): Metadata {
  const ko = recordHref('ko', path);
  const en = recordHref('en', path);
  return {
    metadataBase: new URL("https://www.mavs.kr"),
    title: `${titles[section][locale === "ko" ? 0 : 1]} | MAVS.KR`,
    description:
      locale === "ko"
        ? "댈러스 매버릭스의 경기·선수·시즌 기록. 검색 조건, 출처, 제공 범위를 함께 확인하세요."
        : "Explore Dallas Mavericks game, player and season stats with transparent filters, sources and coverage.",
    alternates: {
      canonical: locale === "ko" ? ko : en,
      languages: { ko, en, "x-default": ko },
    },
    openGraph: {
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: locale === "ko" ? "en_US" : "ko_KR",
    },
    robots:
      section === "search" || section === "compare"
        ? { index: false, follow: true }
        : undefined,
  };
}

export async function recordPage(
  locale: "ko" | "en",
  section: RecordSection,
  searchParams?: PageSearch,
  recordId?: string,
) {
  const params = await (searchParams ??
    Promise.resolve<Record<string, string | string[] | undefined>>({}));
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const q = value("q").slice(0, 500);
  let snapshot: PortalSnapshot;
  let queryResult: QueryResult | null = null;
  let leaderboard: LeaderboardRow[] = [];
  let comparison: ComparisonRow[] = [];
  let selectedSeason = /^\d{4}$/.test(value("season"))
    ? value("season")
    : "all";
  const page = /^\d+$/.test(value("page"))
    ? Math.max(1, Math.min(100, Number(value("page"))))
    : 1;
  try {
    snapshot = await readRecordCatalog();
    if (section === "seasons" && (!selectedSeason || selectedSeason === "all"))
      selectedSeason = String(snapshot.availableSeasons[0] ?? "all");
    const allowedCompetitions: Competition[] = [
      "regular",
      "playoffs",
      "playin",
      "cup_final",
      "preseason",
      "summer",
    ];
    const filters: RecordFilters = {
      releaseId: snapshot.releaseId ?? undefined,
      season: /^\d{4}$/.test(selectedSeason)
        ? Number(selectedSeason)
        : undefined,
      competition: allowedCompetitions.includes(
        value("competition") as Competition,
      )
        ? (value("competition") as Competition)
        : "regular",
      venue: ["home", "away", "neutral"].includes(value("venue"))
        ? (value("venue") as RecordFilters["venue"])
        : undefined,
      opponentId: snapshot.dataset.teams.some(
        (team) => team.id === value("opponent"),
      )
        ? value("opponent")
        : undefined,
    };
    const metric =
      value("metric") !== "MIN_SECONDS" &&
      STAT_KEYS.includes(value("metric") as StatKey)
        ? (value("metric") as StatKey)
        : "PTS";
    if (section === "game")
      snapshot = await readRecordScope({
        kind: "game",
        id: recordId,
        releaseId: snapshot.releaseId ?? undefined,
      });
    else if (section === "player")
      snapshot = await readRecordScope({
        kind: "player",
        id: recordId,
        ...filters,
        offset: (page - 1) * 200,
        limit: 200,
      });
    else if (section === "seasons")
      snapshot = await readRecordScope({
        kind: "season",
        ...filters,
        limit: 200,
      });
    else if (section === "home")
      snapshot = await readRecordScope({
        kind: "season",
        limit: 8,
        releaseId: snapshot.releaseId ?? undefined,
      });
    else if (section === "search" && q)
      queryResult = await queryRecords(q, snapshot.releaseId ?? undefined);
    else if (section === "records")
      leaderboard = await readLeaderboard({ ...filters, stat: metric });
    else if (section === "compare" && value("p1") && value("p2"))
      comparison = await readComparison({
        ...filters,
        playerIds: [value("p1"), value("p2")].filter((id) =>
          snapshot.dalPlayerIds.includes(id),
        ),
      });
  } catch {
    snapshot = catalogFromDataset({
      dataset: emptyRecordDataset(),
      status: "invalid",
      message: "The archive is temporarily unavailable.",
    });
  }
  if (recordId && snapshot.status !== "invalid") {
    const exists =
      section === "game"
        ? snapshot.dataset.games.some((game) => game.id === recordId)
        : snapshot.dalPlayerIds.includes(recordId);
    if (!exists) notFound();
  }
  if (section === "game" && recordId)
    snapshot = compactGameSnapshot(snapshot, recordId);
  return (
    <RecordsPortal
      key={`${section}:${recordId ?? ""}:${JSON.stringify(params)}`}
      locale={locale}
      section={section}
      query={q}
      recordId={recordId}
      snapshot={snapshot}
      searchParameters={new URLSearchParams(
        Object.entries(params).flatMap(([key, entry]) =>
          typeof entry === "string" ? [[key, entry]] : [],
        ),
      ).toString()}
      queryResult={queryResult}
      leaderboard={leaderboard}
      comparison={comparison}
      selectedSeason={selectedSeason || "all"}
      page={page}
    />
  );
}
