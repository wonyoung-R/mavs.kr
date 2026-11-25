# frozen_string_literal: true

require "test_helper"
require_relative "../../app/services/records/query_interpreter"

class RecordsGameQueryTest < ActiveSupport::TestCase
  setup do
    @dataset = { "players" => [{ "id" => "dirk", "name" => "Dirk Nowitzki", "aliases" => %w[dirk 노비츠키] }],
      "teams" => [{ "id" => "dal", "abbreviation" => "DAL", "name" => "Dallas Mavericks", "aliases" => %w[댈러스] }] }
    @parser = Records::QueryInterpreter.new(today: Date.new(2026, 10, 24), client: Object.new)
  end

  def parse(text)
    @parser.parse(text, @dataset, release_id: "fixture", allow_remote: false)
  end

  test "team recent results and explicit default are local and preserve the requested count" do
    { "어제 경기 결과는?" => nil, "최근 두 경기 결과 알려줘" => 2, "last 2 games results" => 2, "지난 경기 결과" => 1, "최근 경기 결과" => 2 }.each do |query, count|
      result = parse(query)
      assert_equal "ok", result["status"], result.inspect
      assert_equal "rules", result["interpreter"]
      assert_equal "team_games", result.dig("plan", "intent")
      count ? assert_equal(count, result.dig("plan", "recentGames")) : assert_nil(result.dig("plan", "recentGames"))
    end
  end

  test "season team record and player recent averages are separate plans" do
    result = parse("올시즌 댈러스 몇 승 몇 패야?")
    assert_equal "ok", result["status"], result.inspect
    assert_equal 2026, result.dig("plan", "season")
    assert_equal "team_record", result.dig("plan", "intent")
    historical = parse("2010-11 시즌 몇 승 몇 패?")
    assert_equal "ok", historical["status"], historical.inspect
    assert_equal 2010, historical.dig("plan", "season")
    result = parse("노비츠키 최근 2경기 평균 득점")
    assert_equal "ok", result["status"], result.inspect
    assert_equal ["dirk"], result.dig("plan", "playerIds")
    assert_equal "average", result.dig("plan", "aggregation")
    assert_equal 2, result.dig("plan", "recentGames")
    refute result["plan"].key?("intent")
  end

  test "KST date and date ranges preserve exact endpoints" do
    { "어제 경기 결과" => %w[2026-10-23 2026-10-23], "today results" => %w[2026-10-24 2026-10-24],
      "2026-10-01부터 2026-10-24까지 댈러스 승패" => %w[2026-10-01 2026-10-24],
      "Dirk 2011-04-01 to 2011-04-30 average points" => %w[2011-04-01 2011-04-30] }.each do |query, dates|
      result = parse(query)
      assert_equal "ok", result["status"], result.inspect
      assert_equal dates, result["plan"].values_at("dateFrom", "dateTo")
    end
  end

  test "scope failures never silently become broader plans" do
    ["최근 0경기 결과", "최근 83경기 결과", "최근 2경기 최근 3경기 결과", "어제 오늘 결과", "2026-02-30 결과",
      "2026-10-24부터 2026-10-01까지 결과", "2026-10-01 2026-10-24 결과", "노비츠키 최근 출전 2경기 득점",
      "최근 2경기 평균 합계 득점", "최근 2경기 평균 득점", "노비츠키 최근 2경기 평균 몇 경기 득점", "노비츠키 최근 2경기 승패", "최근 2경기 승패 평균 득점", "최근 2경기 리바운드 10 이상 득점"].each do |query|
      result = parse(query)
      refute_equal "ok", result["status"], query
      refute result.key?("plan"), query
    end
  end

  test "plan validation keeps old plans valid and rejects malformed scope fields" do
    plan = { "playerIds" => [], "competition" => "regular", "stat" => "PTS", "aggregation" => "games", "direction" => "desc", "limit" => 50 }
    assert_equal "ok", Records::QueryPlan.validate(plan, @dataset)["status"]
    [{ "recentGames" => "2" }, { "dateFrom" => "2026-10-01" }, { "dateFrom" => nil, "dateTo" => nil },
      { "dateFrom" => "2026-02-30", "dateTo" => "2026-03-01" }, { "intent" => "sql" }, { "intent" => "team_record" },
      { "intent" => "team_games", "playerIds" => ["dirk"] }].each do |fields|
      assert_equal "unsupported", Records::QueryPlan.validate(plan.merge(fields), @dataset)["status"], fields.inspect
    end
  end
  test "recent scopes retain established short-season and playoff-year meanings" do
    playoff = parse("노비츠키 2011년 플레이오프 최근 2경기 평균 득점")
    assert_equal "ok", playoff["status"], playoff.inspect
    assert_equal 2010, playoff.dig("plan", "season")
    assert_equal "playoffs", playoff.dig("plan", "competition")
    short = parse("노비츠키 최근 2경기 21시즌 평균 득점")
    assert_equal "ok", short["status"], short.inspect
    assert_equal 2021, short.dig("plan", "season")
    ambiguous = parse("노비츠키 올해 최근 2경기 평균 득점")
    assert_equal "ambiguous", ambiguous["status"]
    assert ambiguous["choices"].all? { |choice| choice["query"].include?("최근 2경기") }
  end

end
