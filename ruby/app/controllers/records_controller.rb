class RecordsController < ApplicationController
  protect_from_forgery with: :exception
  SECTIONS = %w[home search seasons players records compare history data game player].freeze
  COMPETITIONS = %w[regular playoffs playin cup_final preseason summer].freeze

  def show
    @section = string_param(:section)
    return not_found unless SECTIONS.include?(@section)
    if @section == "home" && params[:tab].present?
      tab = string_param(:tab)
      destination = { "community" => "/comm", "column" => "/column", "stats" => "/records", "news" => "/news" }[tab]
      return redirect_to(destination || "/fan?#{ { tab: tab }.to_query }", status: :moved_permanently)
    end
    reference = nil
    if @section == "search" && request.get? && params[:interpretation].present?
      begin
        reference = Records::SearchReference.new.read(string_param(:interpretation))
      rescue Records::SearchReference::Invalid
        @query_result = { "status" => "unavailable", "messageKo" => "검색 링크가 만료되었거나 유효하지 않습니다. 질문을 다시 입력해 주세요.", "message" => "This search link has expired or is invalid. Please enter your question again." }
      end
    end
    @snapshot = reference ? repository.catalog(release_id: reference["releaseId"]) : repository.catalog
    raise Records::Database::Unavailable unless @snapshot&.[]("releaseId")
    @selected_season = string_param(:season) == "all" ? nil : integer_param(:season, default: nil, min: 1980, max: 2100)
    @selected_season ||= @snapshot["availableSeasons"].first if @section == "seasons"
    @competition = string_param(:competition, "regular")
    raise ActionController::BadRequest unless COMPETITIONS.include?(@competition)
    @page = integer_param(:page, default: 1, min: 1, max: 100)
    @query = reference ? reference["query"] : string_param(:q)
    raise ActionController::BadRequest if @query.encode("UTF-16LE").bytesize / 2 > 500
    @metric = string_param(:metric, "PTS")
    raise ActionController::BadRequest unless (Records::Repository::STAT_KEYS - ["MIN_SECONDS"]).include?(@metric)
    @filters = { "releaseId" => @snapshot["releaseId"], "season" => @selected_season, "competition" => @competition }.compact
    opponent = string_param(:opponent)
    if opponent.present?
      raise ActionController::BadRequest unless @snapshot.dig("dataset", "teams").any? { |team| team["id"] == opponent }
      @filters["opponentId"] = opponent
    end
    venue = string_param(:venue)
    if venue.present?
      raise ActionController::BadRequest unless %w[home away neutral].include?(venue)
      @filters["venue"] = venue
    end
    options = { season: @selected_season, competition: @competition, opponent_id: @filters["opponentId"], venue: @filters["venue"], release_id: @snapshot["releaseId"] }
    case @section
    when "home" then @snapshot = repository.scope(kind: "season", limit: 8, release_id: @snapshot["releaseId"])
    when "game" then @snapshot = repository.scope(kind: "game", id: string_param(:id), release_id: @snapshot["releaseId"])
    when "player" then @snapshot = repository.scope(kind: "player", id: string_param(:id), offset: (@page - 1) * 200, limit: 200, **options)
    when "seasons" then @snapshot = repository.scope(kind: "season", limit: 200, **options)
    when "search"
      if reference
        @query_result = repository.execute_plan(reference["plan"], release_id: reference["releaseId"])
      elsif request.post?
        raise ActionController::BadRequest if @query.strip.empty?
        @query_result = Records::JevClient.with_actor(request.remote_ip) { repository.query(@query, release_id: @snapshot["releaseId"], allow_remote: true) }
        if %w[ready empty].include?(@query_result["status"]) && @query_result["plan"]
          token = Records::SearchReference.new.create(query: @query, plan: @query_result["plan"], release_id: @snapshot["releaseId"])
          response.headers["Cache-Control"] = "private, no-store"
          return redirect_to("#{helpers.record_path('/search')}?#{ { interpretation: token }.to_query }", status: :see_other)
        end
      elsif @query.present? && !@query_result
        @query_result = repository.query(@query, release_id: @snapshot["releaseId"])
      end
    when "records" then @leaderboard = repository.leaderboard(@filters.merge("stat" => @metric))
    when "compare"
      ids = [string_param(:p1), string_param(:p2)].reject(&:empty?)
      raise ActionController::BadRequest unless ids.all? { |id| @snapshot["dalPlayerIds"].include?(id) }
      @comparison = ids.length == 2 ? repository.comparison(@filters.merge("playerIds" => ids)) : []
    end
    @dataset = @snapshot["dataset"]
    @game = @dataset["games"].find { |row| row["id"] == params[:id] } if @section == "game"
    @player = @dataset["players"].find { |row| row["id"] == params[:id] } if @section == "player"
    return not_found if @section == "game" && !@game
    return not_found if @section == "player" && (!@player || !@snapshot["dalPlayerIds"].include?(@player["id"]))
    helpers.prepare_records_seo
    if %w[home search].include?(@section)
      # These pages contain session-bound CSRF tokens and must bypass a CDN.
      response.headers["Cache-Control"] = "private, no-store"
      response.headers["Referrer-Policy"] = "same-origin"
    else
      set_public_cache
    end
    response.headers["X-Robots-Tag"] = "noindex, follow" if @noindex
    render :show
  end
end
