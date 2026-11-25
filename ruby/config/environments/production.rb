Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.force_ssl = true
  config.assume_ssl = ENV["TRUST_PROXY_SSL"] == "1"
  config.log_level = :warn
  config.public_file_server.enabled = true
  config.public_file_server.headers = { "Cache-Control" => "public, max-age=86400" }
  config.hosts = [URI(Rails.application.config.x.site_url).host]
  config.secret_key_base = ENV.fetch("SECRET_KEY_BASE")
end
