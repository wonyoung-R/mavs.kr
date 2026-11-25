require_relative "boot"
require "rails"
require "action_controller/railtie"
require "action_view/railtie"
require "rails/test_unit/railtie"
Bundler.require(*Rails.groups)
Dotenv.load(File.expand_path("../.env.local", __dir__), File.expand_path("../../.env.local", __dir__)) unless ENV["RAILS_ENV"] == "test"

module MavsRuby
  class Application < Rails::Application
    config.load_defaults 8.1
    config.time_zone = "UTC"
    config.i18n.available_locales = [:ko, :en]
    config.i18n.default_locale = :ko
    config.cache_store = :file_store, File.expand_path("../tmp/cache", __dir__)
    config.action_controller.perform_caching = true
    config.filter_parameters += [:password, :token, :secret, :authorization, :database_url, :key, :q, :question, :prompt, :interpretation, :plan]
    config.session_store :cookie_store, key: "_mavs_records_session", same_site: :lax, httponly: true, secure: Rails.env.production?
    config.action_controller.forgery_protection_origin_check = true
    config.action_dispatch.cookies_same_site_protection = :lax
    config.action_dispatch.default_headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    config.action_dispatch.default_headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    config.action_dispatch.default_headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'"
    config.x.site_url = ENV.fetch("SITE_URL", "https://www.mavs.kr").delete_suffix("/")
    config.x.records_repository = nil
    # The old app continues serving authentication, authoring, admin and ingestion.
    config.x.legacy_origin = ENV.fetch("LEGACY_APP_ORIGIN", "http://127.0.0.1:3000").delete_suffix("/")
    config.secret_key_base = ENV.fetch("SECRET_KEY_BASE", "mavs-local-preview-only-" * 5) unless Rails.env.production?
  end
end
