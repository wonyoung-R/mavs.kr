# frozen_string_literal: true

module Records
  module RepositoryGameScope
    private

    def scoped_game_query?(plan)
      (plan.keys & %w[intent recentGames dateFrom dateTo]).any?
    end

    # Select team games before joining any player records. DNP or a missing
    # player row must never cause an older appearance to enter a recent window.
    def scoped_games_sql(snapshot, plan, binds, include_dates: true)
      dal = binds.add(dal_id(snapshot))
      conditions = ["g.release_id=#{binds.add(snapshot['releaseId'])}", "g.status='final'", "(g.home_team_id=#{dal} OR g.away_team_id=#{dal})"]
      conditions.concat(game_filters(plan.except("dateFrom", "dateTo", "recentGames"), dal_id(snapshot), binds, team_expression: dal))
      if include_dates && plan["dateFrom"]
        conditions << "(g.tipoff_utc AT TIME ZONE 'Asia/Seoul')::date BETWEEN #{binds.add(plan['dateFrom'])}::date AND #{binds.add(plan['dateTo'])}::date"
      end
      sql = "SELECT g.* FROM records.games g WHERE #{conditions.join(' AND ')} ORDER BY COALESCE(g.tipoff_utc,g.date::timestamp AT TIME ZONE 'UTC') DESC,g.id DESC"
      sql += " LIMIT #{binds.add(plan['recentGames'])}" if plan["recentGames"]
      sql
    end

    def uncertain_venue_condition(venue, prefix, dal)
      case venue
      when "home" then "#{prefix}.home_team_id=#{dal} AND (#{prefix}.neutral=false OR #{prefix}.neutral IS NULL)"
      when "away" then "#{prefix}.away_team_id=#{dal} AND (#{prefix}.neutral=false OR #{prefix}.neutral IS NULL)"
      when "neutral" then "(#{prefix}.neutral=true OR #{prefix}.neutral IS NULL)"
      else "true"
      end
    end

    def load_game_scope(snapshot, plan)
      binds = Repository::Bindings.new
      selected = scoped_games_sql(snapshot, plan, binds)
      dal = binds.add(dal_id(snapshot))
      # Uncertainty dimensions must be evaluated together. A missing tipoff
      # must not hide a simultaneously unknown neutral flag (or vice versa).
      date_unknown = if plan["dateFrom"]
        sql = scoped_games_sql(snapshot, plan.except("recentGames", "venue"), binds, include_dates: false)
        venue = uncertain_venue_condition(plan["venue"], "d", dal)
        "(SELECT count(*)::integer FROM (#{sql}) d WHERE d.tipoff_utc IS NULL AND #{venue})"
      else
        "0::integer"
      end
      venue_unknown = if plan["venue"]
        sql = scoped_games_sql(snapshot, plan.except("venue", "recentGames"), binds, include_dates: false)
        date = if plan["dateFrom"]
          "(v.tipoff_utc IS NULL OR (v.tipoff_utc AT TIME ZONE 'Asia/Seoul')::date BETWEEN " \
            "#{binds.add(plan['dateFrom'])}::date AND #{binds.add(plan['dateTo'])}::date)"
        else
          "true"
        end
        venue = uncertain_venue_condition(plan["venue"], "v", dal)
        "(SELECT count(*)::integer FROM (#{sql}) v WHERE v.neutral IS NULL AND #{venue} AND #{date})"
      else
        "0::integer"
      end
      row_limit = binds.add(plan["limit"])
      ids = plan["playerIds"]
      players = if ids.empty?
        "'[]'::jsonb"
      else
        "COALESCE((SELECT jsonb_agg(s) FROM records.player_game_stats s WHERE s.release_id=g.release_id AND s.game_id=g.id AND s.team_id=#{dal} AND s.player_id IN (#{ids.map { |id| binds.add(id) }.join(',')})),'[]'::jsonb)"
      end
      unknown_players = if ids.empty?
        "0::integer"
      else
        candidates = ids.map { |id| "(#{binds.add(id)}::text)" }.join(',')
        "(SELECT count(*)::integer FROM scoped_team_games g CROSS JOIN (VALUES #{candidates}) p(player_id) " \
          "LEFT JOIN records.player_game_stats s ON s.release_id=g.release_id AND s.game_id=g.id AND s.team_id=#{dal} AND s.player_id=p.player_id " \
          "WHERE s.player_id IS NULL OR s.participation='unknown')"
      end
      row = read(<<~SQL, binds.values).first
        WITH scoped_team_games AS MATERIALIZED (#{selected})
        SELECT count(*)::integer AS games,
          count(*) FILTER (WHERE (home_team_id=#{dal} AND home_score>away_score) OR (away_team_id=#{dal} AND away_score>home_score))::integer AS wins,
          count(*) FILTER (WHERE (home_team_id=#{dal} AND home_score<away_score) OR (away_team_id=#{dal} AND away_score<home_score))::integer AS losses,
          #{date_unknown} AS unknown_dates,
          #{venue_unknown} AS unknown_venues,
          #{unknown_players} AS unknown_players,
          COALESCE((SELECT jsonb_agg(r ORDER BY r.sort_time DESC,r.id DESC) FROM
            (SELECT g.*,COALESCE(g.tipoff_utc,g.date::timestamp AT TIME ZONE 'UTC') AS sort_time,#{players} AS player_stats
             FROM scoped_team_games g ORDER BY sort_time DESC,g.id DESC LIMIT #{row_limit}) r),'[]'::jsonb) AS game_rows
        FROM scoped_team_games
      SQL
      games = row.fetch("game_rows").map do |raw|
        game = decode(raw)
        home = game["homeTeamId"] == dal_id(snapshot)
        own, opposing = game.values_at(home ? "homeScore" : "awayScore", home ? "awayScore" : "homeScore")
        stats = game.delete("playerStats") || []
        stats = ids.map do |id|
          source = stats.find { |stat| stat["player_id"] == id }
          source ? stat_row(source) : { "playerId" => id, "participation" => "unknown", "values" => Repository::STAT_KEYS.to_h { |key| [key, nil] } }
        end
        { "gameId" => game["id"], "date" => game["date"], "tipoffUtc" => game["tipoffUtc"], "season" => game["season"],
          "homeTeamId" => game["homeTeamId"], "awayTeamId" => game["awayTeamId"], "homeScore" => game["homeScore"], "awayScore" => game["awayScore"],
          "outcome" => own.nil? || opposing.nil? || own == opposing ? nil : own > opposing ? "W" : "L", "playerStats" => stats }
      end
      { "gameRows" => games, "teamSummary" => row.slice("games", "wins", "losses").merge("unknown" => row["games"] - row["wins"] - row["losses"]),
        "unknownDateGames" => row["unknown_dates"], "unknownVenueGames" => row.fetch("unknown_venues", 0), "unknownPlayerGames" => row.fetch("unknown_players", 0) }
    end

    def scoped_query_result(snapshot, plan)
      scope = load_game_scope(snapshot, plan)
      if plan["intent"]
        coverage = snapshot.dig("dataset", "coverage").select { |item| item["competition"] == plan["competition"] && (!plan["season"] || item["season"] == plan["season"]) }
        complete = plan["season"] && coverage.any? { |item| item["dataset"] == "games" && item["field"] == "all" && item["status"] == "complete" }
        result = { "status" => scope.dig("teamSummary", "games").positive? ? "ready" : "empty", "plan" => plan, "rows" => [], "summaries" => [],
          "total" => scope.dig("teamSummary", "games"), "coverage" => coverage, "incomplete" => !complete || scope.dig("teamSummary", "unknown").positive? }
      else
        result = plan["stat"] == "BOX_SCORE" ? load_box_score_query(snapshot, plan) : load_query(snapshot, plan)
      end
      result.merge!(scope)
      result["incomplete"] ||= scope["unknownDateGames"].positive? || scope["unknownVenueGames"].positive? || scope["unknownPlayerGames"].positive? || scope["gameRows"].any? do |game|
        game["playerStats"].any? { |stat| stat["participation"] == "unknown" }
      end
      if result["status"] == "empty"
        result.merge!("message" => "No matching verified records are loaded; this does not confirm that no game took place.",
          "messageKo" => "현재 적재된 검증 기록에 일치하는 결과가 없습니다. 실제 무경기 또는 미수집 여부는 확인되지 않았습니다.")
      end
      result
    end
  end
end
