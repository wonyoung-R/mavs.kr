# frozen_string_literal: true

# Invoked by the Node parity runner with an explicit isolated restore URI.
# No Rails boot or dotenv loading: the production/source URL cannot be selected.
require "bundler/setup"
require "json"
require "uri"
require "active_support"
require "active_support/cache"
require_relative "../app/services/records/query"
require_relative "../app/services/records/repository"

begin
  uri = URI.parse(ENV.fetch("LOCAL_RECORDS_DATABASE_URL"))
  unless %w[postgres postgresql].include?(uri.scheme) && %w[127.0.0.1 localhost].include?(uri.host) && uri.port == 55_432 && uri.path == "/mavs_validation"
    raise ArgumentError, "ISOLATED_LOCAL_DATABASE_REQUIRED"
  end
  database = Records::Database.new(url: uri.to_s)
  repository = Records::Repository.new(database: database, cache: ActiveSupport::Cache::MemoryStore.new(size: 32 * 1024 * 1024))
  input = JSON.parse($stdin.read)
  results = input.fetch("cases").map do |item|
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    args = item.fetch("args")
    begin
      result = case item.fetch("method")
      when "catalog"
        repository.catalog(release_id: args["releaseId"])
      when "scope"
        repository.scope(**args.transform_keys { |key| key.gsub(/([A-Z])/, '_\1').downcase.to_sym })
      when "leaderboard"
        repository.leaderboard(args)
      when "comparison"
        repository.comparison(args)
      when "query"
        repository.query(args.fetch("text"), release_id: args["releaseId"])
      else
        raise ArgumentError, "UNKNOWN_COMPARISON_METHOD"
      end
      { "name" => item.fetch("name"), "result" => result, "elapsedMs" => ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round }
    rescue StandardError => error
      # Do not leak query text, credentials or raw database diagnostics to stdout.
      failure = { "class" => error.class.name }
      failure["sqlState"] = error.sql_state if error.respond_to?(:sql_state)
      { "name" => item.fetch("name"), "result" => nil, "error" => failure, "elapsedMs" => ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round }
    end
  end
  $stdout.write(JSON.generate(results))
rescue StandardError
  $stderr.puts(JSON.generate({ "status" => "failed", "code" => "RUBY_PARITY_FAILED" }))
  exit 1
end
