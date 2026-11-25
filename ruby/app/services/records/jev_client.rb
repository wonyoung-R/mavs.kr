# frozen_string_literal: true

require "net/http"
require "json"
require "timeout"
require "openssl"

module Records
  class JevClient
    ENDPOINT = URI("https://api.typesafe.ai/v1/systemone").freeze
    MAX_REQUEST_BYTES = 49_152
    MAX_RESPONSE_BYTES = 131_072

    class Unavailable < StandardError
      attr_reader :code
      def initialize(code = "provider_error")
        @code = code.to_s
        super("Natural-language interpretation is unavailable (#{@code}).")
      end
    end

    def self.with_actor(ip)
      previous = ActiveSupport::IsolatedExecutionState[:jev_actor]
      ActiveSupport::IsolatedExecutionState[:jev_actor] = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, ip.to_s)
      yield
    ensure
      ActiveSupport::IsolatedExecutionState[:jev_actor] = previous
    end

    attr_reader :model

    def initialize(key: ENV["JEV_KEY"].presence || ENV["TYPESAFE_API_KEY"], model: ENV.fetch("JEV_MODEL", "jev-1.13.0"), budget: JevBudget.new, transport: nil)
      @key, @model, @budget = key, model, budget
      @transport = transport || method(:post)
    end

    def available?
      ENV["JEV_ENABLED"] != "false" && @key.is_a?(String) && @key.match?(/\Aapikey_[A-Za-z0-9_-]+\z/) && @model.match?(/\Ajev-[A-Za-z0-9.\-]+\z/)
    end

    def evaluate(state:, questions:)
      raise Unavailable.new("disabled") if ENV["JEV_ENABLED"] == "false"
      raise Unavailable.new("missing_key") unless available?
      validate_questions!(questions)
      payload = JSON.generate({ state: state, model: @model, questions: questions })
      raise Unavailable.new("request_too_large") if payload.bytesize > MAX_REQUEST_BYTES
      raise Unavailable.new("sensitive_input") if sensitive?(JSON.generate(state))
      reservation = @budget.reserve!(input_bytes: payload.bytesize, actor: ActiveSupport::IsolatedExecutionState[:jev_actor] || "local")
      status, body = Timeout.timeout(8) { @transport.call(payload) }
      code = { 401 => "auth_required", 402 => "payment_required", 403 => "auth_required", 429 => "rate_limited" }[status.to_i]
      raise Unavailable.new(code || "provider_error") unless status.to_i == 200
      raise Unavailable.new("invalid_response") unless body.is_a?(String) && body.bytesize <= MAX_RESPONSE_BYTES
      parsed = JSON.parse(body)
      raise Unavailable.new("invalid_response") unless parsed.is_a?(Hash) && parsed["answers"].is_a?(Hash) && parsed["model"].is_a?(String)
      parsed
    rescue JevBudget::Exhausted
      raise Unavailable.new("budget_exhausted"), cause: nil
    rescue Timeout::Error, Net::OpenTimeout, Net::ReadTimeout
      raise Unavailable.new("timeout"), cause: nil
    rescue JSON::ParserError, JSON::GeneratorError
      raise Unavailable.new("invalid_response"), cause: nil
    rescue SocketError, SystemCallError, IOError, OpenSSL::SSL::SSLError, Net::HTTPBadResponse, Net::HTTPHeaderSyntaxError, Net::ProtocolError
      raise Unavailable.new("provider_error"), cause: nil
    ensure
      # Losing the release only keeps a slot busy until expiry; no extra calls.
      begin
        @budget.release!(reservation) if reservation
      rescue JevBudget::Exhausted
        nil
      end
    end

    private

    def validate_questions!(questions)
      raise Unavailable.new("invalid_request") unless questions.is_a?(Hash) && questions.size.between?(1, 32)
      questions.each_value do |question|
        raise Unavailable.new("invalid_request") unless question.is_a?(Hash)
        type = question["type"] || question[:type]
        choices = question["criteria"] || question[:criteria]
        raise Unavailable.new("invalid_request") unless type == "choice" && choices.is_a?(Hash) && choices.size.between?(2, 255)
      end
    end

    def sensitive?(text)
      text.unicode_normalize(:nfkc).match?(/apikey_|Bearer\s+[a-z\d._-]{12,}|\bsk-[a-z\d_-]{12,}|[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}|(?:\+?82[- .]?)?01[016789][- .]?\d{3,4}[- .]?\d{4}|(?:password|비밀번호)\s*[:=]/i)
    end

    def post(payload)
      # No environment proxy, redirect following, or automatic retry with a key.
      http = Net::HTTP.new(ENDPOINT.host, ENDPOINT.port, nil)
      http.use_ssl = true
      http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      http.open_timeout, http.read_timeout, http.write_timeout = 3, 6, 3
      http.max_retries = 0
      request = Net::HTTP::Post.new(ENDPOINT.request_uri)
      request["Authorization"] = "Bearer #{@key}"
      request["Content-Type"] = "application/json"
      request["Accept"] = "application/json"
      request.body = payload
      status, body = nil, +""
      http.start do |connection|
        connection.request(request) do |response|
          status = response.code.to_i
          response.read_body do |chunk|
            raise Unavailable.new("invalid_response") if body.bytesize + chunk.bytesize > MAX_RESPONSE_BYTES
            body << chunk
          end
        end
      end
      [status, body]
    end
  end
end
