import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import * as validationModule from '../../src/lib/records/validation.ts';
import * as connectionModule from '../../src/lib/records/connection.ts';
const validateRecordDataset = validationModule.validateRecordDataset ?? validationModule.default?.validateRecordDataset;
const getRecordsDatabaseUrl = connectionModule.getRecordsDatabaseUrl ?? connectionModule.default?.getRecordsDatabaseUrl;
const getRecordsWriterDatabaseUrl = connectionModule.getRecordsWriterDatabaseUrl ?? connectionModule.default?.getRecordsWriterDatabaseUrl;

const MEGABYTE = 1024 * 1024;
const STATS = ['PTS','REB','AST','STL','BLK','TOV','PF','FGM','FGA','FG3M','FG3A','FTM','FTA','OREB','DREB','PLUS_MINUS','MIN_SECONDS'];
const statColumns = STATS.map(key => `${key.toLowerCase()} integer`).join(', ');
// Identifiers below are a fixed allowlist, never derived from CLI or dataset input.
const TABLES = {
  sources: 'id text, name text, url text, retrieved_at timestamptz, transform_version text, rights jsonb',
  teams: 'id text, abbreviation text, name text, name_ko text, aliases jsonb, metadata jsonb',
  players: 'id text, name text, name_ko text, aliases jsonb, metadata jsonb',
  games: 'id text, season integer, competition text, date date, tipoff_utc timestamptz, home_team_id text, away_team_id text, neutral boolean, status text, home_score integer, away_score integer, source_id text, source_game_id text, cup boolean, metadata jsonb',
  player_game_stats: `game_id text, team_id text, player_id text, participation text, starter boolean, starter_position text, reason text, ${statColumns}, source_id text, advanced jsonb`,
  team_game_stats: `game_id text, team_id text, ${statColumns}, team_rebounds integer, team_turnovers integer, source_id text, advanced jsonb`,
  coverage: 'season integer, competition text, dataset text, field text, expected integer, observed integer, status text, evidence text',
  source_artifacts: 'id text, source_id text, url text, sha256 text, byte_size bigint, retrieved_at timestamptz, metadata jsonb',
};
const COUNT_NAMES = { sources:'sources',teams:'teams',players:'players',games:'games',player_game_stats:'playerStats',team_game_stats:'teamStats',coverage:'coverage' };
const MIGRATIONS = ['001_records.sql', '002_lineup_position.sql'];
class RecordsError extends Error {}

function databaseFailure(error, stage) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'unknown';
  const state = typeof error?.meta?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.meta.code) ? error.meta.code : 'unknown';
  return new RecordsError(`Records database operation failed at ${stage} (client ${code}, SQLSTATE ${state}). No query values or credentials were logged.`);
}

export function prepareDataset(dataset) {
  const checked = validateRecordDataset(dataset);
  if (!checked.valid) throw new RecordsError(`Dataset validation failed (${checked.errors.length}): ${checked.errors.slice(0, 8).join('; ')}`);
  if (!dataset.games.length) throw new RecordsError('Refusing to publish an empty release.');
  if (dataset.corrections!==undefined&&(!Array.isArray(dataset.corrections)||dataset.corrections.some(item=>!item||typeof item.gameId!=='string'||typeof item.field!=='string'||!Object.hasOwn(item,'previous')||!Object.hasOwn(item,'replacement')||!item.evidence||!item.reason))) throw new RecordsError('Corrections require a game, field, original/replacement values, evidence and reason.');
  const content = JSON.stringify(dataset);
  const sha256 = createHash('sha256').update(content).digest('hex');
  return { dataset, sha256, releaseId: `r_${sha256.slice(0, 24)}`, bytes: Buffer.byteLength(content),
    counts: Object.fromEntries(Object.values(COUNT_NAMES).map(key => [key, dataset[key].length])) };
}

export function databaseRows(table, rows) {
  if (!TABLES[table]) throw new RecordsError('Unknown records table.');
  return rows.map(row => {
    const result = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === 'values') for (const stat of STATS) result[stat.toLowerCase()] = value[stat];
      else result[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] = value;
    }
    if (table==='teams'||table==='players'||table==='games') {
      const known=new Set(TABLES[table].split(',').map(column=>column.trim().split(' ')[0]));
      result.metadata={...(row.metadata||{})};
      for (const [key,value] of Object.entries(row)) if (!known.has(key.replace(/[A-Z]/g,letter=>`_${letter.toLowerCase()}`))) result.metadata[key]=value;
    }
    if (table==='player_game_stats'||table==='team_game_stats') {
      const advanced=row.advanced??{};
      if (!advanced||Array.isArray(advanced)||typeof advanced!=='object'||Object.values(advanced).some(value=>value!==null&&(typeof value!=='number'||!Number.isFinite(value)))) throw new RecordsError('Advanced statistics must contain only finite numbers or null.');
      result.advanced=advanced;
    }
    return result;
  });
}

export function assertBudget(currentBytes, inputBytes, maxDbMb = 450, maxAddedMb = 150, estimatedAddedMb) {
  if (![currentBytes,inputBytes,maxDbMb,maxAddedMb].every(Number.isFinite) || currentBytes < 0 || inputBytes < 0 || maxDbMb <= 0 || maxAddedMb <= 0) throw new RecordsError('Invalid database budget.');
  // Includes index/row overhead; physical size is checked again before publication.
  if (estimatedAddedMb !== undefined && (!Number.isFinite(estimatedAddedMb) || estimatedAddedMb <= 0)) throw new RecordsError('Invalid storage estimate.');
  const estimatedAddedBytes = estimatedAddedMb === undefined ? inputBytes * 2 : estimatedAddedMb * MEGABYTE;
  if (estimatedAddedBytes > maxAddedMb * MEGABYTE || currentBytes + estimatedAddedBytes > maxDbMb * MEGABYTE) throw new RecordsError('Database size budget exceeded; import stopped without starting a write.');
  return estimatedAddedBytes;
}

export async function databaseCheck(db) {
  const [row] = await db.$queryRaw`SELECT pg_database_size(current_database())::text AS database_bytes, to_regclass('records.releases')::text AS releases_table, current_schema() AS connection_schema`;
  return { databaseBytes: Number(row.database_bytes), schemaInstalled: Boolean(row.releases_table), connectionSchema: row.connection_schema };
}

export async function assertLegacySchemaWritable(db) {
  const [row] = await db.$queryRaw`SELECT to_regclass('records.release_layers')::text AS release_layers_table`;
  if (row?.release_layers_table) throw new RecordsError('Legacy apply/import commands do not support the layered records schema. Use the current season-sync pipeline; no data was changed.');
}

async function insertBatch(db, table, releaseId, rows, checkSize) {
  const definition = TABLES[table];
  if (!definition) throw new RecordsError('Unknown records table.');
  const names = definition.split(',').map(column => column.trim().split(' ')[0]).join(', ');
  for (let offset = 0; offset < rows.length; offset += 1000) {
    const payload = JSON.stringify(databaseRows(table, rows.slice(offset, offset + 1000)));
    try {
      await db.$executeRaw(Prisma.sql`INSERT INTO ${Prisma.raw(`records.${table}`)} (release_id, ${Prisma.raw(names)}) SELECT ${releaseId}, ${Prisma.raw(names)} FROM jsonb_to_recordset(${payload}::jsonb) AS item(${Prisma.raw(definition)})`);
    } catch (error) { throw databaseFailure(error, `insert ${table} batch ${Math.floor(offset / 1000) + 1}`); }
    if (checkSize && ((offset / 1000 + 1) % 10 === 0 || offset + 1000 >= rows.length)) await checkSize();
  }
}

export async function verifyRelease(db, releaseId) {
  const [release] = await db.$queryRaw`SELECT id, counts, content_sha256 FROM records.releases WHERE id = ${releaseId}`;
  if (!release) throw new RecordsError('Release not found.');
  const counts = {};
  for (const [table, key] of Object.entries(COUNT_NAMES)) {
    const [row] = await db.$queryRaw(Prisma.sql`SELECT count(*)::integer AS total FROM ${Prisma.raw(`records.${table}`)} WHERE release_id = ${releaseId}`);
    counts[key] = row.total;
    if (counts[key] !== release.counts[key]) throw new RecordsError(`Release row count mismatch: ${key}`);
  }
  // A just-inserted release has no planner statistics yet. Set comparisons avoid
  // a misestimated nested loop that rescans every game for every statistics row.
  const [scoreMismatch] = await db.$queryRaw`
    WITH expected_sides AS MATERIALIZED (
      SELECT id AS game_id,home_team_id AS team_id,home_score AS pts FROM records.games WHERE release_id=${releaseId}
      UNION ALL SELECT id,away_team_id,away_score FROM records.games WHERE release_id=${releaseId}
    )
    SELECT count(*)::integer AS total FROM (
      SELECT game_id,team_id,pts FROM records.team_game_stats WHERE release_id=${releaseId}
      EXCEPT (
        SELECT game_id,team_id,pts FROM expected_sides
        UNION ALL SELECT game_id,team_id,NULL::integer FROM expected_sides
      )
    ) invalid`;
  const [playerMismatch] = await db.$queryRaw`
    WITH expected_sides AS MATERIALIZED (
      SELECT id AS game_id,home_team_id AS team_id FROM records.games WHERE release_id=${releaseId}
      UNION ALL SELECT id,away_team_id FROM records.games WHERE release_id=${releaseId}
    )
    SELECT count(*)::integer AS total FROM (
      SELECT game_id,team_id FROM records.player_game_stats WHERE release_id=${releaseId}
      EXCEPT SELECT game_id,team_id FROM expected_sides
    ) invalid`;
  if (scoreMismatch.total || playerMismatch.total) throw new RecordsError('Release has score or game-side mismatches.');
  const [access] = await db.$queryRaw`SELECT count(*)::integer AS total FROM pg_roles r CROSS JOIN pg_tables t WHERE r.rolname IN ('anon','authenticated') AND t.schemaname='records' AND (has_schema_privilege(r.rolname,'records','USAGE') OR has_table_privilege(r.rolname,quote_ident(t.schemaname)||'.'||quote_ident(t.tablename),'SELECT,INSERT,UPDATE,DELETE'))`;
  if (access.total) throw new RecordsError('Record tables are accessible to a public API role.');
  return { releaseId, sha256: release.content_sha256, counts, verified: true };
}

export async function importRelease(db, prepared, options = {}) {
  const before = await databaseCheck(db);
  if (!before.schemaInstalled) throw new RecordsError('Apply the records schema before importing.');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(937226541)::text`;
    await assertLegacySchemaWritable(tx);
    const [existing] = await tx.$queryRaw`SELECT id FROM records.releases WHERE content_sha256=${prepared.sha256}`;
    if (existing) return { ...await verifyRelease(tx, existing.id), imported: false };
    const estimatedAddedBytes = assertBudget(before.databaseBytes, prepared.bytes, options.maxDbMb, options.maxAddedMb, options.estimatedAddedMb);
    const checkSize = async () => {
      const current = await databaseCheck(tx);
      if (current.databaseBytes > (options.maxDbMb ?? 450) * MEGABYTE || current.databaseBytes - before.databaseBytes > (options.maxAddedMb ?? 150) * MEGABYTE) throw new RecordsError('Physical database size budget exceeded; transaction rolled back.');
      return current;
    };
    await tx.$executeRaw`INSERT INTO records.releases (id,content_sha256,dataset_version,counts,input_bytes) VALUES (${prepared.releaseId},${prepared.sha256},1,${JSON.stringify(prepared.counts)}::jsonb,${prepared.bytes})`;
    for (const [table, key] of Object.entries(COUNT_NAMES)) await insertBatch(tx, table, prepared.releaseId, prepared.dataset[key], checkSize);
    await insertBatch(tx, 'source_artifacts', prepared.releaseId, [{ id:'normalized-dataset',source_id:null,url:null,sha256:prepared.sha256,byte_size:prepared.bytes,retrieved_at:null,metadata:{ kind:'validated-normalized-dataset',version:1,correctionCount:prepared.dataset.corrections?.length??0,corrections:prepared.dataset.corrections??[] } },...(prepared.dataset.sourceArtifacts || [])], checkSize);
    // Publish only after the planner can see the distribution of the new release.
    // Fixed identifiers; no dataset or CLI text is executable SQL.
    await tx.$executeRawUnsafe('ANALYZE records.releases, records.sources, records.teams, records.players, records.games, records.player_game_stats, records.team_game_stats, records.coverage, records.source_artifacts');
    let verified;
    try { verified = await verifyRelease(tx, prepared.releaseId); }
    catch (error) { throw error instanceof RecordsError ? error : databaseFailure(error, 'verify imported release'); }
    const [lineup] = await tx.$queryRaw`SELECT count(*)::integer AS total FROM records.player_game_stats WHERE release_id=${prepared.releaseId} AND starter_position IS NOT NULL`;
    if (lineup.total !== prepared.dataset.playerStats.filter(row => row.starterPosition != null).length) throw new RecordsError('Source starting positions were not preserved.');
    const after = await checkSize();
    await tx.$executeRaw`INSERT INTO records.current_release (singleton,release_id) VALUES (true,${prepared.releaseId}) ON CONFLICT (singleton) DO UPDATE SET release_id=EXCLUDED.release_id,published_at=now()`;
    await tx.$executeRawUnsafe('ANALYZE records.current_release');
    return { ...verified, imported:true, databaseBytes:after.databaseBytes, estimatedAddedBytes };
  }, { maxWait: 30000, timeout: 600000 });
}

export function parseArguments(argv) {
  const [command = 'check', ...args] = argv;
  if (!['check','apply','import','verify'].includes(command)) throw new RecordsError('Use check, apply, import or verify.');
  const options = { command, write:false, input:'data/records/normalized/dataset.json',maxDbMb:450,maxAddedMb:150 };
  for (let i=0; i<args.length; i++) {
    const arg=args[i];
    if ((arg==='--apply'&&command==='apply')||(arg==='--import'&&command==='import')) options.write=true;
    else if (arg==='--input'&&args[i+1]) options.input=args[++i];
    else if (arg==='--max-db-mb'&&args[i+1]) options.maxDbMb=Number(args[++i]);
    else if (arg==='--max-added-mb'&&args[i+1]) options.maxAddedMb=Number(args[++i]);
    else if (arg==='--estimated-added-mb'&&args[i+1]) options.estimatedAddedMb=Number(args[++i]);
    else if (arg==='--release'&&args[i+1]) options.release=args[++i];
    else throw new RecordsError(`Unsupported argument: ${arg.split('=')[0]}`);
  }
  if (![options.maxDbMb,options.maxAddedMb].every(value=>Number.isFinite(value)&&value>0)) throw new RecordsError('Budget limits must be positive numbers.');
  if (options.estimatedAddedMb !== undefined && (!Number.isFinite(options.estimatedAddedMb) || options.estimatedAddedMb <= 0)) throw new RecordsError('Storage estimate must be a positive number.');
  return options;
}

async function main() {
  const options=parseArguments(process.argv.slice(2));
  if (options.command==='apply'&&!options.write) { console.log(JSON.stringify({status:'dry-run',schema:'records',migrations:MIGRATIONS,write:false}));return; }
  const prepared=options.command==='import'?prepareDataset(JSON.parse(await readFile(path.resolve(options.input),'utf8'))):null;
  if (prepared&&!options.write) { console.log(JSON.stringify({status:'valid',write:false,releaseId:prepared.releaseId,counts:prepared.counts,bytes:prepared.bytes}));return; }
  dotenv.config({path:'.env.local',quiet:true});
  const url = options.write ? getRecordsWriterDatabaseUrl() : getRecordsDatabaseUrl();
  if (!url) throw new RecordsError(`${options.write ? 'RECORDS_WRITER_DATABASE_URL' : 'RECORDS_DATABASE_URL'} is required. App database fallback is disabled.`);
  const db = new PrismaClient({datasources:{db:{url}},log:[]});
  try {
    let result;
    if (options.command==='check') result=await databaseCheck(db);
    if (options.command==='apply') {
      const migrations=await Promise.all(MIGRATIONS.map(file=>readFile(new URL(`./sql/${file}`,import.meta.url),'utf8')));
      // Only the fixed, checked-in additive migrations are executable. No CLI SQL input.
      await db.$transaction(async tx=>{
        await tx.$executeRaw`SET LOCAL lock_timeout = '5000ms'`;
        await assertLegacySchemaWritable(tx);
        for (const migration of migrations) for (const statement of migration.split('-- statement-breakpoint').map(value=>value.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      },{timeout:120000});
      result={applied:true,...await databaseCheck(db)};
    }
    if (options.command==='import') result=await importRelease(db,prepared,options);
    if (options.command==='verify') {
      const [current]=options.release?[{release_id:options.release}]:await db.$queryRaw`SELECT release_id FROM records.current_release WHERE singleton=true`;
      if (!current) throw new RecordsError('No published release exists.');
      result=await verifyRelease(db,current.release_id);
    }
    console.log(JSON.stringify(result));
  } finally { await db.$disconnect(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error=>{
    // Prisma errors can include connection strings or SQL values: never log them.
    const code=typeof error?.code==='string'?error.code:null;
    const safe=error instanceof RecordsError?error.message:code?`Records database operation failed (${code}). No credentials were logged.`:'Records database operation failed. Check input, arguments and database access; no internal error details were logged.';
    console.error(safe);process.exitCode=1;
  });
}
