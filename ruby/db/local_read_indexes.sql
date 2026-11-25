-- Review-only local restore: never apply this file to the Supabase source.
-- Covers DAL membership without reading the wide historical box-score heap.
DO $local_target_guard$
BEGIN
  IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() IS DISTINCT FROM 55432
     OR current_database() <> 'mavs_validation' THEN
    RAISE EXCEPTION 'This index is restricted to the isolated local validation database';
  END IF;
END
$local_target_guard$;

CREATE INDEX records_player_team_catalog_idx
  ON records.player_game_stats (release_id, team_id, player_id);
