# frozen_string_literal: true

module Records
  class Lineup
    ROLE_ORDER = { "Starter" => 0, "Bench" => 1, "Unknown" => 2, "DNP" => 3, "Inactive" => 3 }.freeze
    POSITION_ORDER = { "G" => 0, "F" => 1, "C" => 2 }.freeze

    def self.organize(rows)
      starters = rows.select { |row| row["starter"] == true }
      lineup_known = starters.length == 5 && starters.all? { |row| row["participation"] == "played" }
      organized = rows.map do |row|
        role = case row["participation"]
        when "dnp" then "DNP"
        when "inactive" then "Inactive"
        else
          if !lineup_known || row["participation"] != "played"
            "Unknown"
          else
            row["starter"] ? "Starter" : "Bench"
          end
        end
        { "row" => row, "role" => role }
      end
      organized = organized.each_with_index.sort_by do |item, index|
        row = item["row"]
        position = item["role"] == "Starter" ? POSITION_ORDER.fetch(row["starterPosition"], 3) : 0
        minutes = row.dig("values", "MIN_SECONDS")
        [ROLE_ORDER.fetch(item["role"]), position, -(minutes.nil? ? -1 : minutes), row["playerId"], index]
      end.map(&:first)
      { "lineupKnown" => lineup_known, "rows" => organized }
    end
  end
end
