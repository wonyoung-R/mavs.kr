# frozen_string_literal: true

require "date"
require_relative "query"
require_relative "query_plan"

module Records
  # An exact, local grammar for scope words. Every remaining condition still
  # passes the established strict player parser; no model call is needed.
  class GameQuery
    TRIGGER = /최근|지난\s*경기|마지막\s*경기|\b(?:last|latest|recent)\b|오늘|어제|\b(?:today|yesterday)\b|\d{4}-\d{2}-\d{2}|올\s*시즌|이번\s*시즌|this\s+season|승패|몇\s*승|몇\s*패|\bwins?\b|\blosses\b|\bresults?\b|경기\s*결과/i

    def self.parse(text, dataset, today:, normalize: nil)
      return unless text.match?(TRIGGER)
      return QueryPlan.failure if text.match?(/```|[;{}]|\b(?:sql|select|drop|insert|delete|execute|ignore|except|without)\b|제외|빼고|출전\s*(?:한\s*)?(?:최근|지난)|최근.{0,10}출전/i)
      return QueryPlan.failure if text.match?(/평균|\baverage\b/) && text.match?(/합계|총합|\b(?:sum|total)\b/)
      scope = {}
      rest = text.dup
      current = /올\s*시즌|이번\s*시즌|this\s+season/
      rest = rest.gsub(current) { " #{today.month >= 10 ? today.year : today.year - 1} 시즌 " }
      if normalize
        dates = {}
        protected = rest.gsub(/\d{4}-\d{2}-\d{2}/) do |date|
          token = "protecteddate#{('a'.ord + dates.length).chr}token"
          dates[token] = date
          token
        end
        normalized = normalize.call(protected)
        if normalized.is_a?(Hash)
          normalized.fetch("choices", []).each do |choice|
            dates.each { |token, date| choice["query"] = choice["query"].gsub(token, date) }
          end
          return normalized
        end
        rest = dates.reduce(normalized) { |value, (token, date)| value.gsub(token, date) }
      end
      recent_patterns = [/(?:최근|last|latest|recent)\s*(\d+|두|한)\s*(?:경기|games?)/, /(?:지난|마지막)\s*경기|\b(?:last|latest)\s+game\b/]
      recent_patterns.each do |pattern|
        rest = rest.gsub(pattern) do
          return QueryPlan.failure if scope.key?("recentGames")
          token = Regexp.last_match(1) if Regexp.last_match.captures.any?
          scope["recentGames"] = { "두" => 2, "한" => 1 }.fetch(token, token ? token.to_i : 1)
          " "
        end
      end
      # Bare '최근 경기' has an explicit service default of two completed games.
      rest = rest.gsub(/최근\s*경기|\brecent\s+games\b/) do
        return QueryPlan.failure if scope.key?("recentGames")
        scope["recentGames"] = 2
        " "
      end
      rest = rest.gsub(/오늘|어제|\btoday\b|\byesterday\b/) do |word|
        return QueryPlan.failure if scope.key?("dateFrom")
        date = today - (%w[어제 yesterday].include?(word) ? 1 : 0)
        scope.merge!("dateFrom" => date.iso8601, "dateTo" => date.iso8601)
        " "
      end
      dates = rest.scan(/\d{4}-\d{2}-\d{2}/)
      unless dates.empty?
        return QueryPlan.failure if scope.key?("dateFrom") || dates.length > 2
        pattern = dates.length == 2 ? /#{Regexp.escape(dates[0])}\s*(?:부터|~|–|to|through)\s*#{Regexp.escape(dates[1])}(?:\s*까지)?/ : /#{Regexp.escape(dates[0])}/
        return QueryPlan.failure unless rest.match?(pattern)
        scope.merge!("dateFrom" => dates.first, "dateTo" => dates.last)
        rest = rest.sub(pattern, " ")
      end
      record = rest.match?(/승패|몇\s*승|몇\s*패|\bwins?\b|\blosses\b/)
      return QueryPlan.failure if record && rest.match?(/득점|리바운드|어시스트|평균|합계|points?|rebounds?|assists?|average|sum|compare|비교/)
      result = rest.match?(/결과|\bresults?\b/)
      rest = rest.gsub(/승패|몇\s*승(?:\s*몇\s*패)?(?:야|인가요)?|몇\s*패(?:야|인가요)?|\b(?:wins?|losses|results?|record)\b|결과/, " ")
      rest = rest.gsub(/(?:보여|알려)\s*(?:주세요|줘)|어떻게\s*돼|어떻게\s*됐어|몇이야|이야|인가요|\b(?:tell\s+me|show\s+me|what\s+are|how\s+many)\b/, " ")
      parsed = Query.parse(rest.strip.empty? ? "경기" : rest, dataset)
      return parsed unless parsed["status"] == "ok"
      plan = parsed["plan"].merge(scope)
      if plan["playerIds"].empty? && (record || result || ((scope.any? || text.match?(current)) && !rest.match?(/득점|리바운드|어시스트|평균|합계|points?|rebounds?|assists?|average|sum|compare|비교/)))
        return QueryPlan.failure if plan.key?("threshold") || plan["stat"] != "PTS" || !%w[games count].include?(plan["aggregation"]) || plan["direction"] != "desc"
        plan.merge!("intent" => record ? "team_record" : "team_games", "aggregation" => record ? "count" : "games")
      elsif record || result || (plan["playerIds"].empty? && %w[average sum compare].include?(plan["aggregation"]))
        return QueryPlan.failure
      end
      QueryPlan.validate(plan, dataset, today: today)
    end
  end
end
