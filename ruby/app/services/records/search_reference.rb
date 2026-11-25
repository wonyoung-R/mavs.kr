# frozen_string_literal: true

require "securerandom"

module Records
  # The URL contains only a signed random reference, never the user's question.
  # A missing/expired reference cannot trigger another provider call.
  class SearchReference
    TTL = 7.days
    PURPOSE = "mavs-records-search-v1"
    class Invalid < StandardError; end

    def initialize(cache: Rails.cache, verifier: Rails.application.message_verifier(PURPOSE))
      @cache, @verifier = cache, verifier
    end

    def create(query:, plan:, release_id:)
      id = SecureRandom.hex(24)
      stored = @cache.write("search-reference-v1:#{id}", { "query" => query, "plan" => plan, "releaseId" => release_id }, expires_in: TTL)
      raise Invalid unless stored
      @verifier.generate(id, expires_in: TTL, purpose: PURPOSE)
    end

    def read(token)
      raise Invalid unless token.is_a?(String) && token.bytesize <= 2048
      id = @verifier.verified(token, purpose: PURPOSE)
      raise Invalid unless id.is_a?(String) && id.match?(/\A[0-9a-f]{48}\z/)
      value = @cache.read("search-reference-v1:#{id}")
      raise Invalid unless value.is_a?(Hash) && value["query"].is_a?(String) && value["plan"].is_a?(Hash) && value["releaseId"].is_a?(String)
      value
    end
  end
end
