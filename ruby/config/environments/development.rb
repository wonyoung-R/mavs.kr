Rails.application.configure do
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = false
  config.server_timing = true
  config.log_level = :info
  config.public_file_server.enabled = true
end
