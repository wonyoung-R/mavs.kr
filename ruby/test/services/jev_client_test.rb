# frozen_string_literal: true

require_relative "../test_helper"
require "tmpdir"

class JevClientTest < ActiveSupport::TestCase
  QUESTIONS = { "stat" => { "type" => "choice", "criteria" => { "PTS" => "Points", "AST" => "Assists" } } }.freeze
  RESPONSE = { model: "jev-1.13.0", answers: { stat: { type: "choice", choice: "PTS", confidence: 0.9, probabilities: { PTS: 0.9, AST: 0.1 } } } }.to_json.freeze

  setup do
    @directory = Dir.mktmpdir("mavs-jev-test")
    @budget = Records::JevBudget.new(path: File.join(@directory, "budget.json"))
    @calls = []
  end

  teardown { FileUtils.remove_entry(@directory) }

  def client(status: 200, body: RESPONSE, **options)
    Records::JevClient.new(key: "apikey_synthetic_not_a_credential", budget: @budget, transport: ->(payload) { @calls << JSON.parse(payload); [status, body] }, **options)
  end

  test "fixed choice request returns bounded JSON and reserves input before dispatch" do
    answer = client.evaluate(state: { question: "Dirk points" }, questions: QUESTIONS)
    assert_equal "PTS", answer.dig("answers", "stat", "choice")
    assert_equal "jev-1.13.0", @calls.first["model"]
    assert_equal QUESTIONS, @calls.first["questions"]
    refute_includes @calls.first.to_json, "apikey_"
    ledger = JSON.parse(File.read(File.join(@directory, "budget.json")))
    assert_equal 1, ledger["requests"]
    assert_operator ledger["input"], :>, @calls.first.to_json.bytesize
    assert_empty ledger["inflight"]
    assert_equal 0o600, File.stat(File.join(@directory, "budget.json")).mode & 0o777
  end

  test "upstream errors are sanitized and never retried or refunded" do
    [401, 402, 429, 500].each do |status|
      error = assert_raises(Records::JevClient::Unavailable) { client(status: status, body: "sensitive provider body").evaluate(state: "Dirk points", questions: QUESTIONS) }
      refute_includes error.message, "sensitive"
    end
    assert_equal 4, @calls.size
    assert_equal 4, JSON.parse(File.read(File.join(@directory, "budget.json")))["requests"]
  end

  test "malformed response oversized payload and secrets fail closed" do
    assert_raises(Records::JevClient::Unavailable) { client(body: "not json").evaluate(state: "Dirk points", questions: QUESTIONS) }
    assert_raises(Records::JevClient::Unavailable) { client.evaluate(state: "x" * 50_000, questions: QUESTIONS) }
    ["my email is fan@example.com", "apikey_synthetic_not_a_credential", "010-1234-5678", "０１００００００００", "password=example"].each do |state|
      error = assert_raises(Records::JevClient::Unavailable) { client.evaluate(state: state, questions: QUESTIONS) }
      assert_equal "sensitive_input", error.code
    end
    assert_equal 1, @calls.size
  end

  test "missing credentials and excessive choices do not dispatch" do
    error = assert_raises(Records::JevClient::Unavailable) do
      Records::JevClient.new(key: nil, budget: @budget, transport: ->(*) { flunk "No request permitted" }).evaluate(state: "Dirk", questions: QUESTIONS)
    end
    assert_equal "missing_key", error.code
    huge = { "bad" => { "type" => "choice", "criteria" => 256.times.to_h { |i| [i.to_s, i.to_s] } } }
    assert_raises(Records::JevClient::Unavailable) { client.evaluate(state: "Dirk", questions: huge) }
    assert_empty @calls
  end

  test "timeout consumes its reservation and frees its inflight slot" do
    transport = ->(*) { raise Net::ReadTimeout }
    timed = Records::JevClient.new(key: "apikey_test", budget: @budget, transport: transport)
    assert_equal "timeout", assert_raises(Records::JevClient::Unavailable) { timed.evaluate(state: "Dirk", questions: QUESTIONS) }.code
    ledger = JSON.parse(File.read(File.join(@directory, "budget.json")))
    assert_equal 1, ledger["requests"]
    assert_empty ledger["inflight"]
  end

  test "malformed HTTP responses cannot expose upstream text through exception causes" do
    transport = ->(*) { raise Net::HTTPBadResponse, "SYNTHETIC_PRIVATE_STATUS_LINE" }
    malformed = Records::JevClient.new(key: "apikey_test", budget: @budget, transport: transport)
    error = assert_raises(Records::JevClient::Unavailable) { malformed.evaluate(state: "Dirk", questions: QUESTIONS) }
    assert_equal "provider_error", error.code
    assert_nil error.cause
    refute_includes error.full_message, "SYNTHETIC_PRIVATE_STATUS_LINE"
  end
end
