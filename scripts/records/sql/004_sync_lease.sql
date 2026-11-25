CREATE TABLE IF NOT EXISTS records.sync_leases (name text PRIMARY KEY, expires_at timestamptz NOT NULL);
-- statement-breakpoint
ALTER TABLE records.sync_leases ENABLE ROW LEVEL SECURITY;
-- statement-breakpoint
REVOKE ALL ON records.sync_leases FROM PUBLIC, anon, authenticated;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.source_responses (sha256 text PRIMARY KEY CHECK(sha256 ~ '^[a-f0-9]{64}$'),url text NOT NULL,retrieved_at timestamptz NOT NULL,body_gzip bytea NOT NULL);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS records.sync_runs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,season integer NOT NULL,release_id text NOT NULL REFERENCES records.releases(id),report jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
-- statement-breakpoint
ALTER TABLE records.source_responses ENABLE ROW LEVEL SECURITY;
-- statement-breakpoint
ALTER TABLE records.sync_runs ENABLE ROW LEVEL SECURITY;
-- statement-breakpoint
REVOKE ALL ON records.source_responses,records.sync_runs FROM PUBLIC, anon, authenticated;
-- statement-breakpoint
