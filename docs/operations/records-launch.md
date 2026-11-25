# MAVS.KR records launch — 2026-11-13

Public homepage `/`; Korean archive `/stat`, English `/stat/en`. Historical paths redirect with query strings. Current-season records use public factual ESPN schedule/boxscore JSON, without copying article text or media.

## Collection and publication

`GET /api/cron/update-records` requires an exact `Authorization: Bearer <CRON_SECRET>` header; missing/short secret fails closed. Vercel runs daily at 07:30 and 11:30 UTC (16:30/20:30 Korea). The season is September–August, so the season starting in 2026 is stored as `2026`. Explicit CLI recovery: `npm run records:sync -- 2026`, with **RECORDS_WRITER_DATABASE_URL** set privately.

Every run rescans the season's regular/postseason schedules and completed boxscores, retaining corrections. Scheduled, in-progress and preseason games are excluded. NBA Cup final is excluded from regular-season totals; group games are not duplicated. ESPN Play-In events explicitly labeled in postseason data are classified separately; an upstream change to season types requires adapter review.

Full source responses are gzip-compressed in `records.source_responses`, SHA-256 checked, and deduplicated. `records.sync_runs` preserves source URLs/hashes and player-ID mapping evidence. DNP values remain null; numeric zero is retained. Both teams and player points must agree with final scores. Ambiguous new players receive namespaced ESPN identities.

The historical snapshot is immutable. Migration 003 renames physical tables to `_storage` and exposes compatible views through `release_layers`. Each logical release reuses the historical base and the latest snapshot of each subsequent season. It stores only the changed season. Readers pin logical `r_…` releases. Never write through the views or run the old `database.mjs import` after migration 003. The historical read/verify commands remain usable.

A lease prevents overlapping collectors. Publication is transactional and protected by an advisory lock. Missing boxscores, source access denial, inconsistent points, lost previously published games, and storage-budget violations preserve the current release. Identical basketball content returns the same release; retrieval clocks do not create snapshots. Publication stops at the 450 MiB application budget, below the platform free DB ceiling; raw evidence stops earlier at 440 MiB.

## Credentials and restore

Server environment variables:

- DATABASE_URL: application role for restored public application tables.
- RECORDS_DATABASE_URL: dedicated read-only archive role.
- RECORDS_WRITER_DATABASE_URL: records-only writer role, used by authenticated collection.
- CRON_SECRET: existing Vercel cron secret, at least 16 characters.

Never put writer URLs, backup files, raw data or local recovery folders in public assets. `.vercelignore` excludes them. Root private recovery credentials are under ignored `data/migrations/production-recovery/`, mode 600.

The 2026-11-13 recovery used a new MAVS-specific free project in Seoul, restoring historical/public tables from the verified local backup. This did not restore writes made only to the then-inaccessible former project after that backup. Retain the private pre-launch dump.

On 2026-11-15, the original project was reachable and the records schema was consolidated from `ztlqbnmfppcndprmenti` into `nycoldtrqbkevvgoajlq`. Production/local records reader and writer URLs now use the latter; the general application DATABASE_URL still uses the former. Source records and application data remain intact, and the source records writer is fenced. See [the consolidation report](records-consolidation-2026-11-15.md) for validation, rollout, rollback boundaries and the existing coverage endpoint limitation.

For a records rollback, use a verified prior `records.releases.id` and atomically update `records.current_release.release_id` using the administrator connection. Do not delete snapshots: pinned API responses must remain reproducible. For application rollback, promote the recorded prior Vercel deployment. Data and app rollback are separate operations.

## Verification checklist

Compare schedule-completed count, collected games and both team sides. Test current and pinned historical searches, season/game/player pages, English archive, home mobile layout, unauthorized collection (401), authenticated sync, unchanged rerun and source-failure preservation. Verify anonymous Supabase roles have no records table/schema access, archive reader cannot write, writer cannot access public user data. Record production deployment/release IDs in the private deployment report.
