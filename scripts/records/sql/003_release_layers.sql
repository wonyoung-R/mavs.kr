-- Apply once, in one transaction, after 001/002. Data and foreign keys stay intact.
CREATE TABLE records.release_layers (
  published_release_id text NOT NULL REFERENCES records.releases(id),
  storage_release_id text NOT NULL REFERENCES records.releases(id),
  priority integer NOT NULL,
  season integer CHECK (season BETWEEN 1980 AND 2100),
  PRIMARY KEY (published_release_id, storage_release_id),
  UNIQUE (published_release_id, priority)
);
-- statement-breakpoint
CREATE UNIQUE INDEX records_release_layer_season_idx ON records.release_layers(published_release_id, season) WHERE season IS NOT NULL;
-- statement-breakpoint
INSERT INTO records.release_layers(published_release_id,storage_release_id,priority) SELECT id,id,0 FROM records.releases;
-- statement-breakpoint
DO $layers$
DECLARE tbl text; projection text; reader text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['sources','teams','players','games','player_game_stats','team_game_stats','coverage','source_artifacts'] LOOP
    EXECUTE format('ALTER TABLE records.%I RENAME TO %I',tbl,tbl||'_storage');
    SELECT string_agg(CASE WHEN a.attname='release_id' THEN 'l.published_release_id AS release_id' ELSE format('s.%I',a.attname) END,', ' ORDER BY a.attnum)
      INTO projection FROM pg_attribute a WHERE a.attrelid=format('records.%I',tbl||'_storage')::regclass AND a.attnum>0 AND NOT a.attisdropped;
    IF tbl IN ('sources','teams','players','source_artifacts') THEN
      EXECUTE format('CREATE VIEW records.%I AS SELECT DISTINCT ON (l.published_release_id,s.id) %s FROM records.release_layers l JOIN records.%I s ON s.release_id=l.storage_release_id ORDER BY l.published_release_id,s.id,l.priority DESC',tbl,projection,tbl||'_storage');
    ELSE
      EXECUTE format('CREATE VIEW records.%I AS SELECT %s FROM records.release_layers l JOIN records.%I s ON s.release_id=l.storage_release_id',tbl,projection,tbl||'_storage');
    END IF;
    EXECUTE format('REVOKE ALL ON records.%I FROM PUBLIC',tbl);
    -- Preserve only existing SELECT grants. Never broaden anon/authenticated access.
    FOR reader IN SELECT rolname FROM pg_roles WHERE rolname NOT IN ('anon','authenticated','service_role') AND NOT rolsuper AND has_table_privilege(oid,format('records.%I',tbl||'_storage'),'SELECT') LOOP
      EXECUTE format('GRANT SELECT ON records.%I TO %I',tbl,reader);
    END LOOP;
  END LOOP;
END
$layers$;
-- statement-breakpoint
ALTER TABLE records.release_layers ENABLE ROW LEVEL SECURITY;
-- statement-breakpoint
REVOKE ALL ON records.release_layers FROM PUBLIC;
