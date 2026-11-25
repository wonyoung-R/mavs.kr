# frozen_string_literal: true

require "test_helper"
require_relative "../../app/services/records/lineup"

class RecordsLineupTest < ActiveSupport::TestCase
  def row(id, starter, position, minutes, participation = "played")
    { "gameId" => "g", "teamId" => "dal", "playerId" => id, "starter" => starter, "starterPosition" => position,
      "participation" => participation, "reason" => nil, "sourceId" => "s", "values" => { "MIN_SECONDS" => minutes } }
  end

  def starting_five
    [row("c", true, "C", 600), row("f1", true, "F", 1200), row("g1", true, "G", 900), row("f2", true, "F", 500), row("g2", true, "G", 400)]
  end

  test "starters are G F C then bench by minutes then non-participants" do
    input = [row("dnp", nil, nil, 9999, "dnp"), row("bench-short", nil, nil, 0), *starting_five,
      row("bench-long", false, nil, 2400), row("bench-null", nil, nil, nil), row("inactive", nil, nil, nil, "inactive")]
    original = Marshal.dump(input)
    result = Records::Lineup.organize(input)
    assert_equal true, result["lineupKnown"]
    assert_equal %w[g1 g2 f1 f2 c bench-long bench-short bench-null dnp inactive], result["rows"].map { |item| item["row"]["playerId"] }
    assert_equal Array.new(5, "Starter"), result["rows"].first(5).map { |item| item["role"] }
    assert_equal "Bench", result["rows"][6]["role"]
    assert_equal original, Marshal.dump(input)
    assert_same input.first, result["rows"][-2]["row"]
  end

  test "incomplete or conflicting lineups never invent starter or bench roles" do
    cases = [starting_five.first(4), [*starting_five, row("sixth", true, "G", 200)], [row("unknown", nil, nil, 1200)],
      [*starting_five.first(4), row("bad", true, "C", nil, "dnp")]]
    cases.each do |input|
      result = Records::Lineup.organize(input)
      assert_equal false, result["lineupKnown"]
      refute result["rows"].any? { |item| %w[Starter Bench].include?(item["role"]) }
    end
  end

  test "unknown participation stays unknown with a complete starting five" do
    result = Records::Lineup.organize([*starting_five, row("uncertain", false, "G", 120, "unknown")])
    assert_equal true, result["lineupKnown"]
    assert_equal "Unknown", result["rows"].last["role"]
    assert_equal "G", result["rows"].last["row"]["starterPosition"]
  end

  test "missing positions stay missing and empty lineups remain unverified" do
    players = starting_five
    players[2]["starterPosition"] = nil
    result = Records::Lineup.organize(players)
    assert_equal %w[g2 f1 f2 c g1], result["rows"].map { |item| item["row"]["playerId"] }
    assert_nil result["rows"].last["row"]["starterPosition"]
    assert_equal({ "lineupKnown" => false, "rows" => [] }, Records::Lineup.organize([]))
  end
end
