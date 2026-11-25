# frozen_string_literal: true

require "json"
require "digest"
require "date"
require "time"
require_relative "database"
require_relative "query_interpreter"
require_relative "query_plan"
require_relative "repository_game_scope"

module Records
  class Repository
    include RepositoryGameScope
    STAT_KEYS = Query::BOX_SCORE_STATS
    RELEASE_PATTERN = /\Ar_[a-f0-9]{24}\z/
    FILTER_KEYS = %w[season competition venue opponentId releaseId].freeze
    MAX_CACHE_BYTES = 10 * 1024 * 1024
    JOIN_GAMES = "FROM records.player_game_stats s JOIN records.games g ON g.release_id=s.release_id AND g.id=s.game_id"

    class InvalidRelease < ArgumentError
      def status = 400
      def initialize = super("Invalid record release.")
    end

    class ReleaseNotFound < StandardError
      def status = 404
      def initialize = super("The requested record release was not found.")
    end

    class Bindings
      attr_reader :values
      def initialize = @values = []
      def add(value)
        @values << value
        "$#{@values.length}"
      end
    end

    def initialize(database: nil, cache: nil, interpreter: nil)
      @database = database
      @cache = cache || Rails.cache
      @interpreter = interpreter
      # A restored database can reuse release IDs while its current pointer or
      # schema differs. Never reuse a source database's persistent cached rows.
      @database_namespace = Digest::SHA256.hexdigest(ENV.fetch("DATABASE_URL", "unconfigured"))
    end

    def catalog(release_id: nil)
      validate_release!(release_id)
      snapshot = cached(["catalog", release_id || "current"], expires_in: release_id ? 86_400 : 60) do
        value = load_catalog(release_id)
        raise ReleaseNotFound if release_id && value["releaseId"] != release_id
        value
      end
      if release_id.nil? && snapshot["releaseId"]
        @cache.write(cache_key(["catalog", snapshot["releaseId"]]), snapshot, expires_in: 86_400)
      end
      snapshot
    end

    def scope(kind:, id: nil, season: nil, competition: nil, venue: nil, opponent_id: nil, offset: 0, limit: 200, release_id: nil)
      kind = kind.to_s
      raise ArgumentError, "Unsupported record scope." unless %w[game player season].include?(kind)
      snapshot = catalog(release_id: release_id)
      return snapshot unless snapshot["releaseId"]

      filters = { "season" => season, "competition" => competition, "venue" => venue, "opponentId" => opponent_id }.compact
      filters = {} if kind == "game"
      options = filters.merge("kind" => kind, "id" => id, "offset" => bounded_integer(offset, 0, nil, 0),
                              "limit" => bounded_integer(limit, 1, 200, 200), "releaseId" => snapshot["releaseId"])
      cached(["scope", options]) { load_scope(snapshot, options) }
    end

    def index(release_id: nil)
      snapshot = catalog(release_id: release_id)
      return { "releaseId" => nil, "games" => [], "players" => [], "seasons" => [] } unless snapshot["releaseId"]
      cached(["index", snapshot["releaseId"]]) do
        games = read(<<~SQL, [snapshot["releaseId"]])
          SELECT id,date,season,competition,home_team_id,away_team_id,home_score,away_score
          FROM records.games WHERE release_id=$1 ORDER BY date DESC,id DESC
        SQL
        { "releaseId" => snapshot["releaseId"], "games" => games.map { |row| decode(row) },
          "players" => snapshot.dig("dataset", "players"), "seasons" => snapshot["availableSeasons"] }
      end
    end

    def leaderboard(filters = {}, **options)
      filters = normalize_filters(filters.merge(options))
      column = stat_column(filters.fetch("stat", "PTS"))
      snapshot = catalog(release_id: filters["releaseId"])
      return [] unless snapshot["releaseId"]

      filters = pinned_filters(filters, snapshot).merge("stat" => filters.fetch("stat", "PTS"))
      cached(["leaderboard", filters]) do
        binds = Bindings.new
        conditions = base_stats(snapshot, filters, binds)
        read(<<~SQL, binds.values)
          SELECT s.player_id AS "playerId",count(*)::integer AS games,count(#{column})::integer AS known,
            CASE WHEN count(*)=count(#{column}) THEN sum(#{column})::double precision ELSE NULL END AS value
          #{JOIN_GAMES} WHERE #{conditions.join(' AND ')}
          GROUP BY s.player_id ORDER BY value DESC NULLS LAST,s.player_id
        SQL
      end
    end

    def comparison(filters = {}, **options)
      filters = normalize_filters(filters.merge(options))
      player_ids = Array(filters["playerIds"])
      return [] if player_ids.empty? || player_ids.length > 20
      snapshot = catalog(release_id: filters["releaseId"])
      return [] unless snapshot["releaseId"]

      player_ids = player_ids.uniq.sort
      filters = pinned_filters(filters, snapshot).merge("playerIds" => player_ids)
      cached(["comparison", filters]) do
        binds = Bindings.new
        conditions = base_stats(snapshot, filters, binds, player_ids: player_ids)
        values = STAT_KEYS.map { |stat| "'#{stat}',CASE WHEN count(*)=count(#{stat_column(stat)}) THEN avg(#{stat_column(stat)})::double precision ELSE NULL END" }
        known = STAT_KEYS.map { |stat| "'#{stat}',count(#{stat_column(stat)})::integer" }
        read(<<~SQL, binds.values)
          SELECT s.player_id AS "playerId",count(*)::integer AS games,
            jsonb_build_object(#{values.join(',')}) AS values,jsonb_build_object(#{known.join(',')}) AS known
          #{JOIN_GAMES} WHERE #{conditions.join(' AND ')} GROUP BY s.player_id
        SQL
      end
    end

    def query(text, release_id: nil, allow_remote: false)
      snapshot = catalog(release_id: release_id)
      parsed = (@interpreter ||= QueryInterpreter.new(cache: @cache)).parse(text, snapshot["dataset"],
        release_id: snapshot["releaseId"], allow_remote: allow_remote)
      unless parsed["status"] == "ok"
        return parsed.merge(empty_query).merge("releaseId" => snapshot["releaseId"])
      end
      query_result(snapshot, parsed.fetch("plan")).merge("interpreter" => parsed["interpreter"])
    end

    # Callers must authenticate a plan token before using this entry point.
    # Validation remains necessary even for signed data, and pins the catalog.
    def execute_plan(plan, release_id:)
      validate_release!(release_id)
      raise InvalidRelease unless release_id
      query_result(catalog(release_id: release_id), plan)
    end

    private

    def query_result(snapshot, plan)
      parsed = QueryPlan.validate(plan, snapshot["dataset"])
      unless parsed["status"] == "ok"
        return parsed.merge(empty_query).merge("releaseId" => snapshot["releaseId"])
      end
      unless snapshot["releaseId"]
        return empty_query.merge("status" => "empty", "plan" => parsed["plan"], "releaseId" => nil)
      end

      cached(["query", QueryPlan::VERSION, snapshot["releaseId"], parsed["plan"]]) do
        plan = parsed.fetch("plan")
        result = if scoped_game_query?(plan)
          scoped_query_result(snapshot, plan)
        else
          plan["stat"] == "BOX_SCORE" ? load_box_score_query(snapshot, plan) : load_query(snapshot, plan)
        end
        result.merge("releaseId" => snapshot["releaseId"])
      end
    end

    def read(sql, binds = [])
      (@database ||= Database.default).read(sql, binds)
    end

    def empty_dataset
      { "version" => 1, "teams" => [], "players" => [], "games" => [], "playerStats" => [], "teamStats" => [], "coverage" => [], "sources" => [] }
    end

    def empty_snapshot
      { "status" => "empty", "dataset" => empty_dataset, "releaseId" => nil, "availableSeasons" => [], "totalGames" => 0, "dalPlayerIds" => [] }
    end

    def empty_query
      { "rows" => [], "summaries" => [], "total" => 0, "coverage" => [], "incomplete" => true }
    end

    def validate_release!(release_id)
      raise InvalidRelease unless release_id.nil? || (release_id.is_a?(String) && RELEASE_PATTERN.match?(release_id))
    end

    def camelize(key) = key.to_s.gsub(/_([a-z])/) { Regexp.last_match(1).upcase }

    def decode(row)
      result = row.each_with_object({}) do |(key, value), decoded|
        next if key == "release_id"
        value = value.iso8601 if value.is_a?(Date) && !value.is_a?(DateTime)
        value = value.utc.iso8601(3) if value.is_a?(Time)
        value = Time.parse(value).utc.iso8601(3) if %w[retrieved_at tipoff_utc].include?(key) && value.is_a?(String)
        decoded[camelize(key)] = value
      end
      metadata = result.delete("metadata")
      metadata&.each { |key, value| result[key] = value unless result.key?(key) }
      result
    end

    def stat_row(row, basic: false)
      result = decode(row)
      result["values"] = STAT_KEYS.to_h do |stat|
        result.delete(camelize(stat.downcase))
        [stat, row[stat.downcase]]
      end
      result.delete("advanced") if basic
      result
    end

    def stat_column(stat, prefix = "s")
      raise ArgumentError, "Unsupported statistic." unless STAT_KEYS.include?(stat)
      "#{prefix}.#{stat.downcase}"
    end

    def bounded_integer(value, minimum, maximum, fallback)
      numeric = Float(value)
      return fallback unless numeric.finite?
      integer = [numeric.to_i, minimum].max
      maximum ? [integer, maximum].min : integer
    rescue ArgumentError, TypeError
      fallback
    end

    def normalize_filters(filters)
      filters.each_with_object({}) { |(key, value), result| result[camelize(key)] = value unless value.nil? }
    end

    def pinned_filters(filters, snapshot)
      filters.select { |key, _| FILTER_KEYS.include?(key) }.merge("releaseId" => snapshot["releaseId"])
    end

    def canonical(value)
      case value
      when Hash then value.sort.to_h.transform_values { |item| canonical(item) }
      when Array then value.map { |item| canonical(item) }
      else value
      end
    end

    def cache_key(parts)
      "mavs:records:ruby:v2:#{@database_namespace}:#{Digest::SHA256.hexdigest(JSON.generate(canonical(parts)))}"
    end

    def cached(parts, expires_in: 86_400)
      uncached = nil
      result = @cache.fetch(cache_key(parts), expires_in: expires_in, skip_nil: true) do
        value = yield
        if (value.is_a?(Hash) && value.key?("releaseId") && value["releaseId"].nil?) || JSON.generate(value).bytesize > MAX_CACHE_BYTES
          uncached = value
          nil
        else
          value
        end
      end
      Marshal.load(Marshal.dump(result || uncached))
    end

    def load_catalog(release_id)
      binds = Bindings.new
      selection = release_id ? "SELECT id,counts FROM records.releases WHERE id=#{binds.add(release_id)}" :
        "SELECT r.id,r.counts FROM records.current_release c JOIN records.releases r ON r.id=c.release_id WHERE c.singleton=true"
      rows = read(<<~SQL, binds.values)
        WITH selected_release AS (#{selection})
        SELECT r.id,r.counts,
          COALESCE((SELECT jsonb_agg(t ORDER BY t.abbreviation) FROM
            (SELECT id,abbreviation,name,name_ko,aliases FROM records.teams WHERE release_id=r.id) t),'[]'::jsonb) AS teams,
          COALESCE((SELECT jsonb_agg(p ORDER BY p.name) FROM
            (SELECT p.id,p.name,p.name_ko,p.aliases FROM records.players p WHERE p.release_id=r.id
              AND EXISTS (SELECT 1 FROM records.player_game_stats s JOIN records.teams t ON t.release_id=s.release_id AND t.id=s.team_id
                WHERE s.release_id=p.release_id AND s.player_id=p.id AND t.abbreviation='DAL')) p),'[]'::jsonb) AS players,
          COALESCE((SELECT jsonb_agg(s ORDER BY s.id) FROM records.sources s WHERE s.release_id=r.id),'[]'::jsonb) AS sources,
          COALESCE((SELECT jsonb_agg(c ORDER BY c.season,c.competition,c.dataset) FROM records.coverage c WHERE c.release_id=r.id AND c.field='all'),'[]'::jsonb) AS coverage,
          COALESCE((SELECT jsonb_agg(s.season ORDER BY s.season DESC) FROM
            (SELECT DISTINCT season FROM records.games WHERE release_id=r.id) s),'[]'::jsonb) AS seasons
        FROM selected_release r
      SQL
      return empty_snapshot if rows.empty?
      release = rows.first
      { "status" => "ready", "releaseId" => release["id"], "totalGames" => release.dig("counts", "games"),
        "totalPlayerStatRows" => release.dig("counts", "playerStats"), "availableSeasons" => release["seasons"],
        "dalPlayerIds" => release["players"].map { |row| row["id"] },
        "dataset" => empty_dataset.merge("teams" => release["teams"].map { |row| decode(row) },
          "players" => release["players"].map { |row| decode(row) }, "sources" => release["sources"].map { |row| decode(row) },
          "coverage" => release["coverage"].map { |row| decode(row) }) }
    end

    def dal_id(snapshot)
      snapshot.dig("dataset", "teams").find { |team| team["abbreviation"] == "DAL" }&.fetch("id")
    end

    def game_filters(filters, dal, binds, team_expression: "s.team_id")
      conditions = []
      conditions << "g.season=#{binds.add(filters['season'])}" if filters.key?("season")
      conditions << "g.competition=#{binds.add(filters['competition'])}" if filters["competition"]
      if filters["opponentId"]
        conditions << "CASE WHEN g.home_team_id=#{binds.add(dal)} THEN g.away_team_id ELSE g.home_team_id END=#{binds.add(filters['opponentId'])}"
      end
      case filters["venue"]
      when "neutral" then conditions << "g.neutral=true"
      when "home" then conditions << "g.neutral=false AND g.home_team_id=#{team_expression}"
      when "away" then conditions << "g.neutral=false AND g.away_team_id=#{team_expression}"
      end
      conditions
    end

    def base_stats(snapshot, filters, binds, player_ids: [], participation: "played")
      conditions = ["s.release_id=#{binds.add(snapshot['releaseId'])}", "s.team_id=#{binds.add(dal_id(snapshot))}", "g.status='final'"]
      if scoped_game_query?(filters)
        selected = scoped_games_sql(snapshot, filters, binds)
        conditions << "g.id IN (SELECT chosen.id FROM (#{selected}) chosen)"
      end
      conditions << "s.participation=#{binds.add(participation)}" if participation
      conditions.concat(game_filters(filters, dal_id(snapshot), binds))
      conditions << "s.player_id IN (#{player_ids.map { |id| binds.add(id) }.join(',')})" unless player_ids.empty?
      conditions
    end

    def load_scope(snapshot, options)
      dal = dal_id(snapshot)
      return empty_snapshot unless dal
      binds = Bindings.new
      release = binds.add(snapshot["releaseId"])
      conditions = ["g.release_id=#{release}"]
      kind = options["kind"]
      if kind == "game"
        conditions << "g.id=#{binds.add(options['id'] || '')}"
      else
        team = options["venue"] && %w[home away].include?(options["venue"]) ? binds.add(dal) : "s.team_id"
        conditions.concat(game_filters(options, dal, binds, team_expression: team))
      end
      if kind == "player"
        conditions << "EXISTS (SELECT 1 FROM records.player_game_stats s WHERE s.release_id=g.release_id AND s.game_id=g.id AND s.player_id=#{binds.add(options['id'] || '')} AND s.team_id=#{binds.add(dal)})"
      end
      details = ""
      unless kind == "season"
        player_filter = kind == "player" ? "p.id=#{binds.add(options['id'] || '')}" :
          "EXISTS (SELECT 1 FROM records.player_game_stats s WHERE s.release_id=p.release_id AND s.player_id=p.id AND s.game_id IN (SELECT id FROM selected_games))"
        stats_filter = kind == "player" ? "AND s.player_id=#{binds.add(options['id'] || '')} AND s.team_id=#{binds.add(dal)}" : ""
        stats_projection = kind == "player" ? "to_jsonb(s)-'advanced'" : "to_jsonb(s)"
        details = <<~SQL
          ,COALESCE((SELECT jsonb_agg(p ORDER BY p.name) FROM records.players p WHERE p.release_id=#{release} AND #{player_filter}),'[]'::jsonb) AS players,
          COALESCE((SELECT jsonb_agg(#{stats_projection}) FROM records.player_game_stats s WHERE s.release_id=#{release}
            AND s.game_id IN (SELECT id FROM selected_games) #{stats_filter}),'[]'::jsonb) AS player_stats
        SQL
        if kind == "game"
          details += ",COALESCE((SELECT jsonb_agg(s) FROM records.team_game_stats s WHERE s.release_id=#{release} AND s.game_id IN (SELECT id FROM selected_games)),'[]'::jsonb) AS team_stats"
        end
      end
      limit = binds.add(options["limit"])
      offset = binds.add(options["offset"])
      result = read(<<~SQL, binds.values).first
        WITH matched_games AS MATERIALIZED (SELECT g.* FROM records.games g WHERE #{conditions.join(' AND ')}),
          selected_games AS (SELECT * FROM matched_games ORDER BY date DESC,id DESC LIMIT #{limit} OFFSET #{offset})
        SELECT (SELECT count(*)::integer FROM matched_games) AS total,
          COALESCE((SELECT jsonb_agg(g ORDER BY g.date DESC,g.id DESC) FROM selected_games g),'[]'::jsonb) AS games
          #{details}
      SQL
      return snapshot.merge("status" => "empty", "scopeTotal" => result["total"]) if result["games"].empty?
      dataset = snapshot["dataset"].merge("games" => result["games"].map { |row| decode(row) })
      if kind == "player"
        dataset["players"] = dataset["players"].map { |player| player["id"] == options["id"] && !result["players"].empty? ? decode(result["players"].first) : player }
        dataset["playerStats"] = result["player_stats"].map { |row| stat_row(row, basic: true) }
      elsif kind == "game"
        players = dataset["players"].to_h { |player| [player["id"], player] }
        result["players"].each { |player| players[player["id"]] = decode(player) }
        dataset["players"] = players.values
        dataset["playerStats"] = result["player_stats"].map { |row| stat_row(row) }
        dataset["teamStats"] = result["team_stats"].map { |row| stat_row(row) }
      end
      snapshot.merge("scopeTotal" => result["total"], "dataset" => dataset)
    end

    def load_box_score_query(snapshot, plan)
      binds = Bindings.new
      player_ids = plan.fetch("playerIds")
      eligible = base_stats(snapshot, plan, binds, player_ids: player_ids, participation: nil)
      values = STAT_KEYS.map do |stat|
        column = stat_column(stat, "p")
        "'#{stat}',CASE WHEN count(*)=count(#{column}) THEN avg(#{column})::double precision ELSE NULL END"
      end
      known = STAT_KEYS.map { |stat| "'#{stat}',count(#{stat_column(stat, 'p')})::integer" }
      missing = STAT_KEYS.map { |stat| "'#{stat}',(count(*)-count(#{stat_column(stat, 'p')}))::integer" }
      percentages = Query::SHOOTING_PAIRS.map do |stat, (made, attempted)|
        numerator, denominator = stat_column(made, "p"), stat_column(attempted, "p")
        "'#{stat}',CASE WHEN count(*)=count(#{numerator}) AND count(*)=count(#{denominator}) AND sum(#{denominator})>0 " \
          "THEN sum(#{numerator})::double precision/sum(#{denominator}) ELSE NULL END"
      end
      release = binds.add(snapshot["releaseId"])
      competition = binds.add(plan["competition"])
      coverage_season = plan.key?("season") ? "AND c.season=#{binds.add(plan['season'])}" : ""
      unknown_venue = "0::integer"
      if plan["venue"]
        venue_filters = base_stats(snapshot, plan.except("venue"), binds, player_ids: player_ids, participation: nil)
        unknown_venue = "(SELECT count(*)::integer #{JOIN_GAMES} WHERE #{venue_filters.join(' AND ')} AND s.participation IN ('played','unknown') AND g.neutral IS NULL)"
      end
      # Aggregate the complete matching scope in SQL. The plan's visible row
      # limit never truncates a season or changes an average's denominator.
      result = read(<<~SQL, binds.values).first
        WITH eligible_profile_stats AS MATERIALIZED (
          SELECT s.* #{JOIN_GAMES} WHERE #{eligible.join(' AND ')}
        ), played_profile_stats AS (SELECT * FROM eligible_profile_stats WHERE participation='played')
        SELECT count(DISTINCT p.game_id)::integer AS games,
          jsonb_build_object(#{values.join(',')}) AS values,
          jsonb_build_object(#{known.join(',')}) AS known,
          jsonb_build_object(#{missing.join(',')}) AS missing,
          jsonb_build_object(#{percentages.join(',')}) AS percentages,
          COALESCE((SELECT jsonb_agg(c) FROM records.coverage c WHERE c.release_id=#{release} AND c.competition=#{competition}
            AND c.field IN ('all',#{STAT_KEYS.map { |stat| "'#{stat}'" }.join(',')}) #{coverage_season}),'[]'::jsonb) AS coverage,
          (SELECT count(*)::integer FROM eligible_profile_stats WHERE participation='unknown') AS unknown,
          #{unknown_venue} AS unknown_venue
        FROM played_profile_stats p
      SQL
      coverage = result["coverage"].map { |row| decode(row) }
      complete = Query.box_score_coverage_complete?(plan, coverage) && result["unknown"].zero? && result["unknown_venue"].zero?
      player_id = player_ids.first
      player = snapshot.dig("dataset", "players").find { |row| row["id"] == player_id }
      summary = { "playerId" => player_id, "label" => player&.fetch("name", nil) || player_id, "games" => result["games"],
        "values" => result["values"], "known" => result["known"], "missing" => result["missing"], "percentages" => result["percentages"] }
      response = { "status" => result["games"].positive? ? "ready" : "empty", "plan" => plan, "rows" => [], "summaries" => result["games"].positive? ? [summary] : [],
        "total" => result["games"], "coverage" => coverage, "incomplete" => !complete || result["missing"].values.any?(&:positive?) }
      if result["games"].zero?
        unknown = result["unknown_venue"].positive?
        response.merge!("message" => unknown ? "Unknown neutral-court status prevents confirming the requested venue condition." : "No matching verified records are loaded.",
          "messageKo" => unknown ? "중립 여부를 확인하지 못해 홈·원정 조건으로 확정할 수 없습니다." : "현재 적재된 검증 기록에서 일치하는 결과가 없습니다.")
      end
      response
    end

    def load_query(snapshot, plan)
      binds = Bindings.new
      player_ids = plan.fetch("playerIds", [])
      eligible = base_stats(snapshot, plan, binds, player_ids: player_ids, participation: nil)
      column = stat_column(plan["stat"], "f")
      threshold = ""
      if plan["threshold"]
        operator = { "gte" => ">=", "gt" => ">", "lte" => "<=", "lt" => "<", "eq" => "=" }.fetch(plan["threshold"]["operator"])
        threshold = "WHERE #{stat_column(plan['stat'], 'b')} #{operator} #{binds.add(plan['threshold']['value'])}"
      end
      release = binds.add(snapshot["releaseId"])
      competition = binds.add(plan["competition"])
      stat = binds.add(plan["stat"])
      coverage_season = plan.key?("season") ? "AND c.season=#{binds.add(plan['season'])}" : ""
      unknown_venue = "0::integer"
      if plan["venue"]
        venue_filters = base_stats(snapshot, plan.reject { |key, _| key == "venue" }, binds, player_ids: player_ids)
        unknown_venue = "(SELECT count(*)::integer #{JOIN_GAMES} WHERE #{venue_filters.join(' AND ')} AND g.neutral IS NULL)"
      end
      compare = plan["aggregation"] == "compare"
      group = compare ? "f.player_id" : "NULL::text"
      direction = plan["direction"] == "asc" ? "ASC" : "DESC"
      limit = binds.add(bounded_integer(plan["limit"], 1, 200, 50))
      result = read(<<~SQL, binds.values).first
        WITH eligible_stats AS MATERIALIZED (
          SELECT s.*,g.date,g.tipoff_utc,g.season,g.competition,g.neutral,g.home_team_id,g.away_team_id
          #{JOIN_GAMES} WHERE #{eligible.join(' AND ')}
        ), base_stats AS (SELECT * FROM eligible_stats WHERE participation='played'),
        filtered_stats AS (SELECT b.* FROM base_stats b #{threshold}),
        selected_rows AS (
          SELECT f.*,p.name AS player_name,p.name_ko AS player_name_ko FROM filtered_stats f
          JOIN records.players p ON p.release_id=f.release_id AND p.id=f.player_id
          ORDER BY #{column} #{direction} NULLS LAST,f.date,f.player_id LIMIT #{limit}
        ), aggregates AS (
          SELECT #{group} AS player_id,count(*)::integer AS total,count(DISTINCT f.game_id)::integer AS games,
            count(*) FILTER(WHERE #{column} IS NULL)::integer AS missing,
            sum(#{column})::double precision AS sum,avg(#{column})::double precision AS average
          FROM filtered_stats f #{compare ? 'GROUP BY f.player_id' : ''}
        )
        SELECT COALESCE((SELECT jsonb_agg(c) FROM records.coverage c WHERE c.release_id=#{release} AND c.competition=#{competition}
            AND (c.field='all' OR c.field=#{stat}) #{coverage_season}),'[]'::jsonb) AS coverage,
          COALESCE((SELECT jsonb_agg(r ORDER BY #{stat_column(plan['stat'], 'r')} #{direction} NULLS LAST,r.date,r.player_id) FROM selected_rows r),'[]'::jsonb) AS rows,
          COALESCE((SELECT jsonb_agg(a) FROM aggregates a),'[]'::jsonb) AS aggregates,
          (SELECT count(*)::integer FROM base_stats WHERE #{plan['stat'].downcase} IS NULL) AS missing,
          (SELECT count(*)::integer FROM eligible_stats WHERE participation='unknown') AS unknown,
          #{unknown_venue} AS unknown_venue
      SQL
      coverage = result["coverage"].map { |row| decode(row) }
      complete = plan.key?("season") && coverage.any? { |row| row["dataset"] == "games" && row["status"] == "complete" && row["field"] == "all" } &&
        coverage.any? { |row| row["dataset"] == "playerStats" && row["status"] == "complete" && [plan["stat"], "all"].include?(row["field"]) } &&
        result["unknown"].zero? && result["unknown_venue"].zero?
      groups = plan["aggregation"] == "games" ? [] : compare ? player_ids : [nil]
      summaries = groups.map do |player_id|
        item = result["aggregates"].find { |row| row["player_id"] == player_id } || { "games" => 0, "missing" => 0, "sum" => nil, "average" => nil }
        value = if plan["aggregation"] == "count"
          complete && result["missing"].zero? ? item["games"] : nil
        elsif item["missing"].positive?
          nil
        else
          item[plan["aggregation"] == "sum" ? "sum" : "average"]
        end
        player = snapshot.dig("dataset", "players").find { |row| row["id"] == player_id }
        { "playerId" => player_id, "label" => player_id ? player&.fetch("name", nil) || player_id : plan["aggregation"],
          "games" => item["games"], "missing" => item["missing"], "value" => value }
      end
      rows = result["rows"].map do |row|
        mapped = stat_row(row)
        home = mapped["homeTeamId"] == mapped["teamId"]
        { "gameId" => mapped["gameId"], "date" => mapped["date"], "tipoffUtc" => mapped["tipoffUtc"], "season" => mapped["season"], "competition" => mapped["competition"],
          "playerId" => mapped["playerId"], "playerName" => mapped["playerName"], "playerNameKo" => mapped["playerNameKo"],
          "teamId" => mapped["teamId"], "opponentId" => mapped[home ? "awayTeamId" : "homeTeamId"],
          "venue" => mapped["neutral"].nil? ? "unknown" : mapped["neutral"] ? "neutral" : home ? "home" : "away", "values" => mapped["values"] }
      end
      total = result["aggregates"].sum { |row| row["total"] }
      response = { "status" => total.positive? ? "ready" : "empty", "plan" => plan, "rows" => rows, "summaries" => summaries,
        "total" => total, "coverage" => coverage, "incomplete" => !complete || result["missing"].positive? }
      if total.zero? && result["unknown_venue"].positive?
        response.merge!("message" => "Unknown neutral-court status prevents confirming the requested venue condition.",
                        "messageKo" => "중립 여부를 확인하지 못해 홈·원정 조건으로 확정할 수 없습니다.")
      end
      response
    end
  end
end
