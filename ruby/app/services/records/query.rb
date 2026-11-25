# frozen_string_literal: true

module Records
  # Deterministic Korean/English query parser and reference evaluator. JSON keys
  # intentionally match the existing records API, including omitted optionals.
  class Query
    BOX_SCORE_STATS = %w[PTS REB AST STL BLK TOV PF FGM FGA FG3M FG3A FTM FTA OREB DREB PLUS_MINUS MIN_SECONDS].freeze
    SHOOTING_PAIRS = { "FG_PCT" => %w[FGM FGA], "FG3_PCT" => %w[FG3M FG3A], "FT_PCT" => %w[FTM FTA] }.freeze
    METRICS = {
      "PTS" => ["points", "point", "pts", "득점", "점"],
      "REB" => ["rebounds", "rebound", "reb", "리바운드"],
      "AST" => ["assists", "assist", "ast", "어시스트"],
      "STL" => ["steals", "steal", "stl", "스틸"],
      "BLK" => ["blocks", "block", "blk", "블록"],
      "TOV" => ["turnovers", "turnover", "tov", "턴오버"],
      "FG3M" => ["threes", "three pointers", "3pm", "3점슛"],
      "MIN_SECONDS" => ["minutes", "min", "출전시간"],
      "PLUS_MINUS" => ["plus minus", "plus_minus", "플러스마이너스"]
    }.freeze
    VENUES = [["home", "홈"], ["away", "원정"], ["neutral", "중립"]].freeze
    # JavaScript's word boundary is ASCII; Ruby's \b includes Korean letters.
    SEASONS = /(?<![a-z0-9_])(19[0-9]{2}|20[0-9]{2})(?:\s*[-–\/]\s*([0-9]{2}|20[0-9]{2}))?(?![a-z0-9_])/
    THRESHOLDS = [
      [/([0-9]+(?:\.[0-9]+)?)\s*(?:이상|or more|\+)/, "gte"],
      [/at least\s*([0-9]+(?:\.[0-9]+)?)/, "gte"],
      [/([0-9]+(?:\.[0-9]+)?)\s*(?:초과)/, "gt"],
      [/over\s*([0-9]+(?:\.[0-9]+)?)/, "gt"],
      [/([0-9]+(?:\.[0-9]+)?)\s*(?:이하|or fewer)/, "lte"],
      [/under\s*([0-9]+(?:\.[0-9]+)?)/, "lt"],
      [/([0-9]+(?:\.[0-9]+)?)\s*미만/, "lt"],
      [/(?:exactly|정확히)\s*([0-9]+(?:\.[0-9]+)?)/, "eq"]
    ].freeze
    FILLER = /(?<![a-z0-9_])(?:the|a|an|in|for|of|with|and|vs|versus|against|show|games?|season|stats?|statistics|mavericks|mavs|dallas)(?![a-z0-9_])|매버릭스|댈러스|시즌|기록|경기|보여줘|알려줘|상대로|상대|에서|은|는|의|이|가|을|를|와|과|[?,.!:]/

    class << self
      def parse(query, dataset)
        if utf16_length(query) > 500 || query.match?(/\A[[:space:]\uFEFF]*\z/)
          return failure("unsupported", "Enter a question of 1–500 characters.", "1–500자의 질문을 입력하세요.")
        end

        rest = query.downcase.unicode_normalize(:nfkc)
        original = rest.dup
        mention_order = {}
        player_ids = []
        names = {}
        dataset.fetch("players", []).each do |player|
          [player["name"], player["nameKo"], *player.fetch("aliases", [])].each do |name|
            next if name.nil? || name.empty?

            key = name.downcase.unicode_normalize(:nfkc)
            names[key] ||= []
            names[key] << player["id"] unless names[key].include?(player["id"])
          end
        end
        names.each_with_index.sort_by { |(name, _ids), index| [-utf16_length(name), index] }.each do |(name, ids), _index|
          pattern = boundary(name, digits: true)
          next unless rest.match?(pattern)
          if ids.length > 1
            return failure("ambiguous", "Specify the full player name: #{name}", "동명이인입니다. 전체 선수 이름으로 지정하세요: #{name}")
          end
          position = original.match(pattern)&.begin(0) || original.length
          ids.each { |id| mention_order[id] = [mention_order.fetch(id, Float::INFINITY), position].min }
          player_ids.concat(ids)
          rest = rest.gsub(pattern, " ")
        end

        seasons = rest.scan(SEASONS)
        return failure("ambiguous", "Use one season per question.", "질문당 시즌 하나를 지정하세요.") if seasons.length > 1
        season = seasons.first&.first&.to_i
        ending = seasons.first&.last
        if ending && ending.to_i != (ending.length == 2 ? (season + 1) % 100 : season + 1)
          return failure("unsupported", "Use a season such as 2010-11, not a date range.", "2010-11처럼 시즌을 지정하세요. 날짜 범위는 지원하지 않습니다.")
        end
        rest = rest.gsub(SEASONS, " ")
        playoff = rest.match?(/playoffs?|플레이오프/)
        regular = rest.match?(/regular\s*season|정규시즌/)
        if playoff && regular
          return failure("ambiguous", "Choose regular season or playoffs.", "정규시즌과 플레이오프 중 하나를 지정하세요.")
        end
        competition = playoff ? "playoffs" : "regular"
        rest = rest.gsub(/playoffs?|플레이오프|regular\s*season|정규시즌/, " ")
        matched_venues = VENUES.select { |aliases| aliases.any? { |name| rest.match?(boundary(name)) } }
        if matched_venues.length > 1
          return failure("ambiguous", "Choose one venue.", "홈·원정·중립 중 하나를 지정하세요.")
        end
        venue = matched_venues.first&.first
        VENUES.flatten.each { |name| rest = rest.gsub(boundary(name), " ") }

        opponent_id = nil
        dataset.fetch("teams", []).each do |team|
          aliases = [team["name"], team["nameKo"], team["abbreviation"], *team.fetch("aliases", [])].compact.reject(&:empty?)
          aliases.each_with_index.sort_by { |name, index| [-utf16_length(name), index] }.each do |name, _index|
            pattern = boundary(name.downcase, digits: true)
            next unless rest.match?(pattern)
            unless team["abbreviation"] == "DAL"
              if opponent_id && opponent_id != team["id"]
                return failure("ambiguous", "Choose one opponent.", "상대 팀 하나를 지정하세요.")
              end
              opponent_id = team["id"]
            end
            rest = rest.gsub(pattern, " ")
          end
        end

        selected = []
        # Match 3점슛 before 점, and longer English phrases before short aliases.
        METRICS.flat_map { |key, aliases| aliases.map { |name| [key, name] } }
          .sort_by { |_key, name| -utf16_length(name) }.each do |key, name|
          pattern = boundary(name)
          next unless rest.match?(pattern)
          selected << key
          rest = rest.gsub(pattern, " ")
        end
        if selected.uniq.length > 1
          return failure("unsupported", "Choose one statistic per question.", "질문당 지표 하나를 지정하세요.")
        end
        stat = selected.first || "PTS"
        threshold = nil
        THRESHOLDS.each do |pattern, operator|
          match = rest.match(pattern)
          next unless match
          return failure("unsupported", "Use one threshold.", "조건값 하나를 지정하세요.") if threshold

          value = match[1].to_f * (stat == "MIN_SECONDS" ? 60 : 1)
          value = value.to_i if value.finite? && value == value.to_i
          threshold = { "operator" => operator, "value" => value }
          rest = rest.sub(pattern, " ")
        end
        requested_average = rest.match?(/average|평균/)
        explicit_profile = original.match?(/평균\s*(?:기록|스탯|성적)|\baverage\s+(?:stats?|statistics)\b/)
        if explicit_profile && threshold
          return failure("unsupported", "A full average profile cannot also use a numeric threshold. Specify one statistic for a filtered average.", "전체 평균 기록에는 숫자 조건을 함께 적용할 수 없습니다. 조건부 평균은 지표 하나를 지정하세요.")
        end
        aggregation = if rest.match?(/compare|비교/)
          "compare"
        elsif rest.match?(/average|평균/)
          "average"
        elsif rest.match?(/total|sum|합계|총합/)
          "sum"
        elsif rest.match?(/how many|count|몇\s*경기|경기\s*수/)
          "count"
        else
          "games"
        end
        stat = "BOX_SCORE" if selected.empty? && requested_average
        rest = rest.gsub(/compare|비교|average|평균|total|sum|합계|총합|how many|count|몇\s*경기|경기\s*수/, " ")
        explicit_order = rest.match?(/lowest|least|오름차순|최저|highest|most|내림차순|최고|최다|(?:top|상위)\s*[0-9]+/)
        direction = rest.match?(/lowest|least|오름차순|최저/) ? "asc" : "desc"
        rest = rest.gsub(/lowest|least|오름차순|최저|highest|most|내림차순|최고|최다/, " ")
        limit = 50
        rest = rest.gsub(/(?:top|상위)\s*([0-9]+)/) do
          limit = [[Regexp.last_match(1).to_i, 1].max, 200].min
          " "
        end
        rest = rest.gsub(FILLER, " ")
        unless rest.gsub(/[[:space:]\uFEFF]/, "").empty?
          return failure("unsupported", "Some conditions could not be understood. Use a player, season and statistic.", "해석하지 못한 조건이 있습니다. 선수·시즌·지표 중심으로 입력하세요.")
        end
        if aggregation == "compare" && player_ids.uniq.length != 2
          return failure("ambiguous", "Name exactly two players to compare.", "비교할 선수 두 명을 지정하세요.")
        end
        if (stat == "BOX_SCORE" || explicit_profile) && explicit_order
          return failure("unsupported", "An average profile covers every matching appearance. Specify one statistic for a top-N or ordered search.", "전체 평균 기록에는 상위 경기·정렬 조건을 적용할 수 없습니다. 정렬하려면 지표 하나를 지정하세요.")
        end
        if stat == "BOX_SCORE"
          unless aggregation == "average" && threshold.nil?
            return failure("unsupported", "An average profile cannot use a threshold or comparison. Specify one statistic for these conditions.", "전체 평균 기록에는 조건값·비교를 적용할 수 없습니다. 해당 검색은 지표 하나를 지정하세요.")
          end
          unless player_ids.uniq.length == 1
            return failure("ambiguous", "Name one player for an average box-score profile.", "전체 평균 기록을 조회할 선수 한 명을 지정하세요.")
          end
        end
        plan = {
          "playerIds" => player_ids.uniq.sort_by { |id| [mention_order[id], id] },
          "season" => season, "competition" => competition, "venue" => venue,
          "opponentId" => opponent_id, "stat" => stat, "threshold" => threshold,
          "aggregation" => aggregation, "direction" => direction, "limit" => limit
        }.compact
        { "status" => "ok", "plan" => plan }
      end

      def execute(query, dataset)
        parsed = parse(query, dataset)
        unless parsed["status"] == "ok"
          return parsed.merge("rows" => [], "summaries" => [], "total" => 0, "coverage" => [], "incomplete" => true)
        end
        plan = parsed["plan"]
        return execute_box_score(plan, dataset) if plan["stat"] == "BOX_SCORE"
        dal = dataset.fetch("teams", []).find { |team| team["abbreviation"] == "DAL" }
        coverage = dataset.fetch("coverage", []).select do |row|
          (!plan.key?("season") || row["season"] == plan["season"]) && row["competition"] == plan["competition"]
        end
        complete = plan.key?("season") &&
          coverage.any? { |row| row["dataset"] == "games" && row["status"] == "complete" && row["field"] == "all" } &&
          coverage.any? { |row| row["dataset"] == "playerStats" && row["status"] == "complete" && [plan["stat"], "all"].include?(row["field"]) }
        games = dataset.fetch("games", []).to_h { |game| [game["id"], game] }
        players = dataset.fetch("players", []).to_h { |player| [player["id"], player] }
        stats = dataset.fetch("playerStats", [])
        if stats.any? { |row| row["participation"] == "unknown" && matching_appearance?(row, games[row["gameId"]], dal, plan) }
          complete = false
        end
        rows = stats.filter_map do |row|
          game = games[row["gameId"]]
          player = players[row["playerId"]]
          next unless player && row["participation"] == "played" && matching_appearance?(row, game, dal, plan)

          venue = game["neutral"].nil? ? "unknown" : game["neutral"] ? "neutral" : game["homeTeamId"] == row["teamId"] ? "home" : "away"
          opponent_id = game["homeTeamId"] == row["teamId"] ? game["awayTeamId"] : game["homeTeamId"]
          complete = false if plan["venue"] && game["neutral"].nil?
          next if (plan["venue"] && plan["venue"] != venue) || (plan["opponentId"] && plan["opponentId"] != opponent_id)

          { "gameId" => game["id"], "date" => game["date"], "season" => game["season"], "competition" => game["competition"],
            "playerId" => player["id"], "playerName" => player["name"], "playerNameKo" => player["nameKo"],
            "teamId" => row["teamId"], "opponentId" => opponent_id, "venue" => venue, "values" => row["values"] }
        end
        missing = rows.count { |row| row["values"][plan["stat"]].nil? }
        if plan["threshold"]
          threshold = plan["threshold"]
          rows = rows.select { |row| threshold_match?(row["values"][plan["stat"]], threshold) }
        end
        rows = rows.each_with_index.sort do |(a, ai), (b, bi)|
          comparison = compare_rows(a, b, plan)
          comparison.zero? ? ai <=> bi : comparison
        end.map(&:first)
        groups = plan["aggregation"] == "compare" ? plan["playerIds"] : [nil]
        summaries = if plan["aggregation"] == "games"
          []
        else
          groups.map do |player_id|
            selected = player_id ? rows.select { |row| row["playerId"] == player_id } : rows
            known = selected.map { |row| row["values"][plan["stat"]] }.compact
            group_missing = selected.length - known.length
            game_count = selected.map { |row| row["gameId"] }.uniq.length
            value = if plan["aggregation"] == "count"
              complete && missing.zero? ? game_count : nil
            elsif group_missing.positive? || known.empty?
              nil
            elsif ["average", "compare"].include?(plan["aggregation"])
              known.sum.fdiv(known.length)
            else
              known.sum
            end
            name = player_id && players.dig(player_id, "name")
            { "playerId" => player_id, "label" => player_id ? (name.nil? || name.empty? ? player_id : name) : plan["aggregation"],
              "value" => value, "games" => game_count, "missing" => group_missing }
          end
        end
        result = { "status" => rows.empty? ? "empty" : "ready", "plan" => plan, "rows" => rows.first(plan["limit"]),
          "summaries" => summaries, "total" => rows.length, "coverage" => coverage, "incomplete" => !complete || missing.positive? }
        if rows.empty?
          result["message"] = "No matching verified records are loaded."
          result["messageKo"] = "현재 적재된 검증 기록에서 일치하는 결과가 없습니다."
        end
        result
      end

      def box_score_coverage_complete?(plan, coverage)
        return false unless plan.key?("season")
        scoped = coverage.select { |row| row["season"] == plan["season"] && row["competition"] == plan["competition"] }
        games_complete = scoped.any? { |row| row["dataset"] == "games" && row["field"] == "all" && row["status"] == "complete" }
        fields_complete = BOX_SCORE_STATS.all? do |stat|
          scoped.any? { |row| row["dataset"] == "playerStats" && ["all", stat].include?(row["field"]) && row["status"] == "complete" }
        end
        games_complete && fields_complete
      end

      private

      def execute_box_score(plan, dataset)
        dal = dataset.fetch("teams", []).find { |team| team["abbreviation"] == "DAL" }
        games = dataset.fetch("games", []).to_h { |game| [game["id"], game] }
        eligible = dataset.fetch("playerStats", []).select do |row|
          game = games[row["gameId"]]
          next false unless matching_appearance?(row, game, dal, plan)
          opponent = game["homeTeamId"] == row["teamId"] ? game["awayTeamId"] : game["homeTeamId"]
          !plan["opponentId"] || opponent == plan["opponentId"]
        end
        unknown_venue = plan["venue"] && eligible.any? do |row|
          %w[played unknown].include?(row["participation"]) && games[row["gameId"]]["neutral"].nil?
        end
        if plan["venue"]
          eligible = eligible.select do |row|
            game = games[row["gameId"]]
            venue = game["neutral"].nil? ? "unknown" : game["neutral"] ? "neutral" : game["homeTeamId"] == row["teamId"] ? "home" : "away"
            venue == plan["venue"]
          end
        end
        unknown = eligible.any? { |row| row["participation"] == "unknown" }
        rows = eligible.select { |row| row["participation"] == "played" }
        values, known, missing, sums = {}, {}, {}, {}
        BOX_SCORE_STATS.each do |stat|
          numbers = rows.map { |row| row["values"][stat] }.compact
          known[stat], missing[stat], sums[stat] = numbers.length, rows.length - numbers.length, numbers.sum
          values[stat] = !numbers.empty? && missing[stat].zero? ? sums[stat].fdiv(numbers.length) : nil
        end
        percentages = SHOOTING_PAIRS.to_h do |stat, (made, attempted)|
          value = if missing[made].zero? && missing[attempted].zero? && sums[attempted].positive?
            sums[made].fdiv(sums[attempted])
          end
          [stat, value]
        end
        coverage = dataset.fetch("coverage", []).select do |row|
          (!plan.key?("season") || row["season"] == plan["season"]) && row["competition"] == plan["competition"] &&
            (row["field"] == "all" || BOX_SCORE_STATS.include?(row["field"]))
        end
        player_id = plan["playerIds"].first
        player = dataset.fetch("players", []).find { |row| row["id"] == player_id }
        total = rows.map { |row| row["gameId"] }.uniq.length
        summary = { "playerId" => player_id, "label" => player&.fetch("name", nil) || player_id, "games" => total,
          "values" => values, "known" => known, "missing" => missing, "percentages" => percentages }
        response = { "status" => total.positive? ? "ready" : "empty", "plan" => plan, "rows" => [], "summaries" => total.positive? ? [summary] : [],
          "total" => total, "coverage" => coverage,
          "incomplete" => !box_score_coverage_complete?(plan, coverage) || unknown || !!unknown_venue || missing.values.any?(&:positive?) }
        if total.zero?
          response.merge!("message" => unknown_venue ? "Unknown neutral-court status prevents confirming the requested venue condition." : "No matching verified records are loaded.",
            "messageKo" => unknown_venue ? "중립 여부를 확인하지 못해 홈·원정 조건으로 확정할 수 없습니다." : "현재 적재된 검증 기록에서 일치하는 결과가 없습니다.")
        end
        response
      end

      def utf16_length(value)
        value.encode(Encoding::UTF_16LE).bytesize / 2
      end

      def boundary(value, digits: false)
        characters = digits ? "a-z0-9" : "a-z"
        Regexp.new("(?<![#{characters}])#{Regexp.escape(value)}(?![#{characters}])")
      end

      def failure(status, message, korean)
        { "status" => status, "message" => message, "messageKo" => korean }
      end

      def matching_appearance?(row, game, dal, plan)
        game && dal && row["teamId"] == dal["id"] && game["status"] == "final" &&
          game["competition"] == plan["competition"] &&
          (!plan.key?("season") || game["season"] == plan["season"]) &&
          (plan["playerIds"].empty? || plan["playerIds"].include?(row["playerId"]))
      end

      def threshold_match?(value, threshold)
        return false if value.nil?
        case threshold["operator"]
        when "gte" then value >= threshold["value"]
        when "gt" then value > threshold["value"]
        when "lte" then value <= threshold["value"]
        when "lt" then value < threshold["value"]
        else value == threshold["value"]
        end
      end

      def compare_rows(a, b, plan)
        av = a["values"][plan["stat"]]
        bv = b["values"][plan["stat"]]
        return bv.nil? ? a["gameId"] <=> b["gameId"] : 1 if av.nil?
        return -1 if bv.nil?

        comparison = plan["direction"] == "asc" ? av <=> bv : bv <=> av
        comparison = a["date"] <=> b["date"] if comparison.zero?
        comparison.zero? ? a["playerId"] <=> b["playerId"] : comparison
      end
    end
  end
end
