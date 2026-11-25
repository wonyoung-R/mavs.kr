class ContentController < ApplicationController
  NAMES = { "news" => "매버릭스 뉴스", "comm" => "팬 커뮤니티", "column" => "매버릭스 칼럼", "analysis" => "경기 분석", "community" => "팬 커뮤니티" }.freeze

  def index
    @kind = string_param(:kind)
    @page = integer_param(:page, default: 1, min: 1, max: 1000)
    rows = content_repository.list(@kind, page: @page)
    @has_next = rows.length > 30
    @articles = rows.first(30)
    @page_heading = NAMES.fetch(@kind)
    @seo_title = "#{@page_heading}#{@page > 1 ? " · #{@page}" : ''} | MAVS.KR"
    @description = "댈러스 매버릭스의 최신 소식과 경기 분석, 한국 팬들의 이야기."
    @canonical = helpers.site_url("/#{@kind}#{@page > 1 ? "?page=#{@page}" : ''}")
    set_public_cache
  end

  def show
    @kind = string_param(:kind)
    @article = content_repository.article(@kind, string_param(:id))
    return not_found unless @article
    # One canonical URL per post, including older community/column aliases.
    category = @article["category"]
    canonical_kind = category == "COLUMN" ? "column" : category == "ANALYSIS" ? "analysis" : @kind == "news" ? "news" : "community"
    if canonical_kind != @kind
      return redirect_to("/#{canonical_kind}/#{ERB::Util.url_encode(@article['id'])}", status: :moved_permanently)
    end
    @page_heading = @article["title"]
    @seo_title = "#{@page_heading} | MAVS.KR"
    @description = helpers.strip_tags(@article["summary"].presence || @article["content"]).squish.first(160)
    @canonical = helpers.site_url("/#{@kind}/#{ERB::Util.url_encode(@article['id'])}")
    @image_url = MediaArchive.local_url(helpers.safe_external_url(@article["imageUrl"]))
    @structured_data = { "@context" => "https://schema.org", "@type" => @kind == "news" ? "NewsArticle" : "Article", "headline" => @article["title"], "description" => @description, "mainEntityOfPage" => @canonical, "datePublished" => @article["date"].iso8601, "dateModified" => @article["updated"].iso8601, "inLanguage" => "ko", "publisher" => { "@type" => "Organization", "name" => "MAVS.KR", "url" => helpers.site_url } }
    @structured_data["author"] = { "@type" => "Person", "name" => @article["author"] } if @article["author"].present?
    @structured_data["image"] = @image_url.start_with?("/") ? helpers.site_url(@image_url) : @image_url if @image_url
    set_public_cache
  end

  def fan
    tab = string_param(:tab)
    origin = Rails.application.config.x.legacy_origin
    return unavailable if origin == Rails.application.config.x.site_url || origin == request.base_url
    suffix = tab.present? ? "?#{ { tab: tab }.to_query }" : ""
    response.headers["Cache-Control"] = "no-store"
    redirect_to("#{origin}/fan#{suffix}", allow_other_host: true, status: :temporary_redirect)
  end

  private
  def content_repository = @content_repository ||= ContentRepository.new
end
