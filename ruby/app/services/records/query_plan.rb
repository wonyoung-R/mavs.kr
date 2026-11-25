# frozen_string_literal: true

require "date"
require_relative "query"

module Records
  # This is the trust boundary shared by rule, remote and signed-plan searches.
  # Reject unknown fields instead of turning a narrower request into a broad one.
  class QueryPlan
    VERSION = "4"
    REQUIRED = %w[playerIds competition stat aggregation direction limit].freeze
    OPTIONAL = %w[season venue opponentId threshold intent recentGames dateFrom dateTo].freeze
    OPERATORS = %w[gte gt lte lt eq].freeze
    AGGREGATIONS = %w[games average sum count compare].freeze

    def self.validate(plan, dataset, today: Date.today)
      valid = plan.is_a?(Hash) && (REQUIRED - plan.keys).empty? && (plan.keys - REQUIRED - OPTIONAL).empty?
      return failure unless valid

      players = dataset.fetch("players", []).map { |row| row["id"] }
      teams = dataset.fetch("teams", []).reject { |row| row["abbreviation"] == "DAL" }.map { |row| row["id"] }
      ids = plan["playerIds"]
      valid &&= ids.is_a?(Array) && ids.length <= 20 && ids.uniq == ids && ids.all? { |id| id.is_a?(String) && players.include?(id) }
      valid &&= %w[regular playoffs].include?(plan["competition"])
      valid &&= (Query::METRICS.key?(plan["stat"]) || plan["stat"] == "BOX_SCORE") && AGGREGATIONS.include?(plan["aggregation"])
      valid &&= %w[asc desc].include?(plan["direction"])
      valid &&= plan["limit"].is_a?(Integer) && (1..200).cover?(plan["limit"])
      valid &&= !plan.key?("season") || (plan["season"].is_a?(Integer) && (1946..today.year + 1).cover?(plan["season"]))
      valid &&= !plan.key?("venue") || %w[home away neutral].include?(plan["venue"])
      valid &&= !plan.key?("opponentId") || teams.include?(plan["opponentId"])
      valid &&= plan["aggregation"] != "compare" || ids.length == 2
      valid &&= plan["stat"] != "BOX_SCORE" || (plan["aggregation"] == "average" && ids.length == 1 && !plan.key?("threshold") && plan["direction"] == "desc" && plan["limit"] == 50)
      valid &&= !plan.key?("intent") || %w[team_games team_record].include?(plan["intent"])
      valid &&= !plan.key?("recentGames") || (plan["recentGames"].is_a?(Integer) && (1..82).cover?(plan["recentGames"]))
      valid &&= plan.key?("dateFrom") == plan.key?("dateTo")
      if plan.key?("dateFrom")
        begin
          dates = %w[dateFrom dateTo].map { |key| value = plan[key]; raise ArgumentError unless value.is_a?(String) && value.match?(/\A\d{4}-\d{2}-\d{2}\z/); Date.iso8601(value) }
          valid &&= dates.first <= dates.last
        rescue ArgumentError, TypeError
          valid = false
        end
      end
      if plan.key?("intent")
        valid &&= ids == [] && plan["stat"] == "PTS" && !plan.key?("threshold") && plan["direction"] == "desc" &&
          plan["aggregation"] == (plan["intent"] == "team_record" ? "count" : "games")
      end
      if plan.key?("threshold")
        condition = plan["threshold"]
        valid &&= condition.is_a?(Hash) && condition.length == 2 && condition.key?("operator") && condition.key?("value") && OPERATORS.include?(condition["operator"])
        value = condition.is_a?(Hash) && condition["value"]
        valid &&= (value.is_a?(Integer) || value.is_a?(Float)) && value.finite? && value.abs <= 1_000_000_000
      end
      return failure unless valid

      { "status" => "ok", "plan" => Marshal.load(Marshal.dump(plan)) }
    end

    def self.failure
      { "status" => "unsupported", "message" => "The requested conditions are outside the supported search plan.",
        "messageKo" => "지원하지 않는 검색 조건이 있습니다. 선수·시즌·지표와 조건을 확인하세요." }
    end
  end
end
