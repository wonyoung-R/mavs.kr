-- Preserve the game's source starting position separately from advanced stats.
-- Existing immutable releases retain NULL; a new release publishes the source data.
ALTER TABLE records.player_game_stats
  ADD COLUMN IF NOT EXISTS starter_position text
  CHECK (starter_position IN ('G', 'F', 'C'));
