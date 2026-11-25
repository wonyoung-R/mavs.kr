# frozen_string_literal: true

require "json"
require "fileutils"
require "securerandom"
require "digest"

module Records
  # A single-server ledger shared by every Puma worker. Reservations are never
  # refunded: a timeout can still have been processed by the upstream provider.
  class JevBudget
    class Exhausted < StandardError; end

    def initialize(path: ENV.fetch("JEV_BUDGET_PATH") { Rails.root.join("tmp/private/jev-budget.json") }, clock: -> { Time.now },
                   daily_requests: ENV.fetch("JEV_DAILY_REQUEST_LIMIT", "40").to_i,
                   daily_input: ENV.fetch("JEV_DAILY_INPUT_LIMIT", "250000").to_i,
                   per_minute: 5, concurrent: 2)
      @path, @clock = path.to_s, clock
      @daily_requests = daily_requests.clamp(0, 1000)
      @daily_input = daily_input.clamp(0, 5_000_000)
      @per_minute, @concurrent = per_minute, concurrent
    end

    def reserve!(input_bytes:, actor:)
      raise Exhausted unless input_bytes.is_a?(Integer) && input_bytes.positive?
      reservation = SecureRandom.hex(16)
      update do |ledger, now|
        # Bytes plus framing allowance deliberately overestimate tokenizer input.
        charge = input_bytes + 2048
        identity = Digest::SHA256.hexdigest(actor.to_s)
        recent = ledger["recent"].count { |event| event[0] == identity }
        raise Exhausted if ledger["requests"] >= @daily_requests || ledger["input"] + charge > @daily_input || recent >= @per_minute || ledger["inflight"].size >= @concurrent
        ledger["requests"] += 1
        ledger["input"] += charge
        ledger["recent"] << [identity, now.to_i]
        ledger["inflight"][reservation] = now.to_i + 15
      end
      reservation
    end

    def release!(reservation)
      update { |ledger, _now| ledger["inflight"].delete(reservation) }
    end

    private

    def update
      FileUtils.mkdir_p(File.dirname(@path), mode: 0o700)
      File.open(@path, File::RDWR | File::CREAT, 0o600) do |file|
        file.flock(File::LOCK_EX)
        file.chmod(0o600)
        raise Exhausted if file.size > 1_000_000
        raw = file.read
        now = @clock.call.utc
        ledger = raw.empty? ? fresh(now) : JSON.parse(raw)
        validate!(ledger)
        ledger = fresh(now) if ledger["day"] != now.strftime("%Y-%m-%d")
        ledger["recent"].select! { |event| event[1] > now.to_i - 60 }
        ledger["inflight"].select! { |_id, expires| expires > now.to_i }
        yield ledger, now
        file.rewind
        file.write(JSON.generate(ledger))
        file.truncate(file.pos)
        file.flush
        file.fsync
      end
    rescue SystemCallError, IOError, JSON::ParserError, TypeError, ArgumentError
      raise Exhausted
    end

    def fresh(now)
      { "day" => now.strftime("%Y-%m-%d"), "requests" => 0, "input" => 0, "recent" => [], "inflight" => {} }
    end

    def validate!(ledger)
      raise Exhausted unless ledger.is_a?(Hash) && ledger["day"].is_a?(String) && ledger["day"].match?(/\A\d{4}-\d{2}-\d{2}\z/) &&
        %w[requests input].all? { |key| ledger[key].is_a?(Integer) && ledger[key] >= 0 } &&
        ledger["recent"].is_a?(Array) && ledger["recent"].all? { |event| event.is_a?(Array) && event.size == 2 && event[0].is_a?(String) && event[1].is_a?(Integer) } &&
        ledger["inflight"].is_a?(Hash) && ledger["inflight"].values.all? { |value| value.is_a?(Integer) }
    end
  end
end
