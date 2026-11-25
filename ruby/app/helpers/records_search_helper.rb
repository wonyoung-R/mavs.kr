# frozen_string_literal: true

module RecordsSearchHelper
  SEARCH_METRICS = {
    "BOX_SCORE" => ["주요 기록 전체", "Full box score"],
    "PTS" => ["득점", "Points"], "REB" => ["리바운드", "Rebounds"],
    "AST" => ["어시스트", "Assists"], "STL" => ["스틸", "Steals"],
    "BLK" => ["블록", "Blocks"], "TOV" => ["턴오버", "Turnovers"],
    "PF" => ["파울", "Fouls"], "OREB" => ["공격 리바운드", "Offensive rebounds"],
    "DREB" => ["수비 리바운드", "Defensive rebounds"], "FGM" => ["야투 성공", "Field goals made"],
    "FGA" => ["야투 시도", "Field goals attempted"], "FG3M" => ["3점슛 성공", "Three-pointers made"],
    "FG3A" => ["3점슛 시도", "Three-pointers attempted"], "FTM" => ["자유투 성공", "Free throws made"],
    "FTA" => ["자유투 시도", "Free throws attempted"], "PLUS_MINUS" => ["플러스마이너스", "Plus/minus"],
    "MIN_SECONDS" => ["출전시간", "Minutes played"]
  }.freeze
  SEARCH_AGGREGATIONS = {
    "games" => ["경기별 기록", "Game logs"], "average" => ["평균", "Average"],
    "sum" => ["합계", "Total"], "count" => ["경기 수", "Game count"],
    "compare" => ["평균 비교", "Compare averages"]
  }.freeze
  SEARCH_OPERATORS = { "gte" => "≥", "gt" => ">", "lte" => "≤", "lt" => "<", "eq" => "=" }.freeze

  def search_failure?(result)
    result.is_a?(Hash) && !%w[ready empty].include?(result["status"])
  end

  def search_natural_examples
    [
      t2("노비츠키가 2010-11 플레이오프에서 30점 넘게 넣은 경기", "Games where Dirk scored over 30 points in the 2010-11 playoffs"),
      t2("루카의 2023-24 평균 어시스트", "Luka's average assists in 2023-24"),
      t2("노비츠키와 루카의 댈러스 통산 평균 득점 비교", "Compare Dirk and Luka's career scoring averages with Dallas")
    ].map { |query| { "label" => query, "query" => query } }
  end

  # These links deliberately retain the established, rules-only GET grammar.
  def search_basic_examples
    [
      t2("2010-11 플레이오프 득점", "2010-11 playoffs points"),
      t2("매버릭스 30득점 이상 경기", "Mavericks games with at least 30 points"),
      t2("2024 평균 리바운드", "2024 average rebounds")
    ]
  end

  def search_retry_choices(result)
    choices = Array(result["choices"]).filter_map do |choice|
      next unless choice.is_a?(Hash)
      query = choice["query"]
      next unless query.is_a?(String) && query.present? && query.encode("UTF-16LE").bytesize / 2 <= 500

      label = t2(choice["labelKo"], choice["labelEn"])
      { "query" => query, "label" => label.is_a?(String) && label.present? ? label : query }
    end.uniq { |choice| choice["query"] }.first(3)
    choices.presence || search_natural_examples
  end

  def search_failure_title(result)
    case result["status"]
    when "ambiguous" then t2("어떤 조건을 원하시나요?", "Which conditions did you mean?")
    when "unavailable" then t2("자연어 해석을 잠시 사용할 수 없습니다", "Natural-language search is temporarily unavailable")
    else t2("질문을 조금 바꿔 주세요", "Try rephrasing your question")
    end
  end

  def search_result_message(result)
    t2(result["messageKo"].presence || result["message"], result["message"].presence || result["messageKo"])
  end

  def search_metric_label(stat)
    labels = SEARCH_METRICS[stat]
    labels ? t2(*labels) : stat.to_s
  end

  # Presentation only: the validated plan remains the sole query definition.
  # MIN_SECONDS thresholds use a duration without changing the repository's
  # seconds, and other thresholds retain their precision for confirmation.
  def search_condition_chips(plan)
    return [] unless plan.is_a?(Hash)

    players = Array(plan["playerIds"]).map { |id| player_name(id) }
    team_query = %w[team_games team_record].include?(plan["intent"])
    chips = [
      [t2("기록 범위", "Scope"), team_query ? t2("댈러스 완료 경기", "Completed Dallas games") : t2("댈러스 소속 출전", "Dallas appearances")],
      [t2("선수", "Players"), players.any? ? players.join(" · ") : t2("DAL 선수 전체", "All DAL players")],
      [t2("시즌", "Season"), season_label(plan["season"])],
      [t2("유형", "Competition"), competition_label(plan["competition"] || "regular")],
      [t2("지표", "Statistic"), search_metric_label(plan["stat"])]
    ]
    if team_query
      chips.reject! { |label, _| [t2("선수", "Players"), t2("지표", "Statistic")].include?(label) }
    end
    if plan["recentGames"]
      chips << [t2("경기 선택", "Game selection"), t2("댈러스 최근 완료 #{plan['recentGames']}경기", "Last #{plan['recentGames']} completed Dallas games")]
    end
    if plan["dateFrom"] || plan["dateTo"]
      chips << [t2("경기 시작일 (한국시간)", "Tipoff date (Korea time)"), "#{plan['dateFrom'] || '…'} ~ #{plan['dateTo'] || '…'}"]
    end
    threshold = plan["threshold"]
    if threshold.is_a?(Hash) && threshold["value"].is_a?(Numeric) && (operator = SEARCH_OPERATORS[threshold["operator"]])
      value = search_threshold_value(threshold["value"], plan["stat"])
      chips << [t2("조건", "Condition"), "#{search_metric_label(plan['stat'])} #{operator} #{value}"]
    end
    aggregation = case plan["intent"]
      when "team_games" then ["경기 결과", "Game results"]
      when "team_record" then ["팀 승패", "Team record"]
      else SEARCH_AGGREGATIONS[plan["aggregation"]]
      end
    chips << [t2("집계", "Aggregation"), aggregation ? t2(*aggregation) : plan["aggregation"].to_s]
    unless plan["stat"] == "BOX_SCORE" || team_query
      chips << [t2("정렬", "Order"), plan["direction"] == "asc" ? t2("낮은 순", "Lowest first") : t2("높은 순", "Highest first")]
      chips << [t2("표시", "Display"), t2("최대 #{fmt(plan.fetch('limit', 50))}행", "Up to #{fmt(plan.fetch('limit', 50))} rows")]
    end
    if team_query
      chips << [t2("정렬", "Order"), t2("최근 경기순", "Latest games first")]
      chips << [t2("표시", "Display"), t2("최대 #{fmt(plan.fetch('limit', 50))}경기", "Up to #{fmt(plan.fetch('limit', 50))} games")]
    end
    if plan["venue"].present?
      venue = { "home" => ["홈", "Home"], "away" => ["원정", "Away"], "neutral" => ["중립", "Neutral"] }[plan["venue"]]
      chips << [t2("장소", "Venue"), venue ? t2(*venue) : plan["venue"].to_s]
    end
    chips << [t2("상대", "Opponent"), team_name(plan["opponentId"])] if plan["opponentId"].present?
    positions = Array(plan["position"]).compact
    if positions.any?
      labels = positions.map do |position|
        name = { "G" => ["가드", "Guard"], "F" => ["포워드", "Forward"], "C" => ["센터", "Center"] }[position]
        name ? "#{position} · #{t2(*name)}" : position.to_s
      end
      chips << [t2("포지션", "Position"), labels.join(" / ")]
    end
    chips
  end

  def search_game_date(game)
    return game["date"] unless game["tipoffUtc"].present?

    Time.iso8601(game["tipoffUtc"]).getlocal("+09:00").strftime("%Y-%m-%d")
  rescue ArgumentError
    game["date"]
  end

  def search_participation_label(participation)
    labels = { "played" => ["출전", "Played"], "dnp" => ["미출전 (DNP)", "Did not play (DNP)"],
      "inactive" => ["비활성", "Inactive"], "unknown" => ["출전 여부 미확인", "Participation unknown"] }
    t2(*labels.fetch(participation, labels["unknown"]))
  end

  def search_threshold_value(value, stat)
    if stat == "MIN_SECONDS"
      minutes, seconds = BigDecimal(value.to_s).divmod(60)
      t2("#{search_exact_number(minutes)}분 #{search_exact_number(seconds)}초", "#{search_exact_number(minutes)}m #{search_exact_number(seconds)}s")
    else
      search_exact_number(value)
    end
  end

  def search_exact_number(value)
    number_with_delimiter(value == value.to_i ? value.to_i : value)
  end
end
