"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  QueryResult,
  Competition,
  RecordGame,
  StatValues,
  StatKey,
} from "@/lib/records/types";
import type {
  PortalSnapshot,
  LeaderboardRow,
  ComparisonRow,
} from "@/lib/records/repository";
import styles from "./records.module.css";
import { auditPlayerPoints, hasVenueClassification } from "./record-quality";
import { organizeBoxScore } from "./box-score";
import { recordHref, recordLanguageHref } from "@/lib/records/paths";
import { presentQuery, querySuggestions, relatedQuerySuggestions, formatQueryValue } from "./query-presentation";

export type PortalSection =
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
interface Props {
  locale: "ko" | "en";
  section: PortalSection;
  query?: string;
  recordId?: string;
  snapshot: PortalSnapshot;
  searchParameters: string;
  queryResult: QueryResult | null;
  leaderboard: LeaderboardRow[];
  comparison: ComparisonRow[];
  selectedSeason: string;
  page: number;
}
const competitions: Competition[] = [
  "regular",
  "playoffs",
  "playin",
  "cup_final",
  "preseason",
  "summer",
];
const columns: StatKey[] = [
  "PTS",
  "REB",
  "AST",
  "STL",
  "BLK",
  "TOV",
  "PF",
  "OREB",
  "DREB",
  "FGM",
  "FGA",
  "FG3M",
  "FG3A",
  "FTM",
  "FTA",
  "PLUS_MINUS",
];
const competitionNames = {
  regular: ["정규시즌", "Regular season"],
  playoffs: ["플레이오프", "Playoffs"],
  playin: ["플레이인", "Play-in"],
  cup_final: ["컵 결승", "Cup final"],
  preseason: ["프리시즌", "Preseason"],
  summer: ["서머리그", "Summer league"],
};
const sectionNames = {
  home: ["매버릭스 기록", "Mavericks records"],
  search: ["기록 검색", "Search"],
  seasons: ["시즌 · 경기", "Seasons & games"],
  players: ["선수", "Players"],
  records: ["기록 순위", "Records"],
  compare: ["선수 비교", "Compare"],
  history: ["구단 역사", "History"],
  data: ["데이터 안내", "Data"],
  game: ["경기 기록", "Game records"],
  player: ["선수 기록", "Player records"],
};
const seasonLabel = (year: number) => `${year}–${String(year + 1).slice(-2)}`;
const number = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function RecordsPortal({
  locale,
  section,
  query = "",
  recordId,
  snapshot,
  searchParameters,
  queryResult,
  leaderboard,
  comparison,
  selectedSeason,
  page,
}: Props) {
  const ko = locale === "ko";
  const t = (kr: string, en: string) => (ko ? kr : en);
  const { dataset } = snapshot;
  const path = usePathname() || "/";
  const params = new URLSearchParams(searchParameters);
  const href = (suffix = "") => recordHref(locale, suffix);
  const languagePath = recordLanguageHref(locale, path, params.toString());
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [playerSearch, setPlayerSearch] = useState("");
  const [fullRecords, setFullRecords] = useState(false);
  const season = selectedSeason;
  const competition = competitions.includes(
    params.get("competition") as Competition,
  )
    ? params.get("competition")!
    : "regular";
  const venue = ["home", "away", "neutral"].includes(params.get("venue") || "")
    ? params.get("venue")!
    : "all";
  const opponent = dataset.teams.some(
    (team) => team.id === params.get("opponent"),
  )
    ? params.get("opponent")!
    : "all";
  const sort: StatKey = columns.includes(params.get("metric") as StatKey)
    ? (params.get("metric") as StatKey)
    : "PTS";
  const firstPlayer = params.get("p1") || "";
  const secondPlayer = params.get("p2") || "";
  const navigate = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    startTransition(() =>
      router.replace(`${path}?${next.toString()}`, { scroll: false }),
    );
  };
  const setSeason = (value: string) => navigate("season", value);
  const setCompetition = (value: string) => navigate("competition", value);
  const setVenue = (value: string) => navigate("venue", value);
  const setOpponent = (value: string) => navigate("opponent", value);
  const setSort = (value: StatKey) => navigate("metric", value);
  const setFirstPlayer = (value: string) => navigate("p1", value);
  const setSecondPlayer = (value: string) => navigate("p2", value);
  const dal = dataset.teams.find((team) => team.abbreviation === "DAL");
  const teamName = (id: string) => {
    const team = dataset.teams.find((item) => item.id === id);
    return team ? (ko ? team.nameKo || team.name : team.name) : id;
  };
  const historicalTeamName = (game: RecordGame, teamId: string) => {
    const historical =
      teamId === game.homeTeamId ? game.homeTeamName : game.awayTeamName;
    return historical || teamName(teamId);
  };
  const playerName = (id: string) => {
    const player = dataset.players.find((item) => item.id === id);
    return player ? (ko ? player.nameKo || player.name : player.name) : id;
  };
  const seasons = snapshot.availableSeasons;
  const venueAvailable = hasVenueClassification(snapshot);
  const filteredGames = useMemo(
    () =>
      dataset.games
        .filter(
          (game) =>
            (season === "all" || game.season === Number(season)) &&
            game.competition === competition &&
            (opponent === "all" ||
              game.homeTeamId === opponent ||
              game.awayTeamId === opponent) &&
            (venue === "all" ||
              (venue === "neutral"
                ? game.neutral
                : game.neutral === false &&
                  (venue === "home"
                    ? game.homeTeamId === dal?.id
                    : game.awayTeamId === dal?.id))),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dataset.games, season, competition, opponent, venue, dal?.id],
  );
  const selectedGameIds = new Set(filteredGames.map((game) => game.id));
  const suggestions = querySuggestions(dataset, seasons, locale, snapshot.dalPlayerIds);
  const presentation = queryResult ? presentQuery(queryResult, dataset, locale) : null;
  const related = queryResult ? relatedQuerySuggestions(queryResult, dataset, locale) : [];
  const primaryStat = queryResult?.plan?.stat ?? "PTS";
  const queryColumns: StatKey[] = fullRecords
    ? [primaryStat, ...columns.filter(key => key !== primaryStat), ...(primaryStat === "MIN_SECONDS" ? [] : ["MIN_SECONDS" as StatKey])]
    : [primaryStat];
  const title = sectionNames[section][ko ? 0 : 1];
  function Empty({ filtered = false }: { filtered?: boolean }) {
    return (
      <div className={styles.empty}>
        <h3>
          {t(
            filtered
              ? "이 조건에 표시할 기록이 없습니다"
              : "검증된 기록을 준비하고 있습니다",
            filtered
              ? "No records match these filters"
              : "Verified records are being prepared",
          )}
        </h3>
        <p>
          {t(
            "미확보 데이터를 0이나 추정값으로 채우지 않습니다. 데이터 안내에서 확보된 범위와 출처를 확인할 수 있습니다.",
            "Missing data is never filled with zero or estimated statistics. See Data for the available coverage and sources.",
          )}
        </p>
        <a href={href("/data")}>
          {t("데이터 범위 확인 →", "View data coverage →")}
        </a>
      </div>
    );
  }
  function SearchForm() {
    return (
      <div className={styles.searchDock}>
        <form action={href("/search")} method="get" className={styles.search}>
          <label htmlFor="records-query" className="sr-only">
            {t("기록 질문", "Record question")}
          </label>
          <input
            id="records-query"
            name="q"
            defaultValue={query}
            placeholder={t(
              "매버릭스 기록에 대해 질문하세요",
              "Ask a question about Mavericks records",
            )}
            maxLength={500}
            required
          />
          <button type="submit">
            {t("검색", "Search")} <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div className={styles.suggestions}>
          {suggestions.map((q) => (
            <a key={q} href={`${href("/search")}?q=${encodeURIComponent(q)}`}>
              {q}
            </a>
          ))}
        </div>
      </div>
    );
  }
  function Filters() {
    return (
      <div className={styles.filters}>
        <label>
          {t("시즌", "Season")}
          <select
            value={season}
            onChange={(event) => setSeason(event.target.value)}
          >
            {section !== "seasons" ? (
              <option value="all">{t("전체 시즌", "All seasons")}</option>
            ) : null}
            {season !== "all" && !seasons.includes(Number(season)) ? (
              <option value={season}>
                {Number.isInteger(Number(season))
                  ? seasonLabel(Number(season))
                  : season}{" "}
                · {t("미확보", "Unavailable")}
              </option>
            ) : null}
            {seasons.map((year) => (
              <option key={year} value={year}>
                {seasonLabel(year)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("경기 유형", "Competition")}
          <select
            value={competition}
            onChange={(event) => setCompetition(event.target.value)}
          >
            {competitions.map((type) => (
              <option key={type} value={type}>
                {competitionNames[type][ko ? 0 : 1]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("장소", "Venue")}
          <select
            value={venue}
            disabled={!venueAvailable}
            aria-describedby={!venueAvailable ? "venue-unavailable" : undefined}
            onChange={(event) => setVenue(event.target.value)}
          >
            {[
              ["all", "전체", "All"],
              ["home", "홈", "Home"],
              ["away", "원정", "Away"],
              ["neutral", "중립", "Neutral"],
            ].map(([value, kr, en]) => (
              <option key={value} value={value}>
                {t(kr, en)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("상대", "Opponent")}
          <select
            value={opponent}
            onChange={(event) => setOpponent(event.target.value)}
          >
            <option value="all">{t("전체 상대", "All opponents")}</option>
            {dataset.teams
              .filter((team) => team.id !== dal?.id)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {ko ? team.nameKo || team.name : team.name}
                </option>
              ))}
          </select>
        </label>
        {!venueAvailable ? (
          <div className={styles.note} id="venue-unavailable">
            {t(
              "구장 분류 미확인 · 현재 자료의 홈·원정·중립 조건은 사용할 수 없습니다.",
              "Venue classification is unverified. Home, away, and neutral filters are unavailable for this data.",
            )}
            {venue !== "all" ? (
              <>
                {" "}
                {t(
                  "이전 장소 조건이 남아 있습니다.",
                  "A previous venue condition is still selected.",
                )}{" "}
                <button type="button" onClick={() => setVenue("all")}>
                  {t("장소 조건 해제", "Clear venue condition")}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  function Values({ values }: { values: StatValues }) {
    return (
      <>
        {columns.map((key) => (
          <td key={key} className={styles.number}>
            {number(values[key])}
          </td>
        ))}
      </>
    );
  }
  function GameList({ games }: { games: RecordGame[] }) {
    return games.length ? (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>
            {t(
              "표시 가능한 경기만 나열합니다. 경기 목록은 전 시즌 완전성을 보장하지 않습니다.",
              "Only available games are listed. This list does not establish complete historical coverage.",
            )}
          </caption>
          <thead>
            <tr>
              <th>{t("날짜", "Date")}</th>
              <th>{t("시즌", "Season")}</th>
              <th>{t("원정", "Away")}</th>
              <th className={styles.number}>{t("점수", "Score")}</th>
              <th>{t("홈", "Home")}</th>
              <th>{t("상태", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>
                  <a href={href(`/games/${encodeURIComponent(game.id)}`)}>
                    {game.date}
                  </a>
                </td>
                <td>{seasonLabel(game.season)}</td>
                <td>{historicalTeamName(game, game.awayTeamId)}</td>
                <td className={styles.number}>
                  {number(game.awayScore)} : {number(game.homeScore)}
                </td>
                <td>{historicalTeamName(game, game.homeTeamId)}</td>
                <td>
                  {game.status === "final"
                    ? t("종료", "Final")
                    : game.status === "scheduled"
                      ? t("예정", "Scheduled")
                      : game.status === "postponed"
                        ? t("연기", "Postponed")
                        : t("취소", "Cancelled")}
                  {game.neutral === null
                    ? ` · ${t("장소 미확인", "Venue unknown")}`
                    : game.neutral
                      ? ` · ${t("중립", "Neutral")}`
                      : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty filtered={dataset.games.length > 0} />
    );
  }
  const totals = leaderboard
    .map((item) => ({
      ...item,
      player: dataset.players.find((player) => player.id === item.playerId),
    }))
    .filter((item) => item.player);
  function Leaderboard() {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>{t("DAL 재적 경기 기록", "DAL game records")}</h2>
          <span className={styles.small}>
            {t("출전 경기 합계", "Played game totals")}
          </span>
        </div>
        {Filters()}
        <div className={styles.filters}>
          <label>
            {t("정렬 지표", "Sort statistic")}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as StatKey)}
            >
              {columns.map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </label>
        </div>
        {totals.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("선수", "Player")}</th>
                  <th className={styles.number}>
                    {t("출전 경기", "Played games")}
                  </th>
                  <th className={styles.number}>{sort}</th>
                  <th className={styles.number}>
                    {t("미기록 경기", "Missing games")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {totals.map((item, index) => (
                  <tr key={item.player.id}>
                    <td>
                      {index > 0 && totals[index - 1].value === item.value
                        ? totals.findIndex(
                            (other) => other.value === item.value,
                          ) + 1
                        : index + 1}
                    </td>
                    <td>
                      <a
                        href={href(
                          `/players/${encodeURIComponent(item.player.id)}`,
                        )}
                      >
                        {ko
                          ? item.player.nameKo || item.player.name
                          : item.player.name}
                      </a>
                    </td>
                    <td className={styles.number}>{item.games}</td>
                    <td className={styles.number}>{number(item.value)}</td>
                    <td className={styles.number}>{item.games - item.known}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty filtered={dataset.playerStats.length > 0} />
        )}
        <div className={styles.note}>
          {t(
            "확보된 기록 기준이며 미검증·미확보 범위가 있습니다. 미기록 값이 포함된 합계는 —로 표시하고, 미확보 경기·선수 행은 집계에서 제외합니다. 공식 통산 기록과 다를 수 있습니다.",
            "Based on available records, with unverified coverage and gaps. Totals with missing values are shown as —; unavailable games and player rows are excluded. These may differ from official career totals.",
          )}
        </div>
      </section>
    );
  }
  function DataPanel() {
    return (
      <>
        <div className={styles.grid}>
          {[
            [t("경기 목록", "Games"), snapshot.totalGames],
            [
              t("선수 기록 행", "Player stat rows"),
              snapshot.totalPlayerStatRows,
            ],
            [t("출처", "Sources"), dataset.sources.length],
          ].map(([label, count]) => (
            <div className={styles.card} key={label}>
              <p>{label}</p>
              <h2>{number(count as number)}</h2>
              <p>
                {t(
                  "현재 공개 가능한 데이터 기준",
                  "Currently available display data",
                )}
              </p>
            </div>
          ))}
        </div>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>{t("시즌별 커버리지", "Coverage by season")}</h2>
          </div>
          {dataset.coverage.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("시즌", "Season")}</th>
                    <th>{t("유형", "Competition")}</th>
                    <th>{t("데이터셋 · 필드", "Dataset · field")}</th>
                    <th className={styles.number}>
                      {t("관측 / 기대", "Observed / expected")}
                    </th>
                    <th>{t("검증", "Validation")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.coverage.map((row, index) => (
                    <tr key={index}>
                      <td>{seasonLabel(row.season)}</td>
                      <td>{competitionNames[row.competition][ko ? 0 : 1]}</td>
                      <td>
                        {row.dataset} · {row.field}
                      </td>
                      <td className={styles.number}>
                        {row.observed} / {number(row.expected)}
                      </td>
                      <td>
                        {row.status === "complete"
                          ? t("완료", "Complete")
                          : row.status === "partial"
                            ? t("일부", "Partial")
                            : t("미검증", "Unverified")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
          <div className={styles.note}>
            {t(
              "기대 경기 수가 확인되지 않으면 커버리지 백분율을 표시하지 않습니다. 확보 범위와 필드별 누락은 위 표에서 확인하세요.",
              "Coverage percentages are not shown without a verified denominator. See the table for available seasons and field-level gaps.",
            )}
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>{t("출처와 이용 범위", "Sources and usage")}</h2>
          </div>
          {dataset.sources.length ? (
            <div className={styles.sourceList}>
              {dataset.sources.map((source) => (
                <div key={source.id} className={styles.source}>
                  <div>
                    <h3>{source.name}</h3>
                    <p>
                      {t("수집일", "Retrieved")}: {source.retrievedAt} ·{" "}
                      {t("변환 버전", "Transform")}: {source.transformVersion}
                    </p>
                    <p>
                      {t("공개 표시", "Display")}:{" "}
                      {source.rights.display
                        ? t("허용", "Allowed")
                        : t("미확인", "Unverified")}{" "}
                      · {t("상업 이용", "Commercial")}:{" "}
                      {source.rights.commercial
                        ? t("허용", "Allowed")
                        : t("미확인", "Unverified")}
                    </p>
                    <p>{source.rights.evidence}</p>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("출처 보기 ↗", "View source ↗")}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <h3>
                {t(
                  "공개용 공급원이 아직 연결되지 않았습니다",
                  "No display data source is connected yet",
                )}
              </h3>
              <p>
                {t(
                  "전체 시즌 수집이나 유료 공급원 연결 없이 저장·공개 권리가 확인된 기록만 표시하도록 준비했습니다.",
                  "Only records with verified storage and display rights will be shown. No full-season collection or paid data service is connected.",
                )}
              </p>
            </div>
          )}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>{t("기록을 읽는 방법", "Reading the records")}</h2>
          </div>
          <div className={styles.meaning}>
            <span>
              <strong>0</strong> · {t("실제 기록된 0", "Recorded zero")}
            </span>
            <span>
              <strong>—</strong> ·{" "}
              {t("값 미제공 / 미기록", "Unavailable / unrecorded")}
            </span>
            <span>
              <strong>DNP</strong> ·{" "}
              {t("명단 포함 · 미출전", "Listed, did not play")}
            </span>
            <span>
              <strong>Inactive</strong> · {t("비활성 선수", "Inactive player")}
            </span>
          </div>
          <div className={styles.note}>
            {t(
              "출전 기록이 없는 선수와 누락 선수 행은 서로 다른 상태입니다. 정규시즌과 컵 결승은 별도 집계하며 컵 표시가 있는 정규시즌 경기를 중복 합산하지 않습니다.",
              "Non-participation and a missing player row are different states. Cup finals are separate; regular-season Cup games are counted once.",
            )}
          </div>
        </section>
      </>
    );
  }
  function SeasonSummary() {
    const games = filteredGames.filter(
      (game) =>
        game.status === "final" &&
        game.homeScore !== null &&
        game.awayScore !== null &&
        [game.homeTeamId, game.awayTeamId].includes(dal?.id || ""),
    );
    const wins = games.filter((game) =>
      game.homeTeamId === dal?.id
        ? game.homeScore! > game.awayScore!
        : game.awayScore! > game.homeScore!,
    ).length;
    const points = games.reduce(
      (sum, game) =>
        sum + (game.homeTeamId === dal?.id ? game.homeScore! : game.awayScore!),
      0,
    );
    const against = games.reduce(
      (sum, game) =>
        sum + (game.homeTeamId === dal?.id ? game.awayScore! : game.homeScore!),
      0,
    );
    return (
      <>
        <div className={styles.meaning}>
          <span>{t("확보 경기 기준", "Available games only")}</span>
          <span>
            {t("경기", "Games")}: <strong>{games.length || "—"}</strong>
          </span>
          <span>
            {t("승 / 패", "W / L")}:{" "}
            <strong>
              {games.length ? `${wins} / ${games.length - wins}` : "—"}
            </strong>
          </span>
          <span>
            {t("승률", "Win percentage")}:{" "}
            <strong>
              {games.length
                ? `${((wins / games.length) * 100).toFixed(1)}%`
                : "—"}
            </strong>
          </span>
          <span>
            {t("득점 / 실점", "Points for / against")}:{" "}
            <strong>{games.length ? `${points} / ${against}` : "—"}</strong>
          </span>
        </div>
        <div className={styles.note}>
          {t(
            "최종 점수가 있는 확보 경기만 계산합니다. 전체 시즌 성적을 뜻하지 않으며 점수가 미기록인 경기는 제외합니다.",
            "Only available final games with both scores are included. This is not a complete season record; games with missing scores are excluded.",
          )}
        </div>
      </>
    );
  }
  function SourceNote({ sourceIds }: { sourceIds: string[] }) {
    return (
      <div className={styles.note}>
        {[...new Set(sourceIds)].map((id) => {
          const source = dataset.sources.find((item) => item.id === id);
          return source ? (
            <span key={id}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.name} ↗
              </a>{" "}
              · {t("수집", "Retrieved")}: {source.retrievedAt} {" / "}
            </span>
          ) : null;
        })}
      </div>
    );
  }
  function GameDetail() {
    const game = dataset.games.find((item) => item.id === recordId);
    if (!game)
      return (
        <section className={styles.panel}>
          <Empty />
        </section>
      );
    return (
      <>
        <p className={styles.intro}>
          {game.date} · {seasonLabel(game.season)} ·{" "}
          {competitionNames[game.competition][ko ? 0 : 1]} ·{" "}
          {game.arenaName || t("경기장 미확인", "Arena unknown")}
          {game.neutral === true ? ` · ${t("중립 경기", "Neutral venue")}` : null}
        </p>
        <section className={styles.scoreboard} aria-label={t("경기 점수 · 원정 대 홈", "Game score · away versus home")}>
          <div className={styles.scoreTeam}>
            <span className={styles.venueBadge}>{t("AWAY · 원정", "AWAY")}</span>
            <h2>{historicalTeamName(game, game.awayTeamId)}</h2>
          </div>
          <div className={styles.scoreNumbers}>
            <strong>{number(game.awayScore)}</strong><span>:</span><strong>{number(game.homeScore)}</strong>
          </div>
          <div className={styles.scoreTeam}>
            <span className={styles.venueBadge}>{t("HOME · 홈", "HOME")}</span>
            <h2>{historicalTeamName(game, game.homeTeamId)}</h2>
          </div>
        </section>
        <p className={styles.gameContext}>
          {t("홈·원정은 원본 경기 기록의 팀 지정을 따릅니다.", "Home and away follow the source's game designations.")}
          {game.neutral === null ? ` ${t("중립구장 여부는 미확인입니다.", "Neutral-site status is unverified.")}` : null}
        </p>
        {[game.awayTeamId, game.homeTeamId].map((teamId) => {
          const rows = dataset.playerStats.filter(
            (row) => row.gameId === game.id && row.teamId === teamId,
          );
          const total = dataset.teamStats.find(
            (row) => row.gameId === game.id && row.teamId === teamId,
          );
          const pointsAudit = auditPlayerPoints(rows, total?.values.PTS);
          const lineup = organizeBoxScore(rows);
          const pointsWarning =
            pointsAudit.difference !== null && pointsAudit.difference !== 0;
          return (
            <section className={styles.panel} key={teamId}>
              <div className={styles.panelHead}>
                <h2><span className={styles.venueBadge}>{teamId === game.homeTeamId ? t("HOME · 홈", "HOME") : t("AWAY · 원정", "AWAY")}</span> {historicalTeamName(game, teamId)}</h2>
                <span className={styles.small}>{lineup.lineupKnown ? t("Starter 5명 · G / F / C", "5 starters · G / F / C") : t("선발 구분 미확인", "Starting lineup unverified")}</span>
              </div>
              <SourceNote
                sourceIds={[
                  game.sourceId,
                  ...rows.map((row) => row.sourceId),
                  ...(total ? [total.sourceId] : []),
                ]}
              />
              {rows.length || total ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption>{t("Starter는 G → F → C 순서, Bench는 출전시간 순서입니다. 미출전 선수는 아래에 표시합니다.", "Starters: G → F → C. Bench: minutes played, descending. Non-participants appear last.")}</caption>
                    <thead>
                      <tr>
                        <th>{t("선수", "Player")}</th>
                        <th>{t("구분", "Role")}</th>
                        <th scope="col" title={t("원본 경기 포지션 · G 가드 / F 포워드 / C 센터", "Source game position · G Guard / F Forward / C Center")}>POS</th>
                        <th className={styles.number}>MIN</th>
                        {columns.map((key) => (
                          <th className={styles.number} key={key}>
                            {key === "PLUS_MINUS" ? "+/−" : key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineup.rows.map(({row, role}, index) => (
                        <tr key={row.playerId} data-lineup-role={role} data-position={row.starterPosition ?? ''} className={index > 0 && role !== lineup.rows[index - 1].role ? styles.lineupDivider : undefined}>
                          <td>
                            {snapshot.dalPlayerIds.includes(row.playerId) ? (
                              <a
                                href={href(
                                  `/players/${encodeURIComponent(row.playerId)}`,
                                )}
                              >
                                {playerName(row.playerId)}
                              </a>
                            ) : (
                              playerName(row.playerId)
                            )}
                          </td>
                          <td>
                            <span className={role === 'Starter' ? styles.starterBadge : styles.roleBadge}>{role === 'Unknown' ? t("미확인", "Unknown") : role}</span>
                            {row.reason ? <span className={styles.absenceReason}>{row.reason}</span> : null}
                          </td>
                          <td>{row.starterPosition ?? '—'}</td>
                          <td className={styles.number}>
                            {row.values.MIN_SECONDS === null
                              ? "—"
                              : `${Math.floor(row.values.MIN_SECONDS / 60)}:${String(row.values.MIN_SECONDS % 60).padStart(2, "0")}`}
                          </td>
                          <Values values={row.values} />
                        </tr>
                      ))}
                      {total ? (
                        <tr>
                          <td>{t("팀 합계", "Team total")}</td>
                          <td />
                          <td />
                          <td />
                          <Values values={total.values} />
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty />
              )}
              {pointsWarning ||
              pointsAudit.missingPoints > 0 ||
              pointsAudit.unknownParticipation > 0 ||
              (rows.length > 0 &&
                (pointsAudit.playerPoints === null ||
                  pointsAudit.teamPoints === null)) ? (
                <div className={styles.note} role="note">
                  {pointsWarning ? (
                    <strong>
                      {t(
                        "제공된 선수 득점과 팀 합계가 일치하지 않습니다.",
                        "Provided player points do not match the team total.",
                      )}{" "}
                    </strong>
                  ) : null}
                  {t(
                    `제공 선수 득점 합계 ${number(pointsAudit.playerPoints)} · 팀 기록 득점 ${number(pointsAudit.teamPoints)} · 차이(선수−팀) ${number(pointsAudit.difference)}.`,
                    `Provided player points ${number(pointsAudit.playerPoints)} · reported team points ${number(pointsAudit.teamPoints)} · difference (players−team) ${number(pointsAudit.difference)}.`,
                  )}{" "}
                  {t(
                    `득점 미제공 ${pointsAudit.missingPoints}명 · 출전 상태 미확인 ${pointsAudit.unknownParticipation}명. 출전·미확인 행의 제공값으로 계산하며 팀 합계는 원본 그대로 표시합니다.`,
                    `Points unavailable for ${pointsAudit.missingPoints} players · participation unknown for ${pointsAudit.unknownParticipation}. The sum uses available values in played/unknown rows; the reported team total is preserved.`,
                  )}
                </div>
              ) : null}
              {rows.length > 0 && !lineup.lineupKnown ? <div className={styles.note}>{t("원본에서 선발 5명을 확정할 수 없어 Starter / Bench를 추정하지 않았습니다. 출전 선수는 출전시간 순으로 표시합니다.", "The source does not establish a starting five. Starter/bench roles are not inferred; participants are ordered by minutes.")}</div> : null}
              <div className={styles.note}>{t("POS: G 가드 · F 포워드 · C 센터 · — 미제공. 원본의 경기별 포지션이며, 포지션 값만으로 선발 여부를 판단하지 않습니다.", "POS: G Guard · F Forward · C Center · — unavailable. These are source game positions; a position alone does not establish starter status.")}</div>
              {!rows.length ? (
                <div className={styles.note}>
                  {t(
                    "선수별 기록은 미확보입니다.",
                    "Player-level records are unavailable.",
                  )}
                </div>
              ) : null}
              <div className={styles.note}>
                {total
                  ? t(
                      `팀 전용 리바운드 ${number(total.teamRebounds)} · 턴오버 ${number(total.teamTurnovers)}`,
                      `Team-only rebounds ${number(total.teamRebounds)} · turnovers ${number(total.teamTurnovers)}`,
                    )
                  : t(
                      "팀 합계 미확보 — 선수 기록의 합계를 공식 팀 합계로 대체하지 않습니다.",
                      "Team totals unavailable — player sums do not replace official team totals.",
                    )}
              </div>
            </section>
          );
        })}
      </>
    );
  }
  function Comparison() {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>{t("같은 조건에서 비교", "Compare with the same filters")}</h2>
        </div>
        {Filters()}
        <div className={styles.comparison}>
          {[
            [firstPlayer, setFirstPlayer, t("선수 A", "Player A")],
            [secondPlayer, setSecondPlayer, t("선수 B", "Player B")],
          ].map(([value, setter, label]) => (
            <label key={label as string}>
              {label as string}
              <select
                value={value as string}
                onChange={(event) =>
                  (setter as (value: string) => void)(event.target.value)
                }
              >
                <option value="">{t("선수 선택", "Choose a player")}</option>
                {dataset.players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {ko ? player.nameKo || player.name : player.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {firstPlayer && secondPlayer ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {t(
                  "동일한 시즌·유형·장소·상대 조건의 DAL 출전 경기 평균. 미기록 값이 포함된 평균은 —로 표시합니다.",
                  "Per-game averages in DAL games under identical filters. An average with missing values is shown as —.",
                )}
              </caption>
              <thead>
                <tr>
                  <th>{t("지표", "Statistic")}</th>
                  <th className={styles.number}>{playerName(firstPlayer)}</th>
                  <th className={styles.number}>{playerName(secondPlayer)}</th>
                </tr>
              </thead>
              <tbody>
                {(["GP", ...columns] as string[]).map((key) => (
                  <tr key={key}>
                    <td>{key}</td>
                    {[firstPlayer, secondPlayer].map((id, playerIndex) => {
                      const summary = comparison.find(
                        (item) => item.playerId === id,
                      );
                      const known = summary?.known[key as StatKey] ?? 0;
                      const value =
                        key === "GP"
                          ? summary?.games || null
                          : (summary?.values[key as StatKey] ?? null);
                      return (
                        <td className={styles.number} key={playerIndex}>
                          {number(value)}
                          {key !== "GP" ? <small> ({known})</small> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        <div className={styles.note}>
          {t(
            "확보된 기록 기준이며 미검증·미확보 범위가 있습니다. 괄호는 해당 지표가 기록된 경기 수입니다. 미확보 경기·선수 행은 제외하고 미기록 값이 포함된 평균은 —로 표시합니다.",
            "Based on available records, with unverified coverage and gaps. Parentheses show games with a recorded value. Unavailable games and player rows are excluded; averages containing missing values are shown as —.",
          )}
        </div>
      </section>
    );
  }
  return (
    <div className={styles.portal} lang={locale}>
      <a href="#records-main" className={styles.skip}>
        {t("본문으로 이동", "Skip to content")}
      </a>
      <header className={styles.header}>
        <div className={styles.topline}>
          <a href={href()} className={styles.brand}>
            MAVS.KR <span>RECORDS</span>
          </a>
          <div className={styles.utilities}>
            <a href="/">{t("홈페이지 ↗", "Homepage ↗")}</a>
            <a
              href={languagePath}
              hrefLang={ko ? "en" : "ko"}
              className={styles.language}
            >
              {ko ? "English" : "한국어"}
            </a>
          </div>
        </div>
        <nav
          className={styles.nav}
          aria-label={t("기록 메뉴", "Record navigation")}
        >
          {(
            [
              "search",
              "seasons",
              "players",
              "records",
              "compare",
              "history",
              "data",
            ] as PortalSection[]
          ).map((item) => (
            <a
              key={item}
              href={href(`/${item}`)}
              aria-current={section === item ? "page" : undefined}
            >
              {sectionNames[item][ko ? 0 : 1]}
            </a>
          ))}
        </nav>
      </header>
      <main id="records-main" className={styles.main} aria-busy={pending}>
        {pending ? (
          <p role="status">
            {t("기록을 불러오고 있습니다…", "Loading records…")}
          </p>
        ) : null}
        {section === "home" ? (
          <>
            <section className={styles.archiveHero} aria-labelledby="archive-title">
              <p className={styles.kicker}>DALLAS MAVERICKS / RECORD BOOK</p>
              <h1 id="archive-title">{t("매버릭스에 대해 무엇이 궁금한가요?", "What would you like to know about the Mavericks?")}</h1>
              <p className={styles.archiveIntro}>{t("선수, 시즌, 한 경기의 기록까지. 질문으로 시작하고 숫자의 근거를 확인하세요.", "Start with a question. Explore players, seasons and games, then see the records behind the answer.")}</p>
              {SearchForm()}
              <div className={styles.coverageLine}>
                <span>{t("확보 경기", "Available games")} <strong>{snapshot.status === "invalid" ? t("확인 불가", "Unavailable") : number(snapshot.totalGames)}</strong></span>
                <span>{t("전체 역사의 완전성을 뜻하지 않습니다", "Coverage is not a claim of complete history")}</span>
                <a href={href("/data")}>{t("범위와 출처 →", "Coverage & sources →")}</a>
              </div>
              <nav className={styles.browseLinks} aria-label={t("기록 둘러보기", "Browse the archive")}>
                <a href={href("/seasons")}>{t("시즌으로 찾기", "By season")} ↗</a>
                <a href={href("/players")}>{t("선수로 찾기", "By player")} ↗</a>
                <a href={href("/compare")}>{t("선수 비교", "Compare players")} ↗</a>
              </nav>
            </section>
            <div className={styles.grid}>
              {[
                [
                  "seasons",
                  t("시즌을 따라 읽기", "Explore by season"),
                  t(
                    "정규시즌과 플레이오프를 구분하고 한 경기의 양 팀 기록까지 확인합니다.",
                    "Browse separate competitions and see both teams in each game.",
                  ),
                ],
                [
                  "players",
                  t("선수의 DAL 기록", "A player’s DAL years"),
                  t(
                    "재적 기간의 경기 기록을 살펴보세요. 다른 팀 기록과 구분합니다.",
                    "Explore Mavericks appearances, separate from other teams.",
                  ),
                ],
                [
                  "compare",
                  t("같은 기준으로 비교", "Compare on equal terms"),
                  t(
                    "시즌과 상대, 홈·원정 조건을 맞춰 비교합니다.",
                    "Use matching season, opponent, and venue filters.",
                  ),
                ],
              ].map(([key, label, description]) => (
                <article key={key} className={styles.card}>
                  <p className={styles.kicker}>{key.toUpperCase()}</p>
                  <h2>{label}</h2>
                  <p>{description}</p>
                  <a href={href(`/${key}`)}>{t("살펴보기 →", "Explore →")}</a>
                </article>
              ))}
            </div>
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>{t("경기 기록", "Game archive")}</h2>
                <a href={href("/seasons")}>
                  {t("시즌별 보기 →", "Browse seasons →")}
                </a>
              </div>
              <GameList
                games={dataset.games
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 8)}
              />
            </section>
          </>
        ) : (
          <>
            <p className={styles.kicker}>
              DALLAS MAVERICKS / {section.toUpperCase()}
            </p>
            <h1 className={styles.pageTitle}>{title}</h1>
          </>
        )}
        {snapshot.status === "invalid" ? (
          <section className={styles.panel} role="alert">
            <div className={styles.empty}>
              <h3>
                {t(
                  "기록 데이터를 표시할 수 없습니다",
                  "Record data cannot be displayed",
                )}
              </h3>
              <p>
                {t(
                  "기록을 불러오지 못했거나 검증을 완료하지 못했습니다. 잠시 후 다시 불러오세요.",
                  "Records could not be loaded or verified. Please try again shortly.",
                )}
              </p>
              <div className={styles.recoveryActions}>
                <button type="button" className={styles.resultViewButton} onClick={() => router.refresh()}>{t("다시 불러오기", "Try again")}</button>
                <a href={href("/data")}>{t("데이터 안내", "Data & sources")}</a>
              </div>
            </div>
          </section>
        ) : null}
        {section === "search" ? (
          <>
            <p className={styles.intro}>{t("선수·시즌·경기 유형·지표를 질문하세요. 해석된 조건과 확보 범위를 답변에서 확인할 수 있습니다.", "Ask about a player, season, competition or statistic. Check the interpreted conditions and available scope in the answer.")}</p>
            {SearchForm()}
            {snapshot.status !== "invalid" && queryResult && presentation ? (
              <>
                {queryResult.status === "unsupported" || queryResult.status === "ambiguous" ? (
                  <section className={`${styles.panel} ${styles.queryState}`} aria-labelledby="query-state-title">
                    <div className={styles.empty}>
                      <p className={styles.kicker}>{queryResult.status === "ambiguous" ? t("조건 확인 필요", "CLARIFICATION NEEDED") : t("지원하지 않는 질문", "UNSUPPORTED QUESTION")}</p>
                      <h2 id="query-state-title">{queryResult.status === "ambiguous" ? t("어떤 기록을 뜻하는지 알려주세요", "Please clarify the records you mean") : t("이 질문은 아직 해석할 수 없습니다", "This question is not supported yet")}</h2>
                      <p>{ko ? queryResult.messageKo || queryResult.message : queryResult.message || queryResult.messageKo}</p>
                      <div className={styles.recoveryActions}>
                        <button type="button" className={styles.resultViewButton} onClick={() => document.getElementById("records-query")?.focus()}>{t("질문 수정", "Edit question")}</button>
                        <a href={href("/search")}>{t("지원 질문 예시 보기", "See supported examples")}</a>
                      </div>
                    </div>
                  </section>
                ) : (
                  <>
                    <section className={styles.answerCard} aria-labelledby="answer-question">
                      <p className={styles.answerEyebrow}>{t("질문에 대한 답", "YOUR ANSWER")}</p>
                      <h2 id="answer-question">{query}</h2>
                      <p className={styles.answerContext}>{presentation.scope}</p>
                      <div className={styles.answerStats}>
                        {presentation.answers.map((answer, index) => (
                          <div key={index}>
                            <p>{answer.label}</p>
                            <div><strong className={styles.answerValue}>{answer.value}</strong> <span className={styles.answerUnit}>{answer.unit}</span></div>
                            <p>{answer.detail}</p>
                          </div>
                        ))}
                      </div>
                      <p className={styles.answerWarning}>{presentation.coverage}</p>
                      <p className={styles.answerContext}>{presentation.context}</p>
                      <p className={styles.answerContext}>{t("집계는 표시 행 수 제한 전의 전체 일치 기록을 사용합니다.", "Aggregates use all matching records before the display-row limit.")}</p>
                      <a href={href("/data")}>{t("데이터 범위와 출처 확인 →", "View data coverage & sources →")}</a>
                    </section>
                    <div className={styles.queryChips} aria-label={t("해석한 검색 조건", "Interpreted search conditions")}>
                      {presentation.chips.map((chip, index) => <span key={index} className={styles.queryChip}>{chip}</span>)}
                    </div>
                    {queryResult.message || queryResult.messageKo ? <p className={styles.note} role="note">{ko ? queryResult.messageKo || queryResult.message : queryResult.message || queryResult.messageKo}</p> : null}
                    <section className={styles.panel} aria-labelledby="evidence-title">
                      <div className={styles.resultToolbar}>
                        <div><h2 className={styles.evidenceTitle} id="evidence-title">{t("답변의 근거 기록", "Records behind the answer")}</h2><p className={styles.small}>{presentation.rowsLabel}</p></div>
                        {queryResult.rows.length ? <button type="button" className={styles.resultViewButton} aria-expanded={fullRecords} aria-controls="query-evidence-table" onClick={() => setFullRecords(value => !value)}>{fullRecords ? t("주 지표만 보기", "Show key statistic") : t("전체 기록 보기", "Show all statistics")}</button> : null}
                      </div>
                      {queryResult.rows.length ? (
                        <div className={styles.tableWrap} id="query-evidence-table" tabIndex={0} role="region" aria-label={t("검색 근거 표 · 가로로 스크롤할 수 있습니다", "Search evidence table · scroll horizontally")}>
                          <table className={`${styles.table} ${fullRecords ? "" : styles.queryEvidenceTable}`}>
                            <caption>{t("같은 경기의 선수별 출전은 서로 다른 행입니다. 선수·날짜를 눌러 상세 기록을 확인하세요.", "Each player appearance is a separate row. Open a player or date for detailed records.")}</caption>
                            <thead><tr><th>{t("선수", "Player")}</th>{queryColumns.map(key => <th className={styles.number} key={key}>{key === "MIN_SECONDS" ? t("출전시간", "MIN") : key}</th>)}<th>{t("경기", "Game")}</th></tr></thead>
                            <tbody>{queryResult.rows.map(row => (
                              <tr key={`${row.gameId}-${row.playerId}`}>
                                <td><a href={href(`/players/${encodeURIComponent(row.playerId)}`)}>{ko ? row.playerNameKo || row.playerName : row.playerName}</a></td>
                                {queryColumns.map(key => <td className={styles.number} key={key}>{row.values[key] === null ? "—" : formatQueryValue(row.values[key], key, locale)}</td>)}
                                <td><a href={href(`/games/${encodeURIComponent(row.gameId)}`)}>{row.date}</a><span className={styles.queryGameContext}>{teamName(row.opponentId)}</span></td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      ) : (
                        <div className={`${styles.empty} ${styles.queryState}`}>
                          <h3>{t("확보된 기록에서 일치하는 결과가 없습니다", "No available records match these conditions")}</h3>
                          <p>{queryResult.plan?.aggregation === "count" && queryResult.summaries[0]?.value === 0
                            ? t("현재 검증 범위에서 조건에 맞는 고유 경기는 0경기입니다. 적용된 시즌과 확보 범위를 함께 확인하세요.", "There are zero matching distinct games within this verified scope. Check the applied season and coverage.")
                            : t("검색 결과가 없다는 것이 역사 전체에서 0건이라는 뜻은 아닙니다. 조건을 바꾸거나 확보 범위를 확인하세요.", "No matching rows does not mean a historical count of zero. Adjust the question or check coverage.")}</p>
                          <div className={styles.recoveryActions}><button type="button" className={styles.resultViewButton} onClick={() => document.getElementById("records-query")?.focus()}>{t("질문 수정", "Edit question")}</button><a href={href("/data")}>{t("확보 범위 확인", "Check coverage")}</a></div>
                        </div>
                      )}
                      <details className={styles.note}>
                        <summary>{t("아카이브 출처와 기록 범위", "Archive sources and scope")}</summary>
                        <p>{t("아래는 아카이브의 출처 목록입니다. 각 답변 행별 출처를 개별 매핑한 목록은 아닙니다.", "These sources describe the archive; they are not an individual source mapping for every answer row.")}</p>
                        <SourceNote sourceIds={dataset.sources.map(source => source.id)} />
                      </details>
                    </section>
                    <nav className={styles.relatedQuestions} aria-labelledby="related-title">
                      <h2 id="related-title" className={styles.relatedHeading}>{t("이 기록에서 이어 보기", "Keep exploring these records")}</h2>
                      <div className={styles.browseLinks}>
                        {related.map(question => <a key={question} href={`${href("/search")}?q=${encodeURIComponent(question)}`}>{question} ↗</a>)}
                        {queryResult.plan?.playerIds.map(id => <a key={id} href={href(`/players/${encodeURIComponent(id)}`)}>{playerName(id)} ↗</a>)}
                        {queryResult.plan?.season !== undefined ? <a href={`${href("/seasons")}?season=${queryResult.plan.season}&competition=${queryResult.plan.competition ?? "regular"}`}>{seasonLabel(queryResult.plan.season)} {t("시즌 기록", "season records")} ↗</a> : null}
                      </div>
                    </nav>
                  </>
                )}
              </>
            ) : null}
          </>
        ) : null}
        {section === "seasons" ? (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>{t("경기 찾아보기", "Browse games")}</h2>
            </div>
            {Filters()}
            {SeasonSummary()}
            <GameList games={filteredGames} />
          </section>
        ) : null}
        {section === "players" ? (
          <>
            <p className={styles.intro}>
              {t(
                "기록 데이터에 포함된 선수만 표시합니다. DAL 재적 기간의 기록을 탐색하세요.",
                "Only players present in the record dataset are listed. Explore their DAL appearances.",
              )}
            </p>
            <section className={styles.panel}>
              <div className={styles.filters}>
                <label>
                  {t("선수 이름 검색", "Find a player")}
                  <input
                    value={playerSearch}
                    onChange={(event) => setPlayerSearch(event.target.value)}
                    placeholder={t("한글 · 영문 · 별칭", "Name or alias")}
                  />
                </label>
              </div>
              {dataset.players.filter((player) =>
                [player.name, player.nameKo, ...player.aliases].some((name) =>
                  name.toLowerCase().includes(playerSearch.toLowerCase()),
                ),
              ).length ? (
                <div className={styles.sourceList}>
                  {dataset.players
                    .filter((player) =>
                      [player.name, player.nameKo, ...player.aliases].some(
                        (name) =>
                          name
                            .toLowerCase()
                            .includes(playerSearch.toLowerCase()),
                      ),
                    )
                    .map((player) => (
                      <div className={styles.source} key={player.id}>
                        <h3>
                          <a
                            href={href(
                              `/players/${encodeURIComponent(player.id)}`,
                            )}
                          >
                            {ko ? player.nameKo || player.name : player.name}
                          </a>
                        </h3>
                        <p>{ko ? player.name : player.nameKo || player.name}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <Empty filtered={dataset.players.length > 0} />
              )}
            </section>
          </>
        ) : null}
        {section === "player" ? (
          <>
            {dataset.players.some((player) => player.id === recordId) ? (
              <>
                <h2>{playerName(recordId!)}</h2>
                <section className={styles.panel}>
                  {Filters()}
                  <div className={styles.note}>
                    {t(
                      "확보된 DAL 경기 기록이며 미검증·미확보 범위가 있습니다. 이 페이지의 행 수는 선수의 공식 통산 경기 수가 아닙니다.",
                      "Available DAL game records, with unverified coverage and gaps. Rows on this page are not the player's official career game count.",
                    )}
                  </div>
                  {dataset.playerStats.filter(
                    (row) =>
                      row.playerId === recordId &&
                      row.teamId === dal?.id &&
                      selectedGameIds.has(row.gameId),
                  ).length ? (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <caption>
                          {t(
                            "DAL 재적 경기 기록 · 출전 상태별 행을 보존합니다.",
                            "DAL game log · Participation states are preserved.",
                          )}
                        </caption>
                        <thead>
                          <tr>
                            <th>{t("경기", "Game")}</th>
                            <th>{t("출전", "Participation")}</th>
                            <th className={styles.number}>MIN</th>
                            {columns.map((key) => (
                              <th className={styles.number} key={key}>
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataset.playerStats
                            .filter(
                              (row) =>
                                row.playerId === recordId &&
                                row.teamId === dal?.id &&
                                selectedGameIds.has(row.gameId),
                            )
                            .map((row) => (
                              <tr key={row.gameId}>
                                <td>
                                  <a
                                    href={href(
                                      `/games/${encodeURIComponent(row.gameId)}`,
                                    )}
                                  >
                                    {
                                      dataset.games.find(
                                        (game) => game.id === row.gameId,
                                      )?.date
                                    }
                                  </a>
                                </td>
                                <td>
                                  {row.participation === "played"
                                    ? t("출전", "Played")
                                    : row.participation === "dnp"
                                      ? "DNP"
                                      : row.participation === "inactive"
                                        ? t("비활성", "Inactive")
                                        : t("미확인", "Unknown")}
                                </td>
                                <td className={styles.number}>
                                  {row.values.MIN_SECONDS === null
                                    ? "—"
                                    : `${Math.floor(row.values.MIN_SECONDS / 60)}:${String(row.values.MIN_SECONDS % 60).padStart(2, "0")}`}
                                </td>
                                <Values values={row.values} />
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty filtered />
                  )}
                  <div
                    className={styles.filters}
                    aria-label={t("경기 기록 페이지", "Game log pages")}
                  >
                    <button
                      type="button"
                      disabled={page <= 1 || pending}
                      onClick={() => navigate("page", String(page - 1))}
                    >
                      {t("이전", "Previous")}
                    </button>
                    <span>
                      {page} ·{" "}
                      {t("페이지당 최대 200경기", "Up to 200 games per page")}
                    </span>
                    <button
                      type="button"
                      disabled={
                        pending ||
                        (snapshot.scopeTotal !== undefined
                          ? page * 200 >= snapshot.scopeTotal
                          : dataset.playerStats.length < 200)
                      }
                      onClick={() => navigate("page", String(page + 1))}
                    >
                      {t("다음", "Next")}
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <section className={styles.panel}>
                <Empty />
              </section>
            )}
          </>
        ) : null}
        {section === "records" ? Leaderboard() : null}
        {section === "compare" ? Comparison() : null}
        {section === "game" ? GameDetail() : null}
        {section === "data" ? DataPanel() : null}
        {section === "history" ? (
          <>
            <p className={styles.intro}>
              {t(
                "시즌별 경기 아카이브와 출처가 확인된 구단 역사 자료를 연결합니다. 검증하지 않은 연혁이나 기록은 표시하지 않습니다.",
                "Connect season archives with sourced franchise history. Unverified events and records are not displayed.",
              )}
            </p>
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>{t("시즌 아카이브", "Season archive")}</h2>
              </div>
              {seasons.length ? (
                <div className={styles.sourceList}>
                  {seasons.map((year) => (
                    <div className={styles.source} key={year}>
                      <h3>{seasonLabel(year)}</h3>
                      <p>
                        {dataset.coverage
                          .filter(
                            (row) =>
                              row.season === year &&
                              row.dataset === "games" &&
                              row.field === "all",
                          )
                          .reduce((sum, row) => sum + row.observed, 0)}{" "}
                        {t("확보 경기", "available games")}
                      </p>
                      <a href={`${href("/seasons")}?season=${year}`}>
                        {t("경기 탐색 →", "Explore games →")}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty />
              )}
            </section>
          </>
        ) : null}
      </main>
      <footer className={styles.footer}>
        <span>
          MAVS.KR RECORDS ·{" "}
          {t("독립 팬 기록 포털", "Independent fan record portal")}
        </span>
        <div>
          <a href={href("/data")}>
            {t("출처 · 기록 정의", "Sources & definitions")}
          </a>
          <a href="/">{t("홈페이지", "Homepage")}</a>
          <a href="/fan">{t("팬 포털", "Fan portal")}</a>
          <a href="/comm">{t("커뮤니티", "Community")}</a>
        </div>
      </footer>
    </div>
  );
}
