class LegacyController < ApplicationController
  PATHS = %r{\A/(?:login|auth(?:/|$)|profile(?:/|$)|admin(?:/|$)|api(?:/|$)|archive(?:/|$)|(?:community|comm|column|analysis)/(?:new|members|[^/]+/edit)(?:/|$)|sitemap-page)}
  def forward
    return not_found unless request.path.match?(PATHS)
    origin = Rails.application.config.x.legacy_origin
    return unavailable if origin == Rails.application.config.x.site_url || origin == request.base_url
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    redirect_to("#{origin}#{request.fullpath}", allow_other_host: true, status: :temporary_redirect)
  end
end
