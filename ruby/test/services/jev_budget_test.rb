# frozen_string_literal: true

require_relative "../test_helper"
require "tmpdir"

class JevBudgetTest < ActiveSupport::TestCase
  setup do
    @directory = Dir.mktmpdir("mavs-budget-test")
    @path = File.join(@directory, "budget.json")
    @now = Time.utc(2026, 10, 7, 12)
  end
  teardown { FileUtils.remove_entry(@directory) }
  def budget(**options) = Records::JevBudget.new(path: @path, clock: -> { @now }, **options)
  def reserve(instance, actor = "one") = instance.reserve!(input_bytes: 100, actor: actor)

  test "global daily reservations survive instances failures and time windows" do
    first = budget(daily_requests: 2)
    id = reserve(first)
    first.release!(id)
    second = budget(daily_requests: 2)
    second.release!(reserve(second, "two"))
    @now += 120
    assert_raises(Records::JevBudget::Exhausted) { reserve(second) }
    @now += 1.day
    assert reserve(second)
  end

  test "bytes per actor and concurrent limits all fail before dispatch" do
    assert_raises(Records::JevBudget::Exhausted) { reserve(budget(daily_input: 2100)) }
    limited = budget(per_minute: 1, concurrent: 1)
    id = reserve(limited)
    assert_raises(Records::JevBudget::Exhausted) { reserve(limited, "two") }
    limited.release!(id)
    assert_raises(Records::JevBudget::Exhausted) { reserve(limited) }
    assert reserve(limited, "two")
    @now += 61
    assert reserve(limited)
  end

  test "parallel processes cannot overspend global reservation limit" do
    readers = 6.times.map do |i|
      reader, writer = IO.pipe
      pid = fork do
        reader.close
        begin
          instance = budget(daily_requests: 2, concurrent: 20)
          reserve(instance, i.to_s)
          writer.write("reserved")
        rescue Records::JevBudget::Exhausted
          writer.write("denied")
        ensure
          writer.close
        end
        exit! 0
      end
      writer.close
      [reader, pid]
    end
    outcomes = readers.map { |reader, pid| value = reader.read; reader.close; Process.wait(pid); value }
    assert_equal 2, outcomes.count("reserved")
    assert_equal 4, outcomes.count("denied")
  end

  test "corruption fails closed instead of resetting a budget" do
    File.write(@path, '{"requests":0}')
    assert_raises(Records::JevBudget::Exhausted) { reserve(budget) }
    File.write(@path, "bad JSON")
    assert_raises(Records::JevBudget::Exhausted) { reserve(budget) }
  end
end
