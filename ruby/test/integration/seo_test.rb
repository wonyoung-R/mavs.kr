# frozen_string_literal: true

require_relative "../test_helper"
require "minitest/mock"
require "nokogiri"
require "json"

# Personas: a Korean/English fan following record links and a search crawler.
# All fixtures are synthetic; these requests must never open a database socket.
class SeoTest < ActionDispatch::IntegrationTest
  ORIGIN = "https://www.mavs.kr"
  RELEASE = "r_0123456789abcdef01234567"
  MISSING_RELEASE = "r_000000000000000000000000"
  GAME = "nba:game:0022501193"
  PLAYER = "nba:player:1717"
  SECOND_PLAYER = "nba:player:1629029"

  class FixtureRepository
    attr_accessor :failure
    attr_reader :dataset, :calls

    def initialize
      @calls = []
      @dataset = {
        "version" => 1,
        "teams" => [
          { "id" => "dal", "name" => "Dallas Mavericks", "nameKo" => "댈러스 매버릭스", "abbreviation" => "DAL", "aliases" => [] },
          { "id" => "chi", "name" => "Chicago Bulls", "nameKo" => "시카고 불스", "abbreviation" => "CHI", "aliases" => [] }
        ],
        "players" => [
          { "id" => PLAYER, "name" => "Dirk Nowitzki", "nameKo" => "디르크 노비츠키", "aliases" => ["Dirk"] },
          { "id" => SECOND_PLAYER, "name" => "Luka Doncic", "nameKo" => "루카 돈치치", "aliases" => ["Luka"] }
        ],
        "games" => [
          { "id" => GAME, "date" => "2026-04-12", "season" => 2025, "competition" => "regular", "homeTeamId" => "dal", "awayTeamId" => "chi",
            "homeTeamName" => "Dallas Mavericks", "awayTeamName" => "Chicago Bulls", "homeScore" => 149, "awayScore" => 128,
            "neutral" => nil, "status" => "final", "sourceId" => "fixture", "arenaName" => "Example Arena" },
          { "id" => "nba:game:0041000406", "date" => "2011-06-12", "season" => 2010, "competition" => "playoffs", "homeTeamId" => "chi", "awayTeamId" => "dal",
            "homeScore" => 95, "awayScore" => 105, "neutral" => nil, "status" => "final", "sourceId" => "fixture" }
        ],
        "playerStats" => [
          { "gameId" => GAME, "playerId" => PLAYER, "teamId" => "dal", "starter" => true, "starterPosition" => "F",
            "participation" => "played", "sourceId" => "fixture", "values" => { "PTS" => 28, "REB" => 7, "MIN_SECONDS" => 1800 } }
        ],
        "teamStats" => [], "coverage" => [],
        "sources" => [{ "id" => "fixture", "name" => "Synthetic test source", "url" => "https://example.test/source", "retrievedAt" => "2026-01-01T00:00:00Z" }]
      }
    end

    def catalog(release_id: nil)
      @calls << [:catalog, release_id]
      raise @failure if @failure
      raise Records::Repository::InvalidRelease if release_id && !Records::Repository::RELEASE_PATTERN.match?(release_id)
      raise Records::Repository::ReleaseNotFound if release_id && release_id != RELEASE
      { "status" => "ready", "releaseId" => RELEASE, "dataset" => @dataset.deep_dup,
        "totalGames" => @dataset["games"].length, "totalPlayerStatRows" => @dataset["playerStats"].length,
        "availableSeasons" => [2025, 2010], "dalPlayerIds" => @dataset["players"].map { |player| player["id"] } }
    end

    def scope(kind:, id: nil, release_id: nil, season: nil, competition: nil, offset: 0, limit: 200, **)
      @calls << [:scope, { kind: kind, id: id, season: season, offset: offset }]
      snapshot = catalog(release_id: release_id)
      games = snapshot["dataset"]["games"]
      games = games.select { |game| game["id"] == id } if kind == "game"
      games = [] if kind == "player" && !snapshot["dalPlayerIds"].include?(id)
      games = games.select { |game| game["season"] == season } if season && kind != "game"
      games = games.select { |game| game["competition"] == competition } if competition && kind != "game"
      snapshot["scopeTotal"] = games.length
      snapshot["dataset"]["games"] = games.drop(offset).first(limit)
      snapshot
    end

    def index
      snapshot = catalog
      { "releaseId" => RELEASE, "games" => snapshot["dataset"]["games"], "players" => snapshot["dataset"]["players"], "seasons" => [2025, 2010] }
    end

    def leaderboard(*) = [{ "playerId" => PLAYER, "games" => 1, "known" => 1, "value" => 28 }]

    def comparison(*)
      [PLAYER, SECOND_PLAYER].map { |id| { "playerId" => id, "games" => 1, "values" => { "PTS" => 28 }, "known" => { "PTS" => 1 } } }
    end

    def query(_text, release_id: nil)
      catalog(release_id: release_id)
      { "status" => "ready", "releaseId" => RELEASE, "total" => 1, "incomplete" => true, "coverage" => [], "summaries" => [],
        "plan" => { "season" => 2025, "competition" => "regular", "stat" => "PTS", "aggregation" => "games" },
        "rows" => [{ "gameId" => GAME, "date" => "2026-04-12", "playerId" => PLAYER, "playerName" => "Dirk Nowitzki",
          "playerNameKo" => "디르크 노비츠키", "values" => { "PTS" => 28 } }] }
    end
  end

  class FixtureContentRepository
    attr_reader :article_data

    def initialize
      @article_data = { "id" => "article-1", "title" => "Example news", "content" => "<p>Example story.</p>", "summary" => "Example summary",
        "date" => Time.utc(2026, 1, 1), "updated" => Time.utc(2026, 1, 2), "author" => "Example writer", "sourceUrl" => "https://example.test/story" }
    end

    def article(_kind, id) = id == "article-1" ? @article_data.deep_dup : nil
    def list(*) = [@article_data.deep_dup]
    def index = [{ "id" => "article-1", "kind" => "news", "updated" => Time.utc(2026, 1, 2) }, { "id" => "post-1", "kind" => "community", "updated" => Time.utc(2026, 1, 3) }]
  end

  setup do
    @previous_repository = Rails.application.config.x.records_repository
    @previous_site_url = Rails.application.config.x.site_url
    @repository = FixtureRepository.new
    Rails.application.config.x.records_repository = @repository
    Rails.application.config.x.site_url = ORIGIN
  end

  teardown do
    Rails.application.config.x.records_repository = @previous_repository
    Rails.application.config.x.site_url = @previous_site_url
  end

  test "fan and crawler receive localized home metadata and reciprocal hreflang" do
    [["/", "ko", "매버릭스 기록 검색", ""], ["/en", "en", "Mavericks stats, in your words", "/en"]].each do |path, locale, title, canonical|
      get path
      assert_response :success
      assert_select "html[lang=?]", locale
      assert_select "title", "#{title} | MAVS.KR"
      assert_select "meta[name=description]" do |nodes|
        assert nodes.first["content"].present?
      end
      assert_canonical "#{ORIGIN}#{canonical}"
      assert_alternates "", "/en"
      assert_select "meta[name=robots][content=?]", "index, follow, max-image-preview:large"
      assert_equal "WebSite", json_graph.find { |item| item["@type"] == "WebSite" }.fetch("@type")
    end
  end

  test "encoded game links resolve in both languages with one encoded canonical" do
    ["", "/en"].each do |locale|
      get "#{locale}/games/#{encoded(GAME)}"
      assert_response :success
      assert_select "title", "2026-04-12 Chicago Bulls 128–149 Dallas Mavericks | MAVS.KR"
      assert_select ".scoreboard", text: /Chicago Bulls.*128.*149.*Dallas Mavericks/m
      assert_canonical "#{ORIGIN}#{locale}/games/#{encoded(GAME)}"
      assert_alternates "/games/#{encoded(GAME)}", "/en/games/#{encoded(GAME)}"
      assert_equal GAME, @repository.calls.reverse.find { |call| call.first == :scope }.last[:id]
      event = json_graph.find { |item| item["@type"] == "SportsEvent" }
      assert_equal "2026-04-12", event["startDate"]
      assert_equal "Dallas Mavericks", event.dig("homeTeam", "name")
      assert_equal "Chicago Bulls", event.dig("awayTeam", "name")
    end
  end

  test "player detail exposes real metadata and single encoded localized links" do
    [["", "디르크 노비츠키"], ["/en", "Dirk Nowitzki"]].each do |locale, name|
      get "#{locale}/players/#{encoded(PLAYER)}"
      assert_response :success
      assert_select "title", text: /#{Regexp.escape(name)}/
      assert_canonical "#{ORIGIN}#{locale}/players/#{encoded(PLAYER)}"
      assert_alternates "/players/#{encoded(PLAYER)}", "/en/players/#{encoded(PLAYER)}"
      assert_select "a[href=?]", "#{locale}/games/#{encoded(GAME)}"
      assert_equal "Dirk Nowitzki", json_graph.find { |item| item["@type"] == "Person" }.fetch("name")
    end
  end

  test "raw colon identifiers resolve but a second layer of encoding is not decoded" do
    get "/games/#{GAME}"
    assert_response :success
    assert_canonical "#{ORIGIN}/games/#{encoded(GAME)}"
    ["", "/en"].each do |locale|
      get "#{locale}/games/#{encoded(encoded(GAME))}"
      assert_error_response 404
    end
  end

  test "canonical season pages and query aliases agree without tracking parameters" do
    get "/en/seasons", params: { season: "2010", competition: "playoffs", utm_source: "test" }
    assert_response :success
    assert_canonical "#{ORIGIN}/en/seasons/2010/playoffs"
    assert_alternates "/seasons/2010/playoffs", "/en/seasons/2010/playoffs"
    get "/en/seasons/2010/playoffs"
    assert_response :success
    assert_canonical "#{ORIGIN}/en/seasons/2010/playoffs"
    assert_select "title", "2010–11 Dallas Mavericks Playoffs | MAVS.KR"
  end

  test "player pagination keeps its canonical page and filtered pages are noindex" do
    get "/players/#{encoded(PLAYER)}", params: { page: "2", utm_campaign: "test" }
    assert_response :success
    assert_canonical "#{ORIGIN}/players/#{encoded(PLAYER)}?page=2"
    get "/players/#{encoded(PLAYER)}", params: { season: "2010", competition: "playoffs" }
    assert_response :success
    assert_noindex
    assert_canonical "#{ORIGIN}/players/#{encoded(PLAYER)}?competition=playoffs&season=2010"
  end

  test "search and comparison are noindex but remain crawlable through robots" do
    ["/search", "/en/search", "/compare", "/en/compare"].each do |path|
      get path
      assert_response :success
      assert_noindex
    end
    get "/robots.txt"
    assert_response :success
    assert_includes response.body, "Allow: /"
    assert_includes response.body, "Sitemap: #{ORIGIN}/sitemap.xml"
    refute_match %r{Disallow:\s*/(?:en/)?(?:search|compare)}, response.body
    assert_includes response.body, "Disallow: /admin"
  end

  test "unknown game and player identifiers return actual 404 responses in both languages" do
    ["", "/en"].product(%w[games players]).each do |locale, kind|
      get "#{locale}/#{kind}/missing-record"
      assert_error_response 404
      assert_select "h1", text: locale.empty? ? /페이지를 찾을 수 없습니다/ : /Page not found/
    end
  end

  test "database outages produce 503 rather than an empty successful archive" do
    @repository.failure = Records::Database::Unavailable.new
    ["/", "/en/games/#{encoded(GAME)}", "/sitemaps/games.xml", "/api/records/coverage"].each do |path|
      get path
      assert_error_response 503
    end
    @repository.failure = nil
    get "/"
    assert_response :success
    assert_select ".scope strong", "2"
  end

  test "malformed nested parameters and out of bounds pagination return 400" do
    [["/players", { page: "0" }], ["/players", { page: "101" }], ["/seasons", { season: "1979" }], ["/search", { q: ["unexpected"] }]].each do |path, query|
      get path, params: query
      assert_error_response 400
    end
  end

  test "search form posts while deterministic GET links preserve query and language" do
    get "/en"
    assert_response :success
    form = html.at_css("form[role=search]")
    assert_equal "post", form["method"]
    assert form.at_css("input[name=authenticity_token]")["value"].present?
    assert_equal "/en/search", form["action"]
    assert_equal "500", form.at_css("input[name=q]")["maxlength"]
    query = "Dirk 2025 regular season points"
    get form["action"], params: { q: query }
    assert_response :success
    assert_select "input[name=q][value=?]", query
    assert_select "tbody tr", count: 1
    assert_select "tbody tr", text: /Dirk Nowitzki.*2026-04-12.*28/m
    assert_noindex
  end

  test "default all-season filters submit successfully for player leaders and comparison" do
    ["/players/#{encoded(PLAYER)}", "/records", "/compare"].each do |path|
      get path
      assert_response :success
      form = html.at_css("form.filters")
      assert_equal "get", form["method"]
      values = selected_form_values(form)
      values.merge!("p1" => PLAYER, "p2" => SECOND_PLAYER) if path == "/compare"
      get form["action"], params: values
      assert_response :success
      assert_nil @repository.calls.reverse.find { |call| call.first == :scope }.last[:season] if path.start_with?("/players/")
    end
  end

  test "JSON-LD preserves hostile data as escaped JSON without closing its script element" do
    value = "Example </script><script id=\"qa-breakout\">alert(1)</script><!-- & >\u2028"
    @repository.dataset["players"].first.merge!("name" => value, "nameKo" => value)
    get "/players/#{encoded(PLAYER)}"
    assert_response :success
    assert_select "script", count: 1
    assert_select "#qa-breakout", count: 0
    node = html.at_css('script[type="application/ld+json"]')
    refute_match %r{</script}i, node.text
    assert_includes node.text, "\\u003c"
    assert_equal value, JSON.parse(node.text)["@graph"].find { |item| item["@type"] == "Person" }.fetch("name")
  end

  test "sitemap index declares the complete sitemap set as valid XML" do
    get "/sitemap.xml"
    assert_response :success
    assert_match %r{xml}, response.media_type
    assert_equal %w[articles games pages players seasons].map { |kind| "#{ORIGIN}/sitemaps/#{kind}.xml" }, xml_locations.sort
  end

  test "game sitemap includes every known id beyond the page limit with reciprocal alternates" do
    205.times do |index|
      @repository.dataset["games"] << @repository.dataset["games"].first.merge("id" => "nba:game:qa#{index.to_s.rjust(5, '0')}")
    end
    get "/sitemaps/games.xml"
    assert_response :success
    expected = @repository.dataset["games"].flat_map { |game| ["", "/en"].map { |locale| "#{ORIGIN}#{locale}/games/#{encoded(game['id'])}" } }
    assert_equal expected.sort, xml_locations.sort
    assert_equal expected.length, xml_locations.uniq.length
    assert_sitemap_alternates
  end

  test "player sitemap includes every known player id without double encoding" do
    205.times { |index| @repository.dataset["players"] << { "id" => "nba:player:qa#{index}", "name" => "Fixture #{index}", "aliases" => [] } }
    get "/sitemaps/players.xml"
    assert_response :success
    expected = @repository.dataset["players"].flat_map { |player| ["", "/en"].map { |locale| "#{ORIGIN}#{locale}/players/#{encoded(player['id'])}" } }
    assert_equal expected.sort, xml_locations.sort
    refute_includes response.body, "%253A"
    assert_sitemap_alternates
  end

  test "season sitemap includes observed season competition pairs and excludes invented seasons" do
    get "/sitemaps/seasons.xml"
    assert_response :success
    assert_equal %w[/en/seasons/2010/playoffs /en/seasons/2025/regular /seasons/2010/playoffs /seasons/2025/regular].map { |path| "#{ORIGIN}#{path}" }, xml_locations.sort
    assert_sitemap_alternates
  end

  test "static sitemap excludes search comparison and private authoring endpoints" do
    get "/sitemaps/pages.xml"
    assert_response :success
    assert_includes xml_locations, ORIGIN
    assert_includes xml_locations, "#{ORIGIN}/en"
    assert_includes xml_locations, "#{ORIGIN}/news"
    refute xml_locations.any? { |url| url.match?(%r{/(?:search|compare|login|admin|api)(?:[/?]|$)}) }
  end

  test "article sitemap and article metadata use preserved ids without a database" do
    content = FixtureContentRepository.new
    ContentRepository.stub(:new, content) do
      get "/sitemaps/articles.xml"
      assert_response :success
      assert_equal ["#{ORIGIN}/community/post-1", "#{ORIGIN}/news/article-1"], xml_locations.sort
      get "/news/article-1"
      assert_response :success
      assert_select "title", "Example news | MAVS.KR"
      assert_canonical "#{ORIGIN}/news/article-1"
      document = JSON.parse(html.at_css('script[type="application/ld+json"]').text)
      assert_equal "NewsArticle", document["@type"]
      assert_equal "2026-01-01T00:00:00Z", document["datePublished"]
      get "/news/missing"
      assert_error_response 404
    end
  end

  test "API rejects malformed duplicate and nested release parameters before repository access" do
    queries = ["releaseId=invalid", "releaseId=", "releaseId=#{RELEASE}&releaseId=#{RELEASE}", "releaseId=#{RELEASE}&release=#{RELEASE}",
      "releaseId%5B%5D=#{RELEASE}", "releaseId%5Bvalue%5D=#{RELEASE}", "release%5B%5D=#{RELEASE}"]
    queries.each do |query|
      @repository.calls.clear
      get "/api/records/coverage?#{query}"
      assert_error_response 400
      assert_empty @repository.calls
    end
  end

  test "missing pinned releases return 404 for all APIs without falling back to current" do
    { "/api/records/coverage" => {}, "/api/records/scope" => { kind: "game", id: GAME }, "/api/records/query" => { q: "Dirk points" } }.each do |path, query|
      get path, params: query.merge(releaseId: MISSING_RELEASE)
      assert_error_response 404
      assert_equal "not_found", response.parsed_body["status"]
    end
  end

  test "known pinned API release is immutable and returns the requested release" do
    get "/api/records/coverage", params: { releaseId: RELEASE }
    assert_response :success
    assert_equal RELEASE, response.parsed_body["releaseId"]
    assert_equal 2, response.parsed_body["totalGames"]
    assert_includes response.headers["Cache-Control"], "immutable"
    assert_equal "noindex", response.headers["X-Robots-Tag"]
  end

  test "API invalid scope and empty query remain 400 including HTML all-season sentinel" do
    [["/api/records/scope", { kind: "season", season: "all" }], ["/api/records/scope", { kind: "game" }], ["/api/records/query", { q: " " }]].each do |path, query|
      get path, params: query
      assert_error_response 400
    end
  end

  private

  def encoded(value) = ERB::Util.url_encode(value)
  def html = Nokogiri::HTML(response.body)
  def json_graph = JSON.parse(html.at_css('script[type="application/ld+json"]').text).fetch("@graph")

  def assert_canonical(url)
    assert_select "link[rel=canonical][href=?]", url, count: 1
    refute_includes html.at_css('link[rel="canonical"]')["href"], "%253A"
    assert_select 'meta[property="og:url"][content=?]', url
  end

  def assert_alternates(ko, en)
    { "ko" => "#{ORIGIN}#{ko}", "en" => "#{ORIGIN}#{en}", "x-default" => "#{ORIGIN}#{ko}" }.each do |lang, target|
      assert_select "link[rel=alternate][hreflang=?][href=?]", lang, target, count: 1
    end
  end

  def assert_noindex
    assert_select 'meta[name="robots"][content=?]', "noindex, follow"
    assert_equal "noindex, follow", response.headers["X-Robots-Tag"]
  end

  def assert_error_response(status)
    assert_response status
    assert_equal "no-store", response.headers["Cache-Control"]
    assert_equal "noindex", response.headers["X-Robots-Tag"]
  end

  def selected_form_values(form)
    form.css("select[name]:not([disabled])").to_h do |select|
      selected = select.at_css("option[selected]") || select.at_css("option")
      [select["name"], selected["value"]]
    end
  end

  def xml_document
    document = Nokogiri::XML(response.body) { |config| config.strict.nonet }
    assert_empty document.errors
    document
  end

  def xml_locations
    xml_document.xpath("//s:loc", "s" => "http://www.sitemaps.org/schemas/sitemap/0.9").map(&:text)
  end

  def assert_sitemap_alternates
    xml_document.xpath("//s:url", "s" => "http://www.sitemaps.org/schemas/sitemap/0.9").each do |entry|
      links = entry.xpath("xhtml:link", "xhtml" => "http://www.w3.org/1999/xhtml")
      assert_equal %w[en ko x-default], links.map { |link| link["hreflang"] }.sort
      assert links.all? { |link| link["rel"] == "alternate" && link["href"].start_with?(ORIGIN) }
    end
  end
end
