class ApplicationController < ActionController::Base
  around_action :with_locale
  rescue_from Records::Database::Unavailable, with: :unavailable
  rescue_from Records::SearchReference::Invalid, with: :unavailable
  rescue_from Records::Repository::ReleaseNotFound, with: :not_found
  rescue_from Records::Repository::InvalidRelease, ActionController::BadRequest, with: :bad_request
  rescue_from ActionController::InvalidAuthenticityToken, with: :invalid_authenticity
  helper_method :repository

  private

  def with_locale(&block)
    I18n.with_locale(params[:locale] == "en" ? :en : :ko, &block)
  end

  def repository
    @repository ||= Rails.application.config.x.records_repository || Records::Repository.new
  end

  def unavailable
    error_response(503, "기록을 일시적으로 불러올 수 없습니다.", "The archive is temporarily unavailable.")
  end

  def not_found
    error_response(404, "페이지를 찾을 수 없습니다.", "Page not found.")
  end

  def bad_request
    error_response(400, "조회 조건을 확인해 주세요.", "Please check the request parameters.")
  end

  def invalid_authenticity
    error_response(422, "페이지를 새로고침한 후 다시 검색해 주세요.", "Please reload the page and search again.")
  end

  def error_response(status, ko, en)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    if request.path.start_with?("/api/")
      render json: { status: { 400 => "invalid", 404 => "not_found", 422 => "invalid", 503 => "unavailable" }.fetch(status) }, status: status
    elsif !request.format.html?
      render plain: I18n.locale == :ko ? ko : en, status: status
    else
      @page_heading = I18n.locale == :ko ? ko : en
      @seo_title = "#{@page_heading} | MAVS.KR"
      @description = @page_heading
      @noindex = true
      render "errors/show", status: status
    end
  end

  def string_param(key, default = "")
    value = params[key]
    return default if value.nil?
    raise ActionController::BadRequest unless value.is_a?(String)
    value
  end

  def integer_param(key, default:, min:, max:)
    value = string_param(key)
    return default if value.empty?
    raise ActionController::BadRequest unless value.match?(/\A\d+\z/) && value.to_i.between?(min, max)
    value.to_i
  end

  def set_public_cache(seconds = 60)
    response.headers["Cache-Control"] = "public, max-age=0, s-maxage=#{seconds}, stale-while-revalidate=300"
  end
end
