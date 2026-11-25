# frozen_string_literal: true

require_relative "search_ui_test"

class SearchFlowTest < ActionDispatch::IntegrationTest
  class FixtureRepository < SearchUiTest::FixtureRepository
    attr_reader :query_calls, :plan_calls
    def initialize
      @query_calls, @plan_calls = [], []
      @result = { "status" => "ready", "releaseId" => SearchUiTest::RELEASE, "total" => 0, "rows" => [], "summaries" => [], "coverage" => [], "incomplete" => false,
        "plan" => { "playerIds" => [SearchUiTest::DIRK], "competition" => "regular", "stat" => "PTS", "aggregation" => "games", "direction" => "desc", "limit" => 50 } }
    end
    def query(text, release_id: nil, allow_remote: false)
      @query_calls << { text: text, release: release_id, remote: allow_remote }
      @result.deep_dup
    end
    def execute_plan(plan, release_id:)
      @plan_calls << { plan: plan, release: release_id }
      @result.deep_dup.merge("plan" => plan)
    end
  end

  setup do
    @previous_repository = Rails.application.config.x.records_repository
    @previous_cache = Rails.cache
    @previous_csrf = ActionController::Base.allow_forgery_protection
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    ActionController::Base.allow_forgery_protection = true
    @repository = FixtureRepository.new
    Rails.application.config.x.records_repository = @repository
  end

  teardown do
    Rails.application.config.x.records_repository = @previous_repository
    Rails.cache = @previous_cache
    ActionController::Base.allow_forgery_protection = @previous_csrf
  end

  def csrf_token
    get "/search"
    assert_response :success
    Nokogiri::HTML(response.body).at_css("input[name=authenticity_token]")["value"]
  end

  test "POST redirects to a private replayable result without another interpretation" do
    token = csrf_token
    post "/search", params: { q: "노비츠키 30점을 넘긴 경기", authenticity_token: token }
    assert_response :see_other
    assert_equal 1, @repository.query_calls.size
    assert @repository.query_calls.first[:remote]
    assert_includes response.location, "interpretation="
    refute_includes response.location, "노비츠키"
    assert_equal "private, no-store", response.headers["Cache-Control"]
    url = response.location
    follow_redirect!
    assert_response :success
    assert_select "form.search input[name=q][value=?]", "노비츠키 30점을 넘긴 경기"
    assert_equal "private, no-store", response.headers["Cache-Control"]
    assert_equal "noindex, follow", response.headers["X-Robots-Tag"]
    assert_equal SearchUiTest::RELEASE, @repository.plan_calls.first[:release]
    get url
    assert_response :success
    assert_equal 1, @repository.query_calls.size
    assert_equal 2, @repository.plan_calls.size
  end

  test "missing token wrong session and foreign origin cannot call interpreter" do
    post "/search", params: { q: "Dirk points" }
    assert_response :unprocessable_content
    valid_token = csrf_token
    other = open_session
    other.post "/search", params: { q: "Dirk points", authenticity_token: valid_token }
    assert_equal 422, other.response.status
    post "/search", params: { q: "Dirk points", authenticity_token: valid_token }, headers: { "HTTP_ORIGIN" => "https://foreign.example" }
    assert_response :unprocessable_content
    post "/api/records/query", params: { q: "Dirk points" }
    assert_response :unprocessable_content
    assert_empty @repository.query_calls
  end

  test "HTML and API GET never opt into paid interpretation" do
    get "/search", params: { q: "Dirk points" }
    assert_response :success
    get "/api/records/query", params: { q: "Dirk points" }
    assert_response :success
    assert_equal [false, false], @repository.query_calls.map { |call| call[:remote] }
  end

  test "home and search tokens cannot enter public CDN caches" do
    ["/", "/en", "/search", "/en/search"].each do |path|
      get path
      assert_response :success
      assert_equal "private, no-store", response.headers["Cache-Control"]
    end
  end

  test "expired tampered and evicted references do not reinterpret a query" do
    reference = Records::SearchReference.new
    token = reference.create(query: "Dirk points", plan: @repository.result["plan"], release_id: SearchUiTest::RELEASE)
    get "/search", params: { interpretation: "#{token}tampered", q: "Dirk points" }
    assert_response :success
    assert_select "[data-search-status=unavailable]"
    travel 8.days do
      get "/search", params: { interpretation: token }
      assert_select "[data-search-status=unavailable]"
    end
    Rails.cache.clear
    get "/search", params: { interpretation: token }
    assert_select "[data-search-status=unavailable]"
    assert_empty @repository.query_calls
    assert_empty @repository.plan_calls
  end

  test "API POST uses CSRF and is never cacheable" do
    token = csrf_token
    post "/api/records/query", params: { q: "Dirk points", authenticity_token: token }
    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]
    assert @repository.query_calls.first[:remote]
  end

  test "recent team query keeps its exact scope across POST redirect and GET API without remote calls on replay" do
    plan = { "intent" => "team_record", "playerIds" => [], "season" => 2010, "competition" => "regular", "stat" => "PTS",
      "aggregation" => "count", "direction" => "desc", "limit" => 50, "recentGames" => 2,
      "dateFrom" => "2010-11-01", "dateTo" => "2010-11-30" }
    @repository.result = @repository.result.merge("plan" => plan, "total" => 1,
      "teamSummary" => { "games" => 1, "wins" => 1, "losses" => 0, "unknown" => 0 },
      "gameRows" => [{ "gameId" => SearchUiTest::GAME, "date" => "2010-11-02", "tipoffUtc" => "2010-11-02T01:00:00Z",
        "homeTeamId" => "dal", "awayTeamId" => "mia", "homeScore" => 100, "awayScore" => 90, "outcome" => "W" }])
    token = csrf_token
    post "/search", params: { q: "2010-11-01부터 2010-11-30까지 최근 두 경기 승패", authenticity_token: token }
    assert_response :see_other
    follow_redirect!
    assert_response :success
    assert_equal plan, @repository.plan_calls.last[:plan]
    assert_select "[data-team-record]", text: /1 승.*0 패/
    assert_select ".searchConditions", text: /최근 완료 2경기.*2010-11-01 ~ 2010-11-30/m
    assert_equal 1, @repository.query_calls.length
    get "/api/records/query", params: { q: "2010-11 최근 두 경기 승패" }
    assert_response :success
    assert_equal plan, response.parsed_body["plan"]
    assert_equal false, @repository.query_calls.last[:remote]
    assert_equal 1, response.parsed_body.dig("teamSummary", "wins")
  end
end
