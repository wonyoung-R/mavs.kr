class HealthController < ActionController::Base
  def show
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    render json: { status: "ok", application: "mavs-ruby" }
  end
end
