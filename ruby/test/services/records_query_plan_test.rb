# frozen_string_literal: true

require "test_helper"
require_relative "../../app/services/records/query_plan"

class RecordsQueryPlanTest < ActiveSupport::TestCase
  setup do
    @dataset = { "players" => [{ "id" => "dirk" }, { "id" => "luka" }],
      "teams" => [{ "id" => "dal", "abbreviation" => "DAL" }, { "id" => "mia", "abbreviation" => "MIA" }] }
    @plan = { "playerIds" => ["dirk"], "competition" => "regular", "stat" => "PTS", "aggregation" => "games", "direction" => "desc", "limit" => 50 }
  end

  test "valid plans are copied without silently dropping optional conditions" do
    plan = @plan.merge("season" => 2010, "venue" => "away", "opponentId" => "mia", "threshold" => { "operator" => "gt", "value" => 30.5 })
    result = Records::QueryPlan.validate(plan, @dataset)
    assert_equal "ok", result["status"]
    assert_equal plan, result["plan"]
    result["plan"]["playerIds"].clear
    assert_equal ["dirk"], plan["playerIds"]
  end

  test "unknown IDs fields enums bounds and numeric types fail closed" do
    invalid = [nil, [], {}, @plan.except("stat"), @plan.merge("sql" => "SELECT *"),
      @plan.merge("stat" => "PTS;DROP"), @plan.merge("aggregation" => "median"), @plan.merge("direction" => "DESC;--"),
      @plan.merge("competition" => "all"), @plan.merge("venue" => "unknown"), @plan.merge("opponentId" => "made-up"),
      @plan.merge("opponentId" => "dal"), @plan.merge("playerIds" => ["made-up"]), @plan.merge("playerIds" => "dirk"),
      @plan.merge("playerIds" => ["dirk", "dirk"]), @plan.merge("season" => "2010"), @plan.merge("season" => 1945),
      @plan.merge("season" => 9999), @plan.merge("limit" => 0), @plan.merge("limit" => 201), @plan.merge("limit" => 5.5)]
    invalid += [nil, { "operator" => "gt", "value" => "30" }, { "operator" => "gt", "value" => Float::INFINITY },
      { "operator" => "gt", "value" => Float::NAN }, { "operator" => "gte", "value" => 30, "other" => true },
      { "operator" => "gte", value: 30 },
      { "operator" => "between", "value" => 30 }, { "operator" => "gt", "value" => 1_000_000_001 }]
      .map { |threshold| @plan.merge("threshold" => threshold) }
    invalid.each do |plan|
      result = Records::QueryPlan.validate(plan, @dataset)
      assert_equal "unsupported", result["status"], plan.inspect
      refute result.key?("plan")
    end
  end

  test "comparisons require exactly two distinct catalog players" do
    assert_equal "unsupported", Records::QueryPlan.validate(@plan.merge("aggregation" => "compare"), @dataset)["status"]
    plan = @plan.merge("aggregation" => "compare", "playerIds" => %w[luka dirk])
    assert_equal %w[luka dirk], Records::QueryPlan.validate(plan, @dataset).dig("plan", "playerIds")
  end

  test "box score profiles require one named player average aggregation and no threshold" do
    profile = @plan.merge("stat" => "BOX_SCORE", "aggregation" => "average")
    assert_equal "ok", Records::QueryPlan.validate(profile, @dataset)["status"]
    [profile.merge("playerIds" => []), profile.merge("playerIds" => %w[dirk luka]), profile.merge("aggregation" => "sum"),
      profile.merge("aggregation" => "games"), profile.merge("aggregation" => "compare", "playerIds" => %w[dirk luka]),
      profile.merge("threshold" => { "operator" => "gte", "value" => 30 }), profile.merge("threshold" => nil),
      profile.merge("limit" => 5), profile.merge("direction" => "asc")].each do |plan|
      result = Records::QueryPlan.validate(plan, @dataset)
      assert_equal "unsupported", result["status"], plan.inspect
      refute result.key?("plan")
    end
  end
end
