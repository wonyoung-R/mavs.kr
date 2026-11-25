# frozen_string_literal: true

require "test_helper"
require_relative "../../app/services/records/query"

class RecordsQueryTest < ActiveSupport::TestCase
  STAT_KEYS = %w[PTS REB AST STL BLK TOV PF FGM FGA FG3M FG3A FTM FTA OREB DREB PLUS_MINUS MIN_SECONDS].freeze

  def values(points)
    STAT_KEYS.to_h { |key| [key, key == "PTS" ? points : nil] }
  end

  def fixture
    data = { "version" => 1, "games" => [], "playerStats" => [], "teamStats" => [], "coverage" => [], "sources" => [] }
    data["teams"] = [
      { "id" => "dal", "abbreviation" => "DAL", "name" => "Dallas Mavericks", "nameKo" => "댈러스 매버릭스", "aliases" => ["mavs"] },
      { "id" => "mia", "abbreviation" => "MIA", "name" => "Miami Heat", "nameKo" => "마이애미", "aliases" => ["heat"] }
    ]
    data["players"] = [
      { "id" => "dirk", "name" => "Dirk Nowitzki", "nameKo" => "디르크 노비츠키", "aliases" => ["dirk", "노비츠키"] },
      { "id" => "other", "name" => "Other Player", "nameKo" => "다른 선수", "aliases" => ["other"] }
    ]
    3.times do |index|
      data["games"] << {
        "id" => "g#{index}", "season" => 2010, "competition" => "playoffs", "date" => "2011-06-0#{index + 1}",
        "tipoffUtc" => nil, "homeTeamId" => index == 1 ? "mia" : "dal", "awayTeamId" => index == 1 ? "dal" : "mia",
        "neutral" => false, "status" => "final", "homeScore" => 100, "awayScore" => 90, "sourceId" => "test", "sourceGameId" => "x#{index}", "cup" => false
      }
      data["playerStats"] << {
        "gameId" => "g#{index}", "teamId" => "dal", "playerId" => "dirk", "participation" => "played",
        "starter" => true, "reason" => nil, "values" => values([30, 0, nil][index]), "sourceId" => "test"
      }
    end
    data["playerStats"] << {
      "gameId" => "g0", "teamId" => "dal", "playerId" => "other", "participation" => "dnp",
      "starter" => false, "reason" => "coach decision", "values" => values(nil), "sourceId" => "test"
    }
    data
  end

  def complete_coverage(data)
    data["coverage"] = [
      { "season" => 2010, "competition" => "playoffs", "dataset" => "games", "field" => "all", "expected" => 3, "observed" => 3, "status" => "complete", "evidence" => "Test ledger" },
      { "season" => 2010, "competition" => "playoffs", "dataset" => "playerStats", "field" => "PTS", "expected" => 3, "observed" => 3, "status" => "complete", "evidence" => "Test field ledger" }
    ]
  end

  def profile_fixture(count = 2)
    data = fixture
    game, stat = data["games"].first, data["playerStats"].first
    data["games"] = count.times.map { |i| game.merge("id" => "p#{i}", "date" => (Date.new(2011, 1, 1) + i).iso8601) }
    data["playerStats"] = count.times.map do |i|
      stat.merge("gameId" => "p#{i}", "values" => Records::Query::BOX_SCORE_STATS.to_h { |key| [key, 0] }
        .merge("PTS" => i + 1, "FGM" => 1, "FGA" => 2, "MIN_SECONDS" => 900 + i))
    end
    data["coverage"] = %w[games playerStats].map do |kind|
      { "season" => 2010, "competition" => "playoffs", "dataset" => kind, "field" => "all", "expected" => count,
        "observed" => count, "status" => "complete", "evidence" => "Synthetic profile fixture" }
    end
    data
  end

  test "Korean and English filters preserve zero and exclude DNP" do
    data = fixture
    english = Records::Query.execute("Dirk 2010-11 playoffs away points", data)
    korean = Records::Query.execute("노비츠키 2010-11 플레이오프 원정 득점", data)
    assert_equal 1, english["total"]
    assert_equal 0, english["rows"].first.dig("values", "PTS")
    assert_equal english, korean
    assert_equal "g1", english["rows"].first["gameId"]
  end

  test "parser emits string keys and omits undefined optional fields" do
    assert_equal({ "status" => "ok", "plan" => {
      "playerIds" => ["dirk"], "competition" => "regular", "stat" => "PTS", "aggregation" => "games", "direction" => "desc", "limit" => 50
    } }, Records::Query.parse("Dirk points", fixture))
    assert_equal Records::Query.parse("dirk 2010 playoffs points", fixture), Records::Query.parse("ＤＩＲＫ　２０１０　playoffs points", fixture)
  end

  test "threshold removes null but preserves incomplete metadata" do
    result = Records::Query.execute("dirk 2010 playoffs 30 points or more", fixture)
    assert_equal 1, result["total"]
    assert_equal 30, result["rows"].first.dig("values", "PTS")
    assert_equal true, result["incomplete"]
  end

  test "all threshold operators and minute units match the legacy parser" do
    { "at least 30" => "gte", "30 초과" => "gt", "30 이하" => "lte", "under 30" => "lt", "exactly 30" => "eq" }.each do |condition, operator|
      plan = Records::Query.parse("dirk points #{condition}", fixture).fetch("plan")
      assert_equal({ "operator" => operator, "value" => 30 }, plan["threshold"])
    end
    assert_equal({ "operator" => "gte", "value" => 1830 }, Records::Query.parse("Dirk minutes at least 30.5", fixture).dig("plan", "threshold"))
    assert_equal 200, Records::Query.parse("dirk points top 9999", fixture).dig("plan", "limit")
    assert_equal 1, Records::Query.parse("dirk points top 0", fixture).dig("plan", "limit")
  end

  test "long metric aliases are consumed before substrings from a different statistic" do
    ["dirk 3점슛 5 이상", "dirk three pointers at least 5"].each do |query|
      plan = Records::Query.parse(query, fixture).fetch("plan")
      assert_equal "FG3M", plan["stat"]
      assert_equal({ "operator" => "gte", "value" => 5 }, plan["threshold"])
    end
    assert_equal "unsupported", Records::Query.parse("dirk 득점 3점슛", fixture)["status"]
  end

  test "unqualified one player averages choose a full profile while explicit metrics retain their meaning" do
    ["노비츠키 평균기록 알려줘", "Dirk average stats", "Dirk 2010-11 playoffs average"].each do |query|
      assert_equal "BOX_SCORE", Records::Query.parse(query, fixture).dig("plan", "stat"), query
    end
    assert_equal "PTS", Records::Query.parse("Dirk average points", fixture).dig("plan", "stat")
    assert_equal "AST", Records::Query.parse("노비츠키 평균 어시스트", fixture).dig("plan", "stat")
    { "average stats" => "ambiguous", "dirk other average stats" => "ambiguous",
      "dirk average over 30" => "unsupported", "dirk other compare average stats" => "unsupported",
      "dirk top 5 average stats" => "unsupported", "dirk top 50 average stats" => "unsupported",
      "dirk average stats highest" => "unsupported", "dirk average stats lowest" => "unsupported" }.each do |query, status|
      result = Records::Query.parse(query, fixture)
      assert_equal status, result["status"], query
      refute result.key?("plan")
    end
  end

  test "numeric filter metrics cannot silently replace an explicitly requested full average profile" do
    ["노비츠키 평균기록 30점 이상", "Dirk average stats over 30 points", "노비츠키 평균 스탯 어시스트 10 이상",
      "노비츠키 평균기록 득점 상위 5", "Dirk average stats points top 50", "노비츠키 평균기록 리바운드 highest"].each do |query|
      result = Records::Query.parse(query, fixture)
      assert_equal "unsupported", result["status"], query
      refute result.key?("plan")
    end
    result = Records::Query.parse("노비츠키 평균 득점 30 이상", fixture)
    assert_equal "ok", result["status"]
    assert_equal "PTS", result.dig("plan", "stat")
    assert_equal({ "operator" => "gte", "value" => 30 }, result.dig("plan", "threshold"))
  end

  test "box score profiles use the full season denominator and exclude DNP rather than stopping at 50 rows" do
    data = profile_fixture(60)
    data["games"] << data["games"].first.merge("id" => "dnp")
    data["playerStats"] << data["playerStats"].first.merge("gameId" => "dnp", "participation" => "dnp", "values" => values(9999))
    result = Records::Query.execute("dirk 2010 playoffs average stats", data)
    assert_equal "ready", result["status"]
    assert_equal [], result["rows"]
    assert_equal 60, result["total"]
    summary = result["summaries"].first
    assert_equal "dirk", summary["playerId"]
    assert_equal 60, summary["games"]
    assert_equal 30.5, summary.dig("values", "PTS")
    assert_equal 929.5, summary.dig("values", "MIN_SECONDS")
    assert_equal 60, summary.dig("known", "PTS")
    assert_equal 0, summary.dig("missing", "PTS")
    assert_equal Records::Query::BOX_SCORE_STATS.sort, summary["values"].keys.sort
    assert_equal false, result["incomplete"]
  end

  test "profile percentages divide total makes by attempts and preserve true zero and no attempts" do
    data = profile_fixture
    data["playerStats"][0]["values"].merge!("FGM" => 1, "FGA" => 1, "FTM" => 0, "FTA" => 4)
    data["playerStats"][1]["values"].merge!("FGM" => 0, "FGA" => 9, "FTM" => 0, "FTA" => 0)
    result = Records::Query.execute("dirk 2010 playoffs average stats", data)
    summary = result["summaries"].first
    assert_in_delta 0.1, summary.dig("percentages", "FG_PCT"), 0.00001
    assert_equal 0.0, summary.dig("percentages", "FT_PCT")
    assert_nil summary.dig("percentages", "FG3_PCT")
    assert_equal 0.5, summary.dig("values", "FGM")
    assert_equal 5.0, summary.dig("values", "FGA")
    assert_equal 0.0, summary.dig("values", "REB")
    assert_equal false, result["incomplete"]
  end

  test "one missing profile field invalidates that average and related shooting percentage only" do
    data = profile_fixture
    data["playerStats"][1]["values"].merge!("REB" => nil, "FGA" => nil)
    result = Records::Query.execute("dirk 2010 playoffs average stats", data)
    summary = result["summaries"].first
    assert_nil summary.dig("values", "REB")
    assert_nil summary.dig("values", "FGA")
    assert_nil summary.dig("percentages", "FG_PCT")
    assert_equal 1, summary.dig("known", "REB")
    assert_equal 1, summary.dig("missing", "REB")
    assert_equal 1.5, summary.dig("values", "PTS")
    assert_equal true, result["incomplete"]
  end

  test "profile empty scopes return no invented profile while preserving verified zero games" do
    data = profile_fixture(0)
    result = Records::Query.execute("dirk 2010 playoffs average stats", data)
    assert_equal "empty", result["status"]
    assert_equal 0, result["total"]
    assert_equal [], result["summaries"]
    assert_equal false, result["incomplete"]
  end

  test "profile completeness requires every field coverage and accounts for unknown participation and venue" do
    data = profile_fixture
    coverage = data["coverage"].pop
    Records::Query::BOX_SCORE_STATS.each { |stat| data["coverage"] << coverage.merge("field" => stat) }
    assert_equal false, Records::Query.execute("dirk 2010 playoffs average stats", data)["incomplete"]
    data["coverage"].last["status"] = "partial"
    assert_equal true, Records::Query.execute("dirk 2010 playoffs average stats", data)["incomplete"]
    data["coverage"].last["status"] = "complete"
    data["playerStats"][1]["participation"] = "unknown"
    result = Records::Query.execute("dirk 2010 playoffs average stats", data)
    assert_equal 1, result["total"]
    assert_equal true, result["incomplete"]
    data["playerStats"][1]["participation"] = "played"
    data["games"].each { |game| game["neutral"] = nil }
    result = Records::Query.execute("dirk 2010 playoffs home average stats", data)
    assert_equal "empty", result["status"]
    assert_equal true, result["incomplete"]
    assert_match "중립", result["messageKo"]
    assert_equal true, Records::Query.execute("dirk playoffs average stats", data)["incomplete"]
  end

  test "profile filters retain opponent venue final game and Dallas appearance boundaries" do
    data = profile_fixture(4)
    data["teams"] << { "id" => "nyk", "abbreviation" => "NYK", "name" => "New York Knicks", "aliases" => %w[knicks] }
    data["games"][1].merge!("homeTeamId" => "mia", "awayTeamId" => "dal")
    data["games"][2]["awayTeamId"] = "nyk"
    data["playerStats"][2]["participation"] = "unknown"
    data["games"][3]["status"] = "scheduled"
    data["playerStats"] << data["playerStats"].first.merge("teamId" => "mia", "values" => values(100))
    home = Records::Query.execute("dirk 2010 playoffs home against heat average stats", data)
    away = Records::Query.execute("dirk 2010 playoffs away against heat average stats", data)
    assert_equal 1, home["total"]
    assert_equal 1.0, home.dig("summaries", 0, "values", "PTS")
    assert_equal false, home["incomplete"]
    assert_equal 1, away["total"]
    assert_equal 2.0, away.dig("summaries", 0, "values", "PTS")
    assert_equal false, away["incomplete"]
  end

  test "missing values do not silently become zero sums or averages" do
    %w[total average].each do |aggregation|
      result = Records::Query.execute("dirk 2010 playoffs #{aggregation} points", fixture)
      assert_nil result["summaries"].first["value"]
      assert_equal 1, result["summaries"].first["missing"]
    end
  end

  test "unverified coverage cannot turn an empty count into factual zero" do
    result = Records::Query.execute("dirk 2010 playoffs count over 99 points", fixture)
    assert_nil result["summaries"].first["value"]
    assert_equal "empty", result["status"]
    assert_equal 0, result["total"]
    assert_equal "No matching verified records are loaded.", result["message"]
  end

  test "complete coverage permits zero counts but all season coverage remains incomplete" do
    data = fixture
    data["playerStats"][2]["values"]["PTS"] = 20
    complete_coverage(data)
    result = Records::Query.execute("dirk 2010 playoffs count over 99 points", data)
    assert_equal 0, result["summaries"].first["value"]
    assert_equal false, result["incomplete"]
    assert_equal true, Records::Query.execute("dirk playoffs count", data)["incomplete"]
  end

  test "unknown participation and venue prevent claims of complete coverage" do
    data = fixture
    data["playerStats"][2]["values"]["PTS"] = 20
    complete_coverage(data)
    data["playerStats"][2]["participation"] = "unknown"
    assert_equal true, Records::Query.execute("dirk 2010 playoffs count", data)["incomplete"]
    data["playerStats"][2]["participation"] = "played"
    data["games"][2]["neutral"] = nil
    result = Records::Query.execute("dirk 2010 playoffs home count", data)
    assert_equal 1, result["total"]
    assert_nil result["summaries"].first["value"]
    assert_equal true, result["incomplete"]
  end

  test "ambiguous and unsupported conditions do not execute a broader query" do
    {
      "dirk clutch points" => "unsupported", "dirk 2010 2011 points" => "ambiguous",
      "dirk 2010-12 points" => "unsupported", "dirk playoffs regular season points" => "ambiguous",
      "dirk home away points" => "ambiguous", "dirk points rebounds" => "unsupported",
      "dirk points over 20 under 40" => "unsupported", "dirk points compare" => "ambiguous"
    }.each do |text, status|
      result = Records::Query.execute(text, fixture)
      assert_equal status, result["status"], text
      assert_equal [], result["rows"], text
      refute result.key?("plan"), text
      assert result["messageKo"], text
    end
    data = fixture
    data["players"][1]["aliases"] = ["dirk"]
    assert_equal "ambiguous", Records::Query.parse("dirk points", data)["status"]
  end

  test "empty or long input uses the original error and UTF16 length boundary" do
    ["", " \n\t", "\uFEFF", "a" * 501, "😀" * 251].each do |text|
      result = Records::Query.parse(text, fixture)
      assert_equal "unsupported", result["status"]
      assert_equal "Enter a question of 1–500 characters.", result["message"]
    end
  end

  test "comparison averages each player separately and preserves mention order" do
    data = fixture
    data["playerStats"][2]["values"]["PTS"] = 60
    data["playerStats"] << data["playerStats"].first.merge("playerId" => "other", "gameId" => "g1", "values" => values(10))
    result = Records::Query.execute("other vs Dirk 2010 playoffs compare points", data)
    assert_equal %w[other dirk], result["summaries"].map { |row| row["playerId"] }
    assert_equal [10.0, 30.0], result["summaries"].map { |row| row["value"] }
    data["players"].reverse!
    assert_equal result, Records::Query.execute("other vs Dirk 2010 playoffs compare points", data)
  end

  test "aliases containing regexp syntax are literal and opponents remain scoped" do
    data = fixture
    data["players"].first["aliases"] = ["a.b"]
    assert_equal "ok", Records::Query.parse("a.b 2010 playoffs points", data)["status"]
    assert_equal "unsupported", Records::Query.parse("axb 2010 playoffs points", data)["status"]
    assert_equal "mia", Records::Query.parse("a.b 2010 playoffs points against heat", data).dig("plan", "opponentId")
    data["teams"] << { "id" => "lal", "abbreviation" => "LAL", "name" => "Los Angeles Lakers", "nameKo" => "레이커스", "aliases" => ["lakers"] }
    assert_equal "ambiguous", Records::Query.parse("a.b points against heat lakers", data)["status"]
  end

  test "game count deduplicates two players in one game while total counts rows" do
    data = fixture
    data["playerStats"][2]["values"]["PTS"] = 20
    data["playerStats"] << data["playerStats"].first.merge("playerId" => "other", "values" => values(35))
    complete_coverage(data)
    result = Records::Query.execute("mavs 2010 playoffs count 30 points or more", data)
    assert_equal 2, result["total"]
    assert_equal 1, result["summaries"].first["value"]
    assert_equal 1, result["summaries"].first["games"]
  end

  test "sorting bounds visible rows without limiting aggregates or mutating source" do
    data = fixture
    before = Marshal.dump(data)
    result = Records::Query.execute("dirk 2010 playoffs points lowest top 1", data)
    assert_equal 3, result["total"]
    assert_equal 1, result["rows"].length
    assert_equal 0, result["rows"].first.dig("values", "PTS")
    assert_equal before, Marshal.dump(data)
  end
end
