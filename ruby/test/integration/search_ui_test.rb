# frozen_string_literal: true

require_relative "../test_helper"
require "minitest/mock"

# UI fixtures only: no Jev client, database, credentials, or paid API is used.
class SearchUiTest < ActionDispatch::IntegrationTest
  RELEASE = "r_0123456789abcdef01234567"
  DIRK = "nba:player:1717"
  LUKA = "nba:player:1629029"
  GAME = "nba:game:0041000406"

  class FixtureRepository
    attr_accessor :result

    def catalog(release_id: nil)
      { "status" => "ready", "releaseId" => RELEASE, "totalGames" => 1, "totalPlayerStatRows" => 1,
        "availableSeasons" => [2010], "dalPlayerIds" => [DIRK, LUKA], "dataset" => {
          "version" => 1,
          "teams" => [
            { "id" => "dal", "abbreviation" => "DAL", "name" => "Dallas Mavericks", "nameKo" => "댈러스 매버릭스", "aliases" => [] },
            { "id" => "mia", "abbreviation" => "MIA", "name" => "Miami Heat", "nameKo" => "마이애미 히트", "aliases" => [] }
          ],
          "players" => [
            { "id" => DIRK, "name" => "Dirk Nowitzki", "nameKo" => "디르크 노비츠키", "aliases" => ["Dirk"] },
            { "id" => LUKA, "name" => "Luka Doncic", "nameKo" => "루카 돈치치", "aliases" => ["Luka"] }
          ],
          "games" => [], "playerStats" => [], "teamStats" => [], "coverage" => [],
          "sources" => [{ "id" => "fixture", "name" => "Synthetic source", "url" => "https://example.test/source", "retrievedAt" => "2026-01-01T00:00:00Z" }]
        } }
    end

    def scope(**) = catalog
    def query(_text, **) = @result.deep_dup
  end

  setup do
    @previous_repository = Rails.application.config.x.records_repository
    @repository = FixtureRepository.new
    Rails.application.config.x.records_repository = @repository
    @plan = { "playerIds" => [DIRK, LUKA], "season" => 2010, "competition" => "playoffs", "stat" => "PTS",
      "threshold" => { "operator" => "gt", "value" => 30 }, "aggregation" => "games", "direction" => "desc", "limit" => 50,
      "venue" => "away", "opponentId" => "mia", "position" => "F" }
    @repository.result = result
  end

  teardown do
    Rails.application.config.x.records_repository = @previous_repository
  end

  def result(status = "ready", **extra)
    { "status" => status, "plan" => @plan.deep_dup, "total" => 1, "incomplete" => true,
      "rows" => [{ "gameId" => GAME, "playerId" => DIRK, "playerName" => "Dirk Nowitzki", "playerNameKo" => "디르크 노비츠키", "date" => "2011-06-12", "values" => { "PTS" => 0, "REB" => nil } }],
      "summaries" => [], "interpreter" => "jev", "rawModel" => "secret-model-name", "confidence" => 0.987654 }.merge(extra.stringify_keys)
  end

  def visit_search(locale = "", query = "Dirk points")
    Records::Database.stub(:default, -> { flunk "UI fixtures must not connect to a database" }) do
      get "#{locale}/search", params: { q: query }
    end
    assert_response :success
  end

  test "localized search and natural examples POST with CSRF while basic examples stay GET links" do
    ["", "/en"].each do |locale|
      visit_search(locale)
      assert_select "form.search[method=post][action=?]", "#{locale}/search", count: 1
      assert_select "form.search input[name=q][maxlength='500'][aria-describedby=records-query-help]", count: 1
      assert_select "form.search button[type=submit]", text: locale.empty? ? "검색" : "Search"
      assert_select "#records-query-help", text: /Jev/
      assert_select ".searchExamples form[method=post][action=?]", "#{locale}/search", count: 3
      assert_select "form[method=post]" do |forms|
        forms.each do |form|
          assert form.at_css("input[type=hidden][name=authenticity_token]")&.[]("value").present?
          assert_empty form.css("form")
        end
      end
      assert_select ".searchExamples button[name=q]" do |buttons|
        assert_match(/30/, buttons.first["value"])
        assert buttons.all? { |button| button["value"].present? }
        assert_equal(locale.empty? ? "노비츠키와 루카의 댈러스 통산 평균 득점 비교" : "Compare Dirk and Luka's career scoring averages with Dallas", buttons.last["value"])
      end
      assert_select ".searchBasics a", count: 3 do |links|
        assert links.all? { |link| link["href"].start_with?("#{locale}/search?q=") }
        refute links.any? { |link| link["href"].include?("interpretation=") }
      end
    end
  end

  test "both home pages use the same protected search form before any question is asked" do
    ["/", "/en"].each do |path|
      Records::Database.stub(:default, -> { flunk "UI fixtures must not connect to a database" }) { get path }
      assert_response :success
      assert_select "form.search[method=post]", count: 1
      assert_select "form.search input[name=authenticity_token]" do |tokens|
        assert tokens.first["value"].present?
      end
      assert_select "form.search input[name=q][value='']", count: 1
      assert_select ".searchExamples button[name=q]", count: 3
      assert_select ".searchBasics a", count: 3
    end
  end

  test "applied conditions are localized and retain every supplied filter" do
    visit_search
    assert_select ".searchConditions li", count: 12
    assert_select ".searchConditions li", text: /기록 범위.*댈러스 소속 출전/
    ["디르크 노비츠키", "루카 돈치치", "2010–11", "플레이오프"].each do |text|
      assert_select ".searchConditions", text: /#{Regexp.escape(text)}/
    end
    ["득점 > 30", "높은 순", "최대 50행", "원정", "마이애미 히트", "F · 포워드"].each do |text|
      assert_select ".searchConditions", text: /#{Regexp.escape(text)}/
    end
    visit_search("/en")
    assert_select ".searchConditions li", text: /Scope.*Dallas appearances/
    ["Dirk Nowitzki", "Luka Doncic", "2010–11", "Playoffs", "Points > 30", "Game logs", "Highest first", "Up to 50 rows", "Away", "Miami Heat", "F · Forward"].each do |text|
      assert_select ".searchConditions", text: /#{Regexp.escape(text)}/
    end
    refute_includes response.body, "secret-model-name"
    refute_includes response.body, "0.987654"
  end

  test "zero threshold is retained and minute thresholds display converted units without mutating the plan" do
    @repository.result = result(plan: @plan.merge("threshold" => { "operator" => "eq", "value" => 0 }, "direction" => "asc", "position" => ["G", "F"]))
    visit_search
    assert_select ".searchConditions", text: /득점 = 0/
    assert_select ".searchConditions", text: /낮은 순/
    assert_select ".searchConditions", text: /G · 가드 \/ F · 포워드/
    @repository.result = result(plan: @plan.merge("stat" => "MIN_SECONDS", "threshold" => { "operator" => "gte", "value" => 1831.25 }))
    visit_search("/en")
    assert_select ".searchConditions", text: /Minutes played ≥ 30m 31\.25s/
    assert_equal 1831.25, @repository.result.dig("plan", "threshold", "value")
    @repository.result = result(plan: @plan.merge("threshold" => { "operator" => "gt", "value" => 30.125 }))
    visit_search
    assert_select ".searchConditions", text: /득점 > 30\.125/
  end

  test "ambiguous questions show choices instead of an empty-results count and escape external labels" do
    @repository.result = result("ambiguous", total: 0, choices: [
      { "labelKo" => "정규시즌 평균 득점", "labelEn" => "Regular-season scoring average", "query" => "Dirk regular season average points" },
      { "labelKo" => "<script>alert(1)</script>", "labelEn" => "<script>alert(1)</script>", "query" => 'Dirk " playoffs points' }
    ], messageKo: "정규시즌과 플레이오프 중 어느 쪽인가요?", message: "Regular season or playoffs?")
    visit_search
    assert_select ".searchFeedback h3", "어떤 조건을 원하시나요?"
    assert_select ".searchFeedback", text: /정규시즌과 플레이오프 중 어느 쪽인가요/
    assert_select ".searchFeedback .searchExamples button[name=q]", count: 2
    assert_select ".searchFeedback button", text: "<script>alert(1)</script>"
    assert_select ".searchFeedback script", count: 0
    assert_select ".searchResult .badge, .searchResult .table, .searchConditions", count: 0
    refute_match(/0\s*경기 행/, response.body)
    visit_search("/en")
    assert_select ".searchFeedback h3", "Which conditions did you mean?"
    assert_select ".searchFeedback button", text: "Regular-season scoring average"
  end

  test "unsupported questions without choices offer normal examples and preserve the editable question" do
    @repository.result = result("unsupported", total: 0, choices: [{ "query" => "" }, { "query" => "x" * 501 }], messageKo: "시즌 하나를 지정해 주세요.")
    visit_search("", "노비츠키 <기록>")
    assert_select "form.search input[name=q][value=?]", "노비츠키 <기록>"
    assert_select ".searchFeedback h3", "질문을 조금 바꿔 주세요"
    assert_select ".searchFeedback .searchExamples button[name=q]", count: 3
    assert_select ".searchResult .badge, .searchResult .table", count: 0
    assert_select ".searchFeedback", text: /시즌 하나를 지정해 주세요/
  end

  test "unavailability keeps basic GET searches accessible without claiming zero matches" do
    @repository.result = result("unavailable", total: 0, messageKo: "잠시 후 다시 시도해 주세요.", message: "Please try again shortly.")
    ["", "/en"].each do |locale|
      visit_search(locale)
      assert_select ".searchFeedback h3", text: locale.empty? ? "자연어 해석을 잠시 사용할 수 없습니다" : "Natural-language search is temporarily unavailable"
      assert_select ".searchFeedback .searchBasics a", count: 3
      assert_select ".searchFeedback .searchExamples", count: 0
      assert_select ".searchResult .badge, .searchResult .table, .searchConditions", count: 0
      assert_select ".searchFeedback", text: locale.empty? ? /기본 조건 검색은 계속 사용할 수 있습니다/ : /Basic-filter searches below are still available/
    end
  end

  test "successful rows preserve zero missing values sources and incomplete coverage" do
    visit_search
    assert_select ".searchResult .badge", "1 경기 행"
    assert_select ".searchResult tbody tr", count: 1
    assert_select ".searchResult tbody td.number" do |cells|
      assert_equal "0", cells[0].text
      assert_equal "—", cells[1].text
    end
    assert_select ".searchResult a[href='https://example.test/source']", text: /Synthetic source/
    assert_select ".searchResult .note", text: /확보 범위가 불완전합니다/
  end

  test "average profile groups key stats and readable shooting rows without losing values or calculation notes" do
    plan = { "playerIds" => [LUKA], "season" => 2021, "competition" => "regular", "stat" => "BOX_SCORE", "aggregation" => "average", "direction" => "desc", "limit" => 50 }
    summary = { "playerId" => LUKA, "games" => 65, "values" => { "PTS" => 28.4, "REB" => 9.1, "AST" => 8.7, "MIN_SECONDS" => 2123.5, "STL" => 0, "BLK" => nil, "TOV" => 4.5, "FGM" => 9.9, "FGA" => 21.6,
      "FG3M" => nil, "FG3A" => nil, "FTM" => 0, "FTA" => 2, "OREB" => 0.9, "DREB" => 8.3, "PF" => 2.2, "PLUS_MINUS" => -2.2 },
      "known" => { "BLK" => 64 }, "missing" => { "BLK" => 1 }, "percentages" => { "FG_PCT" => 0.333333333, "FG3_PCT" => nil, "FT_PCT" => 0.0 } }
    @repository.result = result(plan: plan, total: 65, rows: [], summaries: [summary])
    visit_search("", "21시즌 루카의 평균기록 알려줘. ")
    assert_select ".searchResult .badge", "65 경기"
    assert_select ".searchProfile h3", "루카 돈치치"
    assert_select ".searchProfileHeader", text: /2021–22.*정규시즌.*65.*경기 출전/m
    assert_select "dl[aria-label='주요 기록'] dt", text: "득점"
    assert_select "dl[aria-label='주요 기록'] dt", text: "리바운드"
    assert_select "dl[aria-label='주요 기록'] dt", text: "어시스트"
    assert_select ".searchProfileStats [data-stat=PTS] dd", "28.4"
    assert_select ".searchProfileStats [data-stat=MIN_SECONDS] dd", "35.4 분"
    assert_select ".searchProfileStats [data-stat=STL] dd", "0"
    assert_select ".searchProfileStats [data-stat=BLK] dd", "—"
    assert_select ".searchProfile [data-stat=FG_PCT]", "33.3%"
    assert_select ".searchProfile [data-stat=FG3_PCT]", "—"
    assert_select ".searchProfile [data-stat=FT_PCT]", "0%"
    assert_select ".searchProfileShooting caption", text: /슈팅.*경기당 평균/
    assert_select ".searchProfileShooting thead th", count: 3
    assert_select ".searchProfileShooting tbody tr", count: 3
    assert_select ".searchProfileShooting th[scope=row]", text: "야투"
    assert_select ".searchProfileShooting th[scope=row]", text: "3점슛"
    assert_select ".searchProfileShooting th[scope=row]", text: "자유투"
    expected_values = { "PTS" => "28.4", "REB" => "9.1", "AST" => "8.7", "MIN_SECONDS" => "35.4 분", "STL" => "0", "BLK" => "—", "TOV" => "4.5",
      "FGM" => "9.9", "FGA" => "21.6", "FG3M" => "—", "FG3A" => "—", "FTM" => "0", "FTA" => "2", "OREB" => "0.9", "DREB" => "8.3", "PF" => "2.2", "PLUS_MINUS" => "-2.2",
      "FG_PCT" => "33.3%", "FG3_PCT" => "—", "FT_PCT" => "0%" }
    assert_select ".searchProfile [data-stat]", count: expected_values.length
    expected_values.each do |stat, value|
      assert_select ".searchProfile [data-stat=?]", stat, count: 1 do |nodes|
        assert_equal value, (nodes.first.at_css("dd") || nodes.first).text
      end
    end
    assert_select ".searchProfile .note", text: /블록 1경기/
    assert_select ".searchProfile details:not([open]) summary", "집계 기준과 기록 읽는 법"
    assert_select ".searchProfile details", text: /2021시즌은 2021–22/
    assert_select ".searchProfile details .note", count: 0
    assert_select ".searchConditions", text: /주요 기록 전체/
    refute_match(/50|높은 순/, Nokogiri::HTML(response.body).at_css(".searchConditions").text)
    visit_search("/en", "Luka 21 season average stats")
    assert_select ".searchProfile h3", "Luka Doncic"
    assert_select ".searchProfileHeader", text: /2021–22.*Regular.*65.*games played/m
    assert_select ".searchProfileStats [data-stat=MIN_SECONDS] dd", "35.4 min"
    assert_select ".searchProfile details", text: /total makes ÷ total attempts/
    assert_select ".searchProfile details summary", "How these stats are calculated"
    assert_select ".searchProfileShooting th[scope=row]", text: "Field goals"
    assert_select ".searchProfile .note", text: /Blocks 1 games/
  end

  test "valid empty and aggregate results remain distinct from interpretation failure" do
    @repository.result = result("empty", total: 0, rows: [], summaries: [])
    visit_search
    assert_select ".searchResult .badge", "0 경기 행"
    assert_select ".searchResult .empty h3", "이 조건에 표시할 기록이 없습니다"
    assert_select ".searchConditions", count: 1
    assert_select ".searchFeedback", count: 0
    @repository.result = result(rows: [], plan: @plan.merge("aggregation" => "compare"), summaries: [
      { "playerId" => DIRK, "value" => nil, "games" => 12, "missing" => 1 },
      { "playerId" => LUKA, "value" => 0, "games" => 3, "missing" => 0 }
    ])
    visit_search
    assert_select ".searchResult .meaning", text: /디르크 노비츠키: —.*12 경기.*1 미기록.*루카 돈치치: 0/m
    assert_select ".searchConditions", text: /평균 비교/
  end

  test "team queries show wins losses recent games and KST dates without player aggregate labels" do
    plan = { "intent" => "team_record", "playerIds" => [], "season" => 2010, "competition" => "regular", "stat" => "PTS",
      "aggregation" => "count", "direction" => "desc", "limit" => 50, "recentGames" => 2,
      "dateFrom" => "2010-11-02", "dateTo" => "2010-11-03" }
    @repository.result = result(plan: plan, total: 2, rows: [], summaries: [],
      teamSummary: { "games" => 2, "wins" => 1, "losses" => 0, "unknown" => 1 }, gameRows: [
        { "gameId" => GAME, "date" => "2010-11-01", "tipoffUtc" => "2010-11-01T16:00:00Z", "homeTeamId" => "dal", "awayTeamId" => "mia", "homeScore" => 100, "awayScore" => 90, "outcome" => "W" },
        { "gameId" => "second", "date" => "2010-11-03", "homeTeamId" => "mia", "awayTeamId" => "dal", "homeScore" => nil, "awayScore" => nil, "outcome" => nil }
      ])
    visit_search("", "최근 두 경기 승패")
    assert_select "[data-team-record]", text: /1 승.*0 패.*2 확보 경기 기준.*1 승패 미확인/
    assert_select "[data-search-games] tbody tr", count: 2
    assert_select "[data-search-games] tbody tr:first-child td:first-child", text: "2010-11-02"
    assert_select "[data-search-games] tbody tr:last-child", text: /원천 날짜.*— : —.*미확인/m
    assert_select ".searchConditions", text: /댈러스 완료 경기.*댈러스 최근 완료 2경기.*한국시간.*2010-11-02 ~ 2010-11-03.*팀 승패/m
    refute_match(/높은 순|DAL 선수 전체/, Nokogiri::HTML(response.body).at_css(".searchConditions").text)
    visit_search("/en", "last 2 games record")
    assert_select "[data-team-record]", text: /1 wins.*0 losses.*2 available games/
    assert_select ".searchConditions", text: /Completed Dallas games.*Last 2 completed Dallas games.*Team record/m
  end

  test "recent player game scope displays DNP and absent participation without invented zeros" do
    @repository.result = result(plan: @plan.except("threshold", "position").merge("playerIds" => [DIRK], "recentGames" => 2),
      rows: [], summaries: [], total: 0, gameRows: [
        { "gameId" => GAME, "date" => "2011-06-12", "homeTeamId" => "dal", "awayTeamId" => "mia", "homeScore" => 100, "awayScore" => 90,
          "outcome" => "W", "playerStats" => [{ "playerId" => DIRK, "participation" => "dnp" }] },
        { "gameId" => "second", "date" => "2011-06-13", "homeTeamId" => "mia", "awayTeamId" => "dal", "homeScore" => 100, "awayScore" => 90, "outcome" => "L", "playerStats" => [] }
      ])
    visit_search
    assert_select "[data-search-games] tbody tr:first-child", text: /미출전 \(DNP\)/
    assert_select "[data-search-games] tbody tr:last-child", text: /출전 여부 미확인/
    assert_select ".searchResult .empty", count: 0
    visit_search("/en")
    assert_select "[data-search-games]", text: /Did not play \(DNP\).*Participation unknown/m
  end

  test "scope warnings remain visible on empty results and display limits are explicit" do
    plan = @plan.except("threshold", "position").merge("intent" => "team_games", "playerIds" => [], "recentGames" => 82)
    @repository.result = result("empty", plan: plan, total: 0, rows: [], summaries: [], gameRows: [],
      unknownDateGames: 2, unknownVenueGames: 1, unknownPlayerGames: 3)
    visit_search
    assert_select ".searchResult .note", text: /시작시각을 확인하지 못한 2경기/
    assert_select ".searchResult .note", text: /장소 분류가 미확인인 1경기/
    assert_select ".searchResult .note", text: /출전 여부가 미확인인 기록이 3건/
    assert_select ".searchConditions", text: /최근 완료 82경기.*최대 50경기/m
    assert_select ".searchResult .empty", count: 1
  end

  test "player stat rows use the same Korea-time date as the recent game table" do
    plan = @plan.except("threshold", "position").merge("playerIds" => [DIRK], "recentGames" => 1)
    row = result["rows"].first.merge("date" => "2011-06-12", "tipoffUtc" => "2011-06-12T16:00:00Z")
    @repository.result = result(plan: plan, rows: [row], gameRows: [
      { "gameId" => GAME, "date" => row["date"], "tipoffUtc" => row["tipoffUtc"], "homeTeamId" => "dal", "awayTeamId" => "mia", "homeScore" => 100, "awayScore" => 90,
        "outcome" => "W", "playerStats" => [{ "playerId" => DIRK, "participation" => "played" }] }
    ])
    visit_search
    assert_select ".searchResult tbody a[href=?]", "/games/#{ERB::Util.url_encode(GAME)}", text: "2011-06-13", count: 2
  end
end
