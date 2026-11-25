class RecordApiController < ApplicationController
  protect_from_forgery with: :exception
  before_action :resolve_release

  def coverage
    snapshot = repository.catalog(release_id: @release_id)
    raise Records::Database::Unavailable if snapshot["status"] == "invalid"
    api_cache
    render json: { status: snapshot["status"], releaseId: snapshot["releaseId"], totalGames: snapshot["totalGames"], totalPlayerStatRows: snapshot["totalPlayerStatRows"], seasons: snapshot["availableSeasons"], coverage: snapshot.dig("dataset", "coverage"), sources: snapshot.dig("dataset", "sources") }
  end

  def scope
    kind = string_param(:kind)
    id = string_param(:id)
    year = string_param(:season)
    competition = string_param(:competition, "regular")
    page = integer_param(:page, default: 1, min: 1, max: 100)
    raise ActionController::BadRequest unless %w[game player season].include?(kind)
    raise ActionController::BadRequest if kind != "season" && (id.empty? || id.length > 100)
    raise ActionController::BadRequest if kind == "season" && year.empty?
    raise ActionController::BadRequest unless RecordsController::COMPETITIONS.include?(competition)
    season = integer_param(:season, default: nil, min: 1980, max: 2100)
    snapshot = repository.scope(kind: kind, id: id.presence, season: season, competition: competition, offset: (page - 1) * 200, limit: 200, release_id: @release_id)
    raise Records::Database::Unavailable if snapshot["status"] == "invalid"
    cacheable = snapshot["releaseId"] && case kind
      when "game" then snapshot.dig("dataset", "games").any? { |game| game["id"] == id }
      when "player" then snapshot["dalPlayerIds"].include?(id)
      else true
    end
    api_cache(cacheable)
    render json: snapshot
  end

  def query
    query = string_param(:q)
    raise ActionController::BadRequest if query.strip.empty? || query.encode("UTF-16LE").bytesize / 2 > 500
    result = if request.post?
      Records::JevClient.with_actor(request.remote_ip) { repository.query(query, release_id: @release_id, allow_remote: true) }
    else
      repository.query(query, release_id: @release_id)
    end
    api_cache(!request.post? && %w[ready empty].include?(result["status"]))
    render json: result
  end

  private

  def resolve_release
    pairs = URI.decode_www_form(request.query_string)
    if request.post?
      request.request_parameters.each_pair do |key, value|
        pairs << [key, value] if %w[releaseId release].include?(key)
      end
    end
    raise Records::Repository::InvalidRelease if pairs.any? { |key, _| key.match?(/\A(?:releaseId|release)\[/) }
    values = pairs.select { |key, _value| %w[releaseId release].include?(key) }.map(&:last)
    raise Records::Repository::InvalidRelease if values.length > 1 || (values.length == 1 && (!values.first.is_a?(String) || !Records::Repository::RELEASE_PATTERN.match?(values.first)))
    @release_id = values.first
  rescue ArgumentError
    raise Records::Repository::InvalidRelease
  end

  def api_cache(cacheable = true)
    response.headers["X-Robots-Tag"] = "noindex"
    response.headers["Cache-Control"] = if !cacheable
      "no-store"
    elsif @release_id
      "public, max-age=31536000, immutable"
    else
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    end
  end
end
