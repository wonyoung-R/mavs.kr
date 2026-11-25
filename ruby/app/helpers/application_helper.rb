require "digest"

module ApplicationHelper
  def records_stylesheet_path
    digest = Digest::SHA256.file(Rails.root.join("public/assets/records-v1.css")).hexdigest.first(16)
    "/assets/records-v1.css?v=#{digest}"
  end

  PAGE_NAMES = {
    "home" => ["매버릭스 기록 검색", "Mavericks stats, in your words"], "seasons" => ["시즌 기록", "Seasons"],
    "players" => ["매버릭스 선수", "Mavericks players"], "records" => ["구단 기록", "Records"],
    "search" => ["기록 검색", "Search stats"], "compare" => ["선수 비교", "Compare players"],
    "history" => ["구단 역사", "Team history"], "data" => ["데이터와 출처", "Data & sources"],
    "game" => ["경기 기록", "Game box score"], "player" => ["선수 기록", "Player stats"]
  }.freeze
  def t2(ko, en) = I18n.locale == :ko ? ko : en
  def record_path(path)
    path = "/#{path}" unless path.start_with?("/")
    I18n.locale == :en ? (path == "/" ? "/en" : "/en#{path}") : path
  end
  def record_id_path(kind, id) = record_path("/#{kind}/#{ERB::Util.url_encode(id)}")
  def player_name(id)
    player = (@dataset || {}).fetch("players", []).find { |row| row["id"] == id }
    return id unless player
    I18n.locale == :ko && player["nameKo"].present? ? player["nameKo"] : player["name"]
  end
  def team_name(id, game = nil)
    historical = game && (id == game["homeTeamId"] ? game["homeTeamName"] : game["awayTeamName"])
    return historical if historical.present?
    team = (@dataset || {}).fetch("teams", []).find { |row| row["id"] == id }
    team ? (I18n.locale == :ko && team["nameKo"].present? ? team["nameKo"] : team["name"]) : id
  end
  def season_label(year) = year.nil? ? t2("전체 시즌", "All seasons") : "#{year}–#{((year.to_i + 1) % 100).to_s.rjust(2, '0')}"
  def fmt(value, precision: 1)
    return "—" if value.nil?
    value.is_a?(Numeric) ? number_with_delimiter(value == value.to_i ? value.to_i : value.round(precision)) : value.to_s
  end
  def minutes(seconds) = seconds.nil? ? "—" : "#{seconds.to_i / 60}:#{(seconds.to_i % 60).to_s.rjust(2, '0')}"
  def stat_columns = %w[PTS REB AST STL BLK TOV PF OREB DREB FGM FGA FG3M FG3A FTM FTA PLUS_MINUS]
  def competition_label(value)
    t2({ "regular" => "정규시즌", "playoffs" => "플레이오프", "playin" => "플레이인", "cup_final" => "컵 결승", "preseason" => "프리시즌", "summer" => "서머리그" }.fetch(value, value), value.to_s.tr("_", " ").capitalize)
  end
  def safe_external_url(value)
    uri = URI.parse(value.to_s)
    %w[https http].include?(uri.scheme) && uri.host ? value : nil
  rescue URI::InvalidURIError
    nil
  end
  def site_url(path = "/") = "#{Rails.application.config.x.site_url}#{path == '/' ? '' : path}"
  def jsonld(value) = raw(ERB::Util.json_escape(JSON.generate(value)))
  def migrated_content(value)
    fragment = Nokogiri::HTML5.fragment(sanitize(value))
    fragment.css("[src], [href]").each do |node|
      %w[src href].each { |attribute| node[attribute] = MediaArchive.local_url(node[attribute]) if node[attribute] }
    end
    raw(fragment.to_html)
  end
  def language_path(locale)
    path = request.path.delete_prefix("/en")
    path = "/" if path.empty?
    path = locale == :en ? (path == "/" ? "/en" : "/en#{path}") : path
    request.query_string.empty? ? path : "#{path}?#{request.query_string}"
  end

  # SEO metadata is assigned on the controller so it is available to its layout.
  def prepare_records_seo
    title = t2(*PAGE_NAMES.fetch(@section))
    controller.instance_variable_set(:@page_heading, title)
    description = t2("댈러스 매버릭스의 경기·선수·시즌 기록. 박스스코어와 원본 출처, 제공 범위를 확인하세요.", "Dallas Mavericks game, player and season stats, with box scores, sources and coverage.")
    path = request.path
    query = {}
    if @section == "game"
      title = "#{@game['date']} #{team_name(@game['awayTeamId'], @game)} #{@game['awayScore']}–#{@game['homeScore']} #{team_name(@game['homeTeamId'], @game)}"
      description = "#{title}. #{season_label(@game['season'])} #{competition_label(@game['competition'])}. #{t2('선수별 득점·리바운드·어시스트·출전시간·G/F/C 포지션 박스스코어.', 'Player points, rebounds, assists, minutes and G/F/C positions.')}"
      path = record_id_path("games", @game["id"])
    elsif @section == "player"
      title = "#{player_name(@player['id'])} · #{t2('댈러스 매버릭스 경기 기록', 'Dallas Mavericks game logs')}"
      description = "#{title}. #{t2('시즌·정규시즌·플레이오프별 기록과 출처를 확인하세요.', 'Explore season and playoff stats with source coverage.')}"
      path = record_id_path("players", @player["id"])
      query["page"] = @page if @page > 1
      query["season"] = @selected_season if @selected_season
      query["competition"] = @competition if @competition != "regular"
    elsif @section == "seasons" && @selected_season
      title = "#{season_label(@selected_season)} #{t2('댈러스 매버릭스', 'Dallas Mavericks')} #{competition_label(@competition)}"
      path = record_path("/seasons/#{@selected_season}/#{@competition}")
      description = "#{title}. #{t2('경기 일정·결과·박스스코어와 선수 기록.', 'Game results, box scores and player stats.')}"
    else
      %w[season competition metric q p1 p2].each { |key| query[key] = params[key] if params[key].is_a?(String) && params[key].present? }
    end
    %w[venue opponent].each { |key| query[key] = params[key] if params[key].is_a?(String) && params[key].present? }
    canonical_path = query.empty? ? path : "#{path}?#{query.to_query}"
    noindex = %w[search compare].include?(@section) || params[:venue].present? || params[:opponent].present? || (@section == "player" && (@selected_season || @competition != "regular")) || (@section == "records" && query.present?)
    controller.instance_variable_set(:@seo_title, "#{title} | MAVS.KR")
    controller.instance_variable_set(:@description, description)
    controller.instance_variable_set(:@canonical, site_url(canonical_path))
    controller.instance_variable_set(:@noindex, !!noindex)
    ko_path = canonical_path.delete_prefix("/en")
    ko_path = "/" if ko_path.empty?
    en_path = ko_path == "/" ? "/en" : "/en#{ko_path}"
    controller.instance_variable_set(:@alternates, { "ko" => site_url(ko_path), "en" => site_url(en_path), "x-default" => site_url(ko_path) })
    graph = [{ "@type" => "BreadcrumbList", "itemListElement" => [{ "@type" => "ListItem", "position" => 1, "name" => "MAVS.KR", "item" => site_url(record_path('/')) }, { "@type" => "ListItem", "position" => 2, "name" => title, "item" => site_url(canonical_path) }] }]
    if @game
      event = { "@type" => "SportsEvent", "name" => title, "url" => site_url(canonical_path), "startDate" => @game["date"], "sport" => "Basketball", "homeTeam" => { "@type" => "SportsTeam", "name" => team_name(@game["homeTeamId"], @game) }, "awayTeam" => { "@type" => "SportsTeam", "name" => team_name(@game["awayTeamId"], @game) } }
      event["location"] = { "@type" => "Place", "name" => @game["arenaName"] } if @game["arenaName"].present?
      graph << event
    elsif @player
      graph << { "@type" => "Person", "name" => @player["name"], "alternateName" => @player["nameKo"], "url" => site_url(canonical_path) }.compact
    elsif @section == "home"
      graph << { "@type" => "WebSite", "name" => "MAVS.KR", "url" => site_url, "inLanguage" => ["ko", "en"] }
    end
    controller.instance_variable_set(:@structured_data, { "@context" => "https://schema.org", "@graph" => graph })
  end
end
