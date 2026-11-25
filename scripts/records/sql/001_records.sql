-- MAVS.KR historical records. Additive and isolated from public application tables.
-- Execute only via database.mjs apply --apply against the verified project.
CREATE SCHEMA IF NOT EXISTS records;
-- statement-breakpoint
REVOKE ALL ON SCHEMA records FROM PUBLIC;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.releases (
  id text PRIMARY KEY,
  content_sha256 text NOT NULL UNIQUE CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  dataset_version integer NOT NULL CHECK (dataset_version = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  counts jsonb NOT NULL,
  input_bytes bigint NOT NULL CHECK (input_bytes >= 0)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.current_release (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  release_id text NOT NULL REFERENCES records.releases(id),
  published_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.sources (
  release_id text NOT NULL REFERENCES records.releases(id),
  id text NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  transform_version text NOT NULL,
  rights jsonb NOT NULL,
  PRIMARY KEY (release_id, id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.source_artifacts (
  release_id text NOT NULL REFERENCES records.releases(id),
  id text NOT NULL,
  source_id text,
  url text,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  retrieved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (release_id, id),
  FOREIGN KEY (release_id, source_id) REFERENCES records.sources(release_id, id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.teams (
  release_id text NOT NULL REFERENCES records.releases(id),
  id text NOT NULL,
  abbreviation text NOT NULL,
  name text NOT NULL,
  name_ko text NOT NULL,
  aliases jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (release_id, id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.players (
  release_id text NOT NULL REFERENCES records.releases(id),
  id text NOT NULL,
  name text NOT NULL,
  name_ko text NOT NULL,
  aliases jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (release_id, id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.games (
  release_id text NOT NULL REFERENCES records.releases(id),
  id text NOT NULL,
  season integer NOT NULL CHECK (season BETWEEN 1980 AND 2100),
  competition text NOT NULL CHECK (competition IN ('regular','playoffs','playin','cup_final','preseason','summer')),
  date date NOT NULL,
  tipoff_utc timestamptz,
  home_team_id text NOT NULL,
  away_team_id text NOT NULL CHECK (away_team_id <> home_team_id),
  neutral boolean,
  status text NOT NULL CHECK (status IN ('final','scheduled','postponed','cancelled')),
  home_score integer CHECK (home_score >= 0),
  away_score integer CHECK (away_score >= 0),
  source_id text NOT NULL,
  source_game_id text NOT NULL,
  cup boolean NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (release_id, id),
  UNIQUE (release_id, source_id, source_game_id),
  FOREIGN KEY (release_id, home_team_id) REFERENCES records.teams(release_id, id),
  FOREIGN KEY (release_id, away_team_id) REFERENCES records.teams(release_id, id),
  FOREIGN KEY (release_id, source_id) REFERENCES records.sources(release_id, id),
  CHECK (status <> 'final' OR (home_score IS NOT NULL AND away_score IS NOT NULL AND home_score <> away_score))
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.player_game_stats (
  release_id text NOT NULL REFERENCES records.releases(id),
  game_id text NOT NULL,
  team_id text NOT NULL,
  player_id text NOT NULL,
  participation text NOT NULL CHECK (participation IN ('played','dnp','inactive','unknown')),
  starter boolean,
  reason text,
  pts integer CHECK (pts >= 0), reb integer CHECK (reb >= 0), ast integer CHECK (ast >= 0),
  stl integer CHECK (stl >= 0), blk integer CHECK (blk >= 0), tov integer CHECK (tov >= 0),
  pf integer CHECK (pf >= 0), fgm integer CHECK (fgm >= 0), fga integer CHECK (fga >= 0),
  fg3m integer CHECK (fg3m >= 0), fg3a integer CHECK (fg3a >= 0),
  ftm integer CHECK (ftm >= 0), fta integer CHECK (fta >= 0),
  oreb integer CHECK (oreb >= 0), dreb integer CHECK (dreb >= 0),
  plus_minus integer, min_seconds integer CHECK (min_seconds >= 0),
  source_id text NOT NULL,
  advanced jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (release_id, game_id, player_id),
  FOREIGN KEY (release_id, game_id) REFERENCES records.games(release_id, id),
  FOREIGN KEY (release_id, team_id) REFERENCES records.teams(release_id, id),
  FOREIGN KEY (release_id, player_id) REFERENCES records.players(release_id, id),
  FOREIGN KEY (release_id, source_id) REFERENCES records.sources(release_id, id),
  CHECK (fgm <= fga AND fg3m <= fg3a AND fg3m <= fgm AND fg3a <= fga AND ftm <= fta),
  CHECK (oreb + dreb = reb),
  CHECK (fgm * 2 + fg3m + ftm = pts),
  CHECK (participation NOT IN ('dnp','inactive') OR num_nonnulls(pts,reb,ast,stl,blk,tov,pf,fgm,fga,fg3m,fg3a,ftm,fta,oreb,dreb,plus_minus,min_seconds) = 0)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.team_game_stats (
  release_id text NOT NULL REFERENCES records.releases(id),
  game_id text NOT NULL,
  team_id text NOT NULL,
  pts integer CHECK (pts >= 0), reb integer CHECK (reb >= 0), ast integer CHECK (ast >= 0),
  stl integer CHECK (stl >= 0), blk integer CHECK (blk >= 0), tov integer CHECK (tov >= 0),
  pf integer CHECK (pf >= 0), fgm integer CHECK (fgm >= 0), fga integer CHECK (fga >= 0),
  fg3m integer CHECK (fg3m >= 0), fg3a integer CHECK (fg3a >= 0),
  ftm integer CHECK (ftm >= 0), fta integer CHECK (fta >= 0),
  oreb integer CHECK (oreb >= 0), dreb integer CHECK (dreb >= 0),
  plus_minus integer, min_seconds integer CHECK (min_seconds >= 0),
  team_rebounds integer CHECK (team_rebounds >= 0),
  team_turnovers integer CHECK (team_turnovers >= 0),
  source_id text NOT NULL,
  advanced jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (release_id, game_id, team_id),
  FOREIGN KEY (release_id, game_id) REFERENCES records.games(release_id, id),
  FOREIGN KEY (release_id, team_id) REFERENCES records.teams(release_id, id),
  FOREIGN KEY (release_id, source_id) REFERENCES records.sources(release_id, id),
  CHECK (fgm <= fga AND fg3m <= fg3a AND fg3m <= fgm AND fg3a <= fga AND ftm <= fta),
  CHECK (oreb + dreb = reb),
  CHECK (fgm * 2 + fg3m + ftm = pts)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.coverage (
  release_id text NOT NULL REFERENCES records.releases(id),
  season integer NOT NULL,
  competition text NOT NULL,
  dataset text NOT NULL CHECK (dataset IN ('games','playerStats','teamStats')),
  field text NOT NULL,
  expected integer CHECK (expected >= 0),
  observed integer NOT NULL CHECK (observed >= 0),
  status text NOT NULL CHECK (status IN ('unverified','partial','complete')),
  evidence text NOT NULL,
  PRIMARY KEY (release_id, season, competition, dataset, field),
  CHECK (observed <= expected),
  CHECK (status <> 'complete' OR (expected IS NOT NULL AND expected = observed AND length(trim(evidence)) > 0))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS records_games_season_idx ON records.games (release_id, season, competition, date DESC, id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS records_player_history_idx ON records.player_game_stats (release_id, player_id, game_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS records_team_history_idx ON records.team_game_stats (release_id, team_id, game_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS records_player_points_idx ON records.player_game_stats (release_id, team_id, pts DESC NULLS LAST) WHERE participation = 'played';
-- statement-breakpoint
-- No direct PostgREST access: server uses the existing DATABASE_URL connection.
DO $security$
DECLARE role_name text; table_name text;
BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA records FROM %I', role_name);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA records FROM %I', role_name);
  END LOOP;
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'records' LOOP
    EXECUTE format('ALTER TABLE records.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$security$;
-- statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA records FROM PUBLIC;
-- statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA records REVOKE ALL ON TABLES FROM PUBLIC;
