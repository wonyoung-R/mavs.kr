# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../app/services/records/repository"
require_relative "../../app/services/records/query"

class RecordsRepositoryTest < ActiveSupport::TestCase
  RELEASE = "r_0123456789abcdef01234567"

  class FakeDatabase
    attr_reader :calls
    attr_accessor :catalog_rows, :scope_rows, :query_rows, :profile_rows, :leaderboard_rows, :comparison_rows, :failure, :game_query_rows

    def initialize
      @calls = []
      @catalog_rows = []
      @scope_rows = []
      @query_rows = []
      @profile_rows = []
      @leaderboard_rows = []
      @comparison_rows = []
    end

    def read(sql, binds = [])
      @calls << [sql, binds.dup]
      if @failure
        failure, @failure = @failure, nil
        raise failure
      end
      case sql
      when /WITH scoped_team_games/ then @game_query_rows
      when /WITH selected_release/ then @catalog_rows
      when /WITH matched_games/ then @scope_rows
      when /WITH eligible_profile_stats/ then @profile_rows
      when /WITH eligible_stats/ then @query_rows
      when /jsonb_build_object/ then @comparison_rows
      when /AS known/ then @leaderboard_rows
      when /SELECT id,date,season/ then @scope_rows.first.fetch("games")
      else raise "Unexpected fixture query"
      end
    end
  end

  setup do
    @database = FakeDatabase.new
    @cache = ActiveSupport::Cache::MemoryStore.new
    @repository = Records::Repository.new(database: @database, cache: @cache)
    @coverage = %w[games playerStats].map do |dataset|
      { "season" => 2010, "competition" => "regular", "dataset" => dataset, "field" => "all", "expected" => 1,
        "observed" => 1, "status" => "complete", "evidence" => "Synthetic fixture" }
    end
    @database.catalog_rows = [{ "id" => RELEASE, "counts" => { "games" => 1, "playerStats" => 1 }, "seasons" => [2010],
      "teams" => [{ "id" => "dal", "abbreviation" => "DAL", "name" => "Dallas", "name_ko" => "댈러스", "aliases" => [] },
        { "id" => "nyk", "abbreviation" => "NYK", "name" => "New York", "name_ko" => "뉴욕", "aliases" => [] }],
      "players" => [{ "id" => "dirk", "name" => "Dirk Nowitzki", "name_ko" => "노비츠키", "aliases" => ["dirk"] },
        { "id" => "luka", "name" => "Luka Doncic", "name_ko" => "돈치치", "aliases" => ["luka"] }],
      "sources" => [{ "id" => "fixture", "retrieved_at" => "2026-01-01T00:00:00+00:00" }], "coverage" => @coverage }]
    @game = { "id" => "g1", "date" => "2010-11-01", "season" => 2010, "competition" => "regular", "home_team_id" => "dal",
      "away_team_id" => "nyk", "neutral" => nil, "home_score" => 100, "away_score" => 90, "status" => "final",
      "tipoff_utc" => "2010-11-02T01:00:00+00:00", "metadata" => { "arenaName" => "American Airlines Center" } }
    @stat = { "game_id" => "g1", "team_id" => "dal", "player_id" => "dirk", "participation" => "played", "pts" => 0,
      "reb" => nil, "starter" => true, "starter_position" => "F", "advanced" => { "offensiveRating" => 110 } }
    @database.scope_rows = [{ "total" => 1, "games" => [@game], "players" => [{ "id" => "dirk", "name" => "Dirk Nowitzki",
      "metadata" => { "birthdate" => "1978-06-19" } }], "player_stats" => [@stat], "team_stats" => [] }]
    @database.query_rows = [{ "coverage" => @coverage, "rows" => [@stat.merge(@game.reject { |key, _| key == "id" })
      .merge("player_name" => "Dirk Nowitzki", "player_name_ko" => "노비츠키")],
      "aggregates" => [{ "player_id" => nil, "total" => 1, "games" => 1, "missing" => 0, "sum" => 0, "average" => 0 }],
      "missing" => 0, "unknown" => 0, "unknown_venue" => 0 }]
    @database.profile_rows = [{ "games" => 60, "values" => Records::Query::BOX_SCORE_STATS.to_h { |stat| [stat, 0.0] }.merge("PTS" => 30.5),
      "known" => Records::Query::BOX_SCORE_STATS.to_h { |stat| [stat, 60] },
      "missing" => Records::Query::BOX_SCORE_STATS.to_h { |stat| [stat, 0] },
      "percentages" => { "FG_PCT" => 0.1, "FG3_PCT" => nil, "FT_PCT" => 0.0 },
      "coverage" => @coverage, "unknown" => 0, "unknown_venue" => 0 }]
  end

  test "catalog is one read, normalizes JSON timestamps, and pins its cached release" do
    snapshot = @repository.catalog
    assert_equal 1, @database.calls.length
    assert_equal RELEASE, snapshot["releaseId"]
    assert_equal [2010], snapshot["availableSeasons"]
    assert_equal "2026-01-01T00:00:00.000Z", snapshot.dig("dataset", "sources", 0, "retrievedAt")
    snapshot["dataset"]["players"].clear
    pinned = @repository.catalog(release_id: RELEASE)
    assert_equal 2, pinned.dig("dataset", "players").length
    assert_equal 1, @database.calls.length
  end

  test "malformed releases fail before any database read" do
    error = assert_raises(Records::Repository::InvalidRelease) { @repository.catalog(release_id: "current';--") }
    assert_equal 400, error.status
    assert_empty @database.calls
  end

  test "shared cache isolates database connections including identical pinned release IDs" do
    original_url = ENV["DATABASE_URL"]
    ENV["DATABASE_URL"] = "postgresql://fixture:source-secret@source.invalid/records"
    source = Records::Repository.new(database: @database, cache: @cache)
    assert_equal 1, source.catalog["totalGames"]

    target_database = FakeDatabase.new
    target_database.catalog_rows = Marshal.load(Marshal.dump(@database.catalog_rows))
    target_database.catalog_rows.first["counts"]["games"] = 2
    ENV["DATABASE_URL"] = "postgresql://fixture:target-secret@127.0.0.1:55432/records"
    target = Records::Repository.new(database: target_database, cache: @cache)
    assert_equal 2, target.catalog["totalGames"]
    assert_equal 2, target.catalog(release_id: RELEASE)["totalGames"]
    assert_equal 1, target_database.calls.length
    assert_equal 1, source.catalog(release_id: RELEASE)["totalGames"]

    same_target_database = FakeDatabase.new
    same_target = Records::Repository.new(database: same_target_database, cache: @cache)
    assert_equal 2, same_target.catalog["totalGames"]
    assert_empty same_target_database.calls
    key = target.send(:cache_key, ["catalog", "current"])
    assert_match(/\Amavs:records:ruby:v2:[a-f0-9]{64}:[a-f0-9]{64}\z/, key)
    refute_includes key, "target-secret"
    refute_includes key, "127.0.0.1"
  ensure
    original_url.nil? ? ENV.delete("DATABASE_URL") : ENV["DATABASE_URL"] = original_url
  end

  test "missing pinned releases do not fall back or cache an error" do
    @database.catalog_rows = []
    2.times { assert_raises(Records::Repository::ReleaseNotFound) { @repository.catalog(release_id: RELEASE) } }
    assert_equal 2, @database.calls.length
    assert @database.calls.all? { |sql, binds| !sql.include?("records.current_release") && binds == [RELEASE] }
  end

  test "game scope preserves zero null DNP starter position metadata and advanced values" do
    @database.scope_rows.first["player_stats"] << @stat.merge("player_id" => "luka", "participation" => "dnp", "pts" => nil, "starter" => false)
    result = @repository.scope(kind: "game", id: "g1", season: 1999, venue: "home")
    played, dnp = result.dig("dataset", "playerStats")
    assert_equal 0, played.dig("values", "PTS")
    assert_nil played.dig("values", "REB")
    assert_equal "F", played["starterPosition"]
    assert_equal({ "offensiveRating" => 110 }, played["advanced"])
    assert_equal "dnp", dnp["participation"]
    assert_nil dnp.dig("values", "PTS")
    assert_equal "1978-06-19", result.dig("dataset", "players", 0, "birthdate")
    assert_equal "2010-11-02T01:00:00.000Z", result.dig("dataset", "games", 0, "tipoffUtc")
    assert_equal "American Airlines Center", result.dig("dataset", "games", 0, "arenaName")
    assert_equal 2, @database.calls.length
    refute_includes @database.calls.last.last, 1999
  end

  test "season reads no box score tables" do
    result = @repository.scope(kind: "season", season: 2010)
    assert_equal 1, result["scopeTotal"]
    assert_empty result.dig("dataset", "playerStats")
    refute_includes @database.calls.last.first, "records.player_game_stats"
    assert_equal 2, @database.calls.length
  end

  test "player scope caps and binds pagination and hostile identifiers" do
    hostile = "x'); DROP SCHEMA public;--"
    result = @repository.scope(kind: "player", id: hostile, opponent_id: "nyk", limit: 99_999, offset: -10)
    sql, binds = @database.calls.last
    refute_includes sql, hostile
    assert_includes binds, hostile
    assert_includes binds, 200
    assert_includes binds, 0
    refute_includes binds, 99_999
    refute result.dig("dataset", "playerStats", 0).key?("advanced")
    assert_equal "F", result.dig("dataset", "playerStats", 0, "starterPosition")
  end

  test "empty pages retain matched count and no unrelated game rows" do
    @database.scope_rows = [{ "total" => 501, "games" => [], "players" => [], "player_stats" => [] }]
    result = @repository.scope(kind: "player", id: "dirk", offset: 1000)
    assert_equal "empty", result["status"]
    assert_equal 501, result["scopeTotal"]
    assert_empty result.dig("dataset", "games")
  end

  test "failed reads are retried and never cached" do
    @database.failure = Records::Database::Unavailable.new
    assert_raises(Records::Database::Unavailable) { @repository.catalog }
    assert_equal "ready", @repository.catalog["status"]
    assert_equal 2, @database.calls.length
  end

  test "index returns all ledger rows separately from paginated scopes" do
    result = @repository.index
    assert_equal RELEASE, result["releaseId"]
    assert_equal ["g1"], result["games"].map { |game| game["id"] }
    assert_equal [2010], result["seasons"]
    refute_includes @database.calls.last.first, "LIMIT"
    @repository.index
    assert_equal 2, @database.calls.length
  end

  test "queries preserve a real zero and distinguish unknown venue" do
    result = @repository.query("dirk 2010 regular season sum points")
    assert_equal 0, result.dig("summaries", 0, "value")
    assert_equal "unknown", result.dig("rows", 0, "venue")
    assert_equal false, result["incomplete"]
    assert_equal RELEASE, result["releaseId"]
    assert_equal 2, @database.calls.length
  end

  test "average profiles use one bounded aggregate SQL response across all matching games" do
    result = @repository.query("dirk 2010 regular season average stats")
    assert_equal "ready", result["status"]
    assert_equal "BOX_SCORE", result.dig("plan", "stat")
    assert_equal 60, result["total"]
    assert_equal [], result["rows"]
    assert_equal "dirk", result.dig("summaries", 0, "playerId")
    assert_equal 60, result.dig("summaries", 0, "games")
    assert_equal 30.5, result.dig("summaries", 0, "values", "PTS")
    assert_equal 0.1, result.dig("summaries", 0, "percentages", "FG_PCT")
    assert_nil result.dig("summaries", 0, "percentages", "FG3_PCT")
    assert_equal 0.0, result.dig("summaries", 0, "percentages", "FT_PCT")
    assert_equal false, result["incomplete"]
    sql, binds = @database.calls.last
    assert_match "WITH eligible_profile_stats", sql
    assert_match "participation='played'", sql
    assert_match "count(DISTINCT p.game_id)", sql
    refute_match(/\bLIMIT\b/i, sql)
    Records::Query::BOX_SCORE_STATS.each do |stat|
      assert_includes sql, "CASE WHEN count(*)=count(p.#{stat.downcase}) THEN avg(p.#{stat.downcase})"
    end
    assert_includes sql, "sum(p.fgm)::double precision/sum(p.fga)"
    assert_includes sql, "sum(p.fga)>0"
    assert_includes binds, RELEASE
    assert_includes binds, "dal"
    assert_includes binds, "dirk"
    assert_includes binds, 2010
    refute_includes binds, 50
    assert_equal 2, @database.calls.length
    assert_equal result.except("interpreter"), @repository.execute_plan(result["plan"], release_id: RELEASE)
    assert_equal 2, @database.calls.length
  end

  test "profile nulls and per field known counts survive without inventing zero averages" do
    profile = @database.profile_rows.first
    profile["values"]["REB"] = nil
    profile["known"]["REB"] = 59
    profile["missing"]["REB"] = 1
    result = @repository.query("dirk 2010 average stats")
    assert_nil result.dig("summaries", 0, "values", "REB")
    assert_equal 59, result.dig("summaries", 0, "known", "REB")
    assert_equal 1, result.dig("summaries", 0, "missing", "REB")
    assert_equal true, result["incomplete"]
    assert_equal 30.5, result.dig("summaries", 0, "values", "PTS")
  end

  test "profile coverage requires every statistic and preserves unknown appearance flags" do
    @database.profile_rows.first["coverage"] = [@coverage.first, @coverage.last.merge("field" => "PTS")]
    result = @repository.query("dirk 2010 average stats")
    assert_equal true, result["incomplete"]
    @database.profile_rows.first["coverage"] = @coverage
    @database.profile_rows.first["unknown"] = 1
    @cache.clear
    assert_equal true, @repository.query("dirk 2010 average stats")["incomplete"]
  end

  test "profile opponent and venue are bound and unknown venue is not converted into a definite empty profile" do
    profile = @database.profile_rows.first
    profile["games"] = 0
    profile["values"] = profile["values"].transform_values { nil }
    profile["known"] = profile["known"].transform_values { 0 }
    profile["unknown_venue"] = 1
    result = @repository.query("dirk 2010 home against NYK average stats")
    assert_equal "empty", result["status"]
    assert_equal 0, result["total"]
    assert_equal true, result["incomplete"]
    assert_match "중립", result["messageKo"]
    assert_equal [], result["summaries"]
    sql, binds = @database.calls.last
    assert_includes binds, "nyk"
    assert_includes sql, "g.neutral=false AND g.home_team_id=s.team_id"
    assert_includes sql, "g.neutral IS NULL"
    assert_includes sql, "s.participation IN ('played','unknown')"
  end

  test "invalid broad profiles fail before an aggregate read" do
    ["average stats", "dirk luka average stats", "dirk average over 30", "dirk luka compare average stats"].each do |query|
      result = @repository.query(query)
      assert_includes %w[ambiguous unsupported], result["status"], query
      assert_empty result["rows"]
      refute result.key?("plan")
    end
    assert_equal 1, @database.calls.length
  end

  test "missing values prevent sums and verified game counts" do
    payload = @database.query_rows.first
    payload["missing"] = 1
    payload["aggregates"].first.merge!("missing" => 1, "sum" => nil, "average" => nil)
    result = @repository.query("dirk 2010 regular season sum points")
    assert_nil result.dig("summaries", 0, "value")
    assert_equal true, result["incomplete"]
    count = @repository.query("dirk 2010 regular season count points")
    assert_nil count.dig("summaries", 0, "value")
  end

  test "unknown participation makes counts incomplete despite complete source coverage" do
    @database.query_rows.first["unknown"] = 1
    result = @repository.query("dirk 2010 regular season count points")
    assert_nil result.dig("summaries", 0, "value")
    assert_equal true, result["incomplete"]
  end

  test "unknown court status returns the venue explanation and no definite count" do
    @database.query_rows.first.merge!("rows" => [], "unknown_venue" => 1)
    @database.query_rows.first["aggregates"].first.merge!("games" => 0, "total" => 0)
    result = @repository.query("dirk 2010 regular season home count points")
    assert_equal "empty", result["status"]
    assert_equal true, result["incomplete"]
    assert_nil result.dig("summaries", 0, "value")
    assert_equal "중립 여부를 확인하지 못해 홈·원정 조건으로 확정할 수 없습니다.", result["messageKo"]
  end

  test "comparison summaries keep query mention order rather than SQL order" do
    @database.query_rows.first["aggregates"] = [
      { "player_id" => "dirk", "total" => 1, "games" => 1, "missing" => 0, "average" => 10 },
      { "player_id" => "luka", "total" => 1, "games" => 1, "missing" => 0, "average" => 20 }
    ]
    result = @repository.query("luka vs dirk compare points")
    assert_equal %w[luka dirk], result["summaries"].map { |row| row["playerId"] }
    assert_equal [20, 10], result["summaries"].map { |row| row["value"] }
  end

  test "equivalent parsed questions share cached SQL results" do
    first = @repository.query("dirk 2010 regular season sum points")
    second = @repository.query("노비츠키 2010 정규시즌 합계 득점")
    assert_equal first, second
    assert_equal 2, @database.calls.length
  end

  test "statistic identifiers are allowlisted before entering SQL" do
    assert_raises(ArgumentError) { @repository.leaderboard(stat: "pts); DROP TABLE records.games;--") }
    assert_empty @database.calls
    @database.leaderboard_rows = [{ "playerId" => "dirk", "games" => 1, "known" => 1, "value" => 0 }]
    assert_equal 0, @repository.leaderboard(stat: "PTS").first["value"]
  end

  test "unsupported queries do not issue a statistics read" do
    result = @repository.query("calculate made up super score")
    assert_equal "unsupported", result["status"]
    assert_equal 1, @database.calls.length
    assert_empty result["rows"]
  end

  test "natural language remote authorization is explicit and results share validated plan cache" do
    calls = []
    parser = Object.new
    plan = Records::Query.parse("dirk 2010 points", @repository.catalog["dataset"]).fetch("plan")
    parser.define_singleton_method(:parse) do |text, dataset, release_id:, allow_remote:|
      calls << [text, dataset["players"].length, release_id, allow_remote]
      { "status" => "ok", "plan" => plan, "interpreter" => "jev" }
    end
    repository = Records::Repository.new(database: @database, cache: @cache, interpreter: parser)
    result = repository.query("natural words", allow_remote: true)
    assert_equal "ready", result["status"]
    assert_equal "jev", result["interpreter"]
    assert_equal [["natural words", 2, RELEASE, true]], calls
    signed = repository.execute_plan(plan, release_id: RELEASE)
    assert_equal result.except("interpreter"), signed
    assert_equal 2, @database.calls.length
    repository.query("GET words")
    assert_equal false, calls.last.last
    assert_equal 2, @database.calls.length
  end

  test "signed and injected interpreter plans are validated before statistics reads" do
    plan = Records::Query.parse("dirk points", @repository.catalog["dataset"]).fetch("plan")
    [plan.merge("stat" => "pts;--"), plan.merge("playerIds" => ["unknown"]), plan.merge("venue" => "unknown"),
      plan.merge("threshold" => { "operator" => "gte", "value" => "30" }), plan.merge("position" => "G")].each do |invalid|
      assert_equal "unsupported", @repository.execute_plan(invalid, release_id: RELEASE)["status"]
    end
    assert_equal 1, @database.calls.length
    assert_raises(Records::Repository::InvalidRelease) { @repository.execute_plan(plan, release_id: nil) }
    assert_raises(Records::Repository::InvalidRelease) { @repository.execute_plan(plan, release_id: "bad") }
    parser = Object.new
    parser.define_singleton_method(:parse) { |*_args, **_options| { "status" => "ok", "plan" => plan.merge("opponentId" => "unknown"), "interpreter" => "jev" } }
    repository = Records::Repository.new(database: @database, cache: @cache, interpreter: parser)
    assert_equal "unsupported", repository.query("ignored", allow_remote: true)["status"]
    assert_equal 1, @database.calls.length
  end

  test "connection URL preserves escaping while removing Prisma-only options" do
    options = Records::Database.connection_options("postgresql://test+user:p%40ss%2Bword@localhost:5433/records?schema=public&connection_limit=8&pool_timeout=10&pgbouncer=true&sslmode=require&connect_timeout=99")
    assert_equal "test+user", options[:user]
    assert_equal "p@ss+word", options[:password]
    assert_equal 5433, options[:port]
    assert_equal "records", options[:dbname]
    assert_equal "require", options[:sslmode]
    assert_equal 5, options[:connect_timeout]
    refute options.key?(:schema)
    refute options.key?(:connection_limit)
    refute options.key?(:pool_timeout)
    refute options.key?(:pgbouncer)
  end

  test "database reads are parameterized read-only transactions and redact failures" do
    commands = []
    connection = Object.new
    connection.define_singleton_method(:status) { PG::CONNECTION_OK }
    connection.define_singleton_method(:finished?) { false }
    connection.define_singleton_method(:exec) { |sql| commands << sql }
    connection.define_singleton_method(:exec_params) do |sql, values|
      commands << [sql, values]
      raise PG::Error, "sensitive connection and SQL values"
    end
    pool = Object.new
    pool.define_singleton_method(:with) { |&block| block.call(connection) }
    adapter = Records::Database.new(pool: pool)
    error = assert_raises(Records::Database::Unavailable) { adapter.read("SELECT $1", ["secret-value"]) }
    assert_equal "Records are temporarily unavailable.", error.message
    assert_nil error.cause
    assert_equal ["BEGIN READ ONLY", "SET LOCAL statement_timeout = '5000ms'", ["SELECT $1", ["secret-value"]], "ROLLBACK"], commands
  end

  test "team result scopes preserve wins losses and unknown scores with bound recent limits" do
    @database.game_query_rows = [{ "games" => 3, "wins" => 1, "losses" => 1, "unknown_dates" => 0,
      "game_rows" => [@game.merge("player_stats" => []), @game.merge("id" => "g2", "home_score" => nil, "player_stats" => [])] }]
    plan = { "playerIds" => [], "competition" => "regular", "stat" => "PTS", "aggregation" => "count", "direction" => "desc", "limit" => 5,
      "intent" => "team_record", "season" => 2010, "recentGames" => 3 }
    result = @repository.execute_plan(plan, release_id: RELEASE)
    assert_equal({ "games" => 3, "wins" => 1, "losses" => 1, "unknown" => 1 }, result["teamSummary"])
    assert_equal "W", result.dig("gameRows", 0, "outcome")
    assert_nil result.dig("gameRows", 1, "outcome")
    assert result["incomplete"]
    sql, binds = @database.calls.last
    assert_includes sql, "g.status='final'"
    assert_includes sql, "COALESCE(g.tipoff_utc"
    assert_includes binds, 3
    assert_includes binds, 5
    refute_includes sql, "records.player_game_stats"
  end

  test "KST date scopes exclude unknown tipoffs and expose date uncertainty" do
    @database.game_query_rows = [{ "games" => 0, "wins" => 0, "losses" => 0, "unknown_dates" => 2, "game_rows" => [] }]
    result = @repository.query("2010-11-02 경기 결과")
    assert_equal "empty", result["status"]
    assert_equal 2, result["unknownDateGames"]
    assert result["incomplete"]
    assert_includes result["messageKo"], "미수집"
    sql, binds = @database.calls.last
    assert_includes sql, "g.tipoff_utc AT TIME ZONE 'Asia/Seoul'"
    assert_includes sql, "d.tipoff_utc IS NULL"
    assert_equal 2, binds.count("2010-11-02")
    refute_includes sql, "2010-11-02"
  end

  test "recent player scope selects team games before player joins and retains DNP and absent rows" do
    @database.game_query_rows = [{ "games" => 2, "wins" => 1, "losses" => 1, "unknown_dates" => 0,
      "game_rows" => [@game.merge("player_stats" => [@stat.merge("participation" => "dnp", "pts" => nil)]),
        @game.merge("id" => "g2", "player_stats" => [])] }]
    result = @repository.query("노비츠키 최근 2경기 평균 득점")
    assert_equal "dnp", result.dig("gameRows", 0, "playerStats", 0, "participation")
    assert_nil result.dig("gameRows", 0, "playerStats", 0, "values", "PTS")
    assert_equal "unknown", result.dig("gameRows", 1, "playerStats", 0, "participation")
    assert result["incomplete"]
    sql, binds = @database.calls.last
    assert_includes sql, "g.id IN (SELECT chosen.id"
    team_scope = sql[/SELECT chosen.id.*?ORDER BY.*?LIMIT \$[0-9]+/m]
    refute_nil team_scope
    refute_includes team_scope, "s.player_id"
    assert_includes binds, "dirk"
    assert_includes binds, 2
  end

  test "team home and away scopes expose unknown neutral status instead of silently excluding it" do
    @database.game_query_rows = [{ "games" => 0, "wins" => 0, "losses" => 0, "unknown_dates" => 0, "unknown_venues" => 2, "game_rows" => [] }]
    result = @repository.query("2010-11 홈 최근 2경기 결과")
    assert_equal "empty", result["status"]
    assert_equal 2, result["unknownVenueGames"]
    assert result["incomplete"]
    sql, = @database.calls.last
    assert_includes sql, "v.neutral IS NULL"
    assert_includes sql, "g.neutral=false"
  end

  test "unknown player participation beyond the visible row limit still marks the entire aggregate incomplete" do
    @database.game_query_rows = [{ "games" => 82, "wins" => 42, "losses" => 40, "unknown_dates" => 0, "unknown_venues" => 0,
      "unknown_players" => 1, "game_rows" => [@game.merge("player_stats" => [@stat])] }]
    result = @repository.query("노비츠키 최근 82경기 평균 득점")
    assert_equal 1, result["unknownPlayerGames"]
    assert result["incomplete"]
    sql, = @database.calls[-2]
    assert_includes sql, "CROSS JOIN (VALUES"
    assert_includes sql, "s.player_id IS NULL OR s.participation='unknown'"
  end

  test "combined date and venue uncertainty preserves candidates missing both fields" do
    @database.game_query_rows = [{ "games" => 0, "wins" => 0, "losses" => 0, "unknown_dates" => 1, "unknown_venues" => 1, "game_rows" => [] }]
    result = @repository.query("2010-11 시즌 2010-11-02 홈 경기 결과")
    assert_equal "empty", result["status"]
    assert result["incomplete"]
    assert_equal 1, result["unknownDateGames"]
    assert_equal 1, result["unknownVenueGames"]
    sql, binds = @database.calls.last
    assert_includes sql, "d.tipoff_utc IS NULL AND d.home_team_id="
    assert_includes sql, "(d.neutral=false OR d.neutral IS NULL)"
    assert_includes sql, "(v.tipoff_utc IS NULL OR (v.tipoff_utc AT TIME ZONE 'Asia/Seoul')::date BETWEEN"
    assert_equal 4, binds.count("2010-11-02")
  end

end
