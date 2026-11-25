import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PG_DUMP = '/opt/homebrew/opt/postgresql@17/bin/pg_dump';
const TRANSACTION_MS = 600_000;
export const CHECKSUM_ALGORITHM = 'md5(concat(sort-C(md5(to_jsonb(row)::text)))); ONLY physical rows; UTC; ISO dates; postgres intervals; hex bytea; extra_float_digits=3';

export class ExportError extends Error {
  constructor(code, stage = 'prepare') {
    super(`Export stopped (${stage}/${code}).`);
    this.code = code;
    this.stage = stage;
  }
}

export function safeFailure(error, stage = 'export') {
  if (error instanceof ExportError) return { status: 'failed', stage: error.stage, code: error.code };
  const sqlState = /^[A-Z0-9]{5}$/.test(error?.meta?.code ?? '') ? error.meta.code : undefined;
  return { status: 'failed', stage, code: 'EXPORT_FAILED', ...(sqlState ? { sqlState } : {}) };
}

export function parseArguments(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--plan')) return { run: false };
  if (args.length === 1 && args[0] === '--run') return { run: true };
  throw new ExportError('INVALID_ARGUMENTS');
}

export function postgresEnvironment(databaseUrl) {
  let url;
  try { url = new URL(databaseUrl); } catch { throw new ExportError('INVALID_DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username) throw new ExportError('INVALID_DATABASE_URL');
  let user, password, database;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch { throw new ExportError('INVALID_DATABASE_URL'); }
  if (!database || [user, password, database].some(value => value.includes('\0'))) throw new ExportError('INVALID_DATABASE_URL');
  const sslMode = url.searchParams.get('sslmode') ?? 'require';
  if (!['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(sslMode)) throw new ExportError('INVALID_SSL_MODE');
  // Deliberately do not inherit application secrets, PGSERVICE, PGOPTIONS, or PGPASSFILE.
  return {
    PATH: '/usr/bin:/bin:/opt/homebrew/bin', LANG: 'C',
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432',
    PGUSER: user, PGPASSWORD: password, PGDATABASE: database,
    PGSSLMODE: sslMode, PGCONNECT_TIMEOUT: '5', PGAPPNAME: 'mavs-readonly-export',
    PGOPTIONS: '-c default_transaction_read_only=on -c timezone=UTC',
  };
}

export function quoteIdentifier(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new ExportError('INVALID_IDENTIFIER');
  return `"${value.replaceAll('"', '""')}"`;
}

export function tableChecksumSql(schema, table) {
  // ONLY avoids counting partition children twice. Duplicate rows remain in the digest.
  return `SELECT count(*)::text AS rows, md5(COALESCE(string_agg(row_hash, '' ORDER BY row_hash COLLATE "C"), '')) AS checksum
    FROM (SELECT md5(to_jsonb(source_row)::text) AS row_hash FROM ONLY ${quoteIdentifier(schema)}.${quoteIdentifier(table)} AS source_row) AS hashed_rows`;
}

export function dumpArguments(snapshot) {
  if (!/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/.test(snapshot)) throw new ExportError('INVALID_SNAPSHOT', 'snapshot');
  // Custom archive goes to an exclusively opened FD; pg_dump never opens/overwrites a path.
  return ['--format=custom', '--no-owner', '--no-acl', '--no-password', '--lock-wait-timeout=5s', `--snapshot=${snapshot}`];
}

export async function hashFile(filename, algorithm = 'sha256') {
  const digest = createHash(algorithm);
  let bytes = 0;
  for await (const chunk of createReadStream(filename)) { bytes += chunk.length; digest.update(chunk); }
  return { bytes, [algorithm]: digest.digest('hex') };
}

async function writePrivateJson(filename, value) {
  const handle = await open(filename, 'wx', 0o600);
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); }
  finally { await handle.close(); }
}

export async function createExportDirectory(root = PROJECT_ROOT) {
  const parent = path.join(root, 'data/migrations');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const directory = path.join(parent, `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(6).toString('hex')}`);
  await mkdir(directory, { mode: 0o700 });
  await mkdir(path.join(directory, 'files'), { mode: 0o700 });
  return directory;
}

function startDump({ snapshot, environment, fd, stderrFd, timeoutMs, signal, binary = PG_DUMP }) {
  // Raw diagnostics stay in an exclusively opened 0600 file, never on the terminal.
  const child = spawn(binary, dumpArguments(snapshot), { env: environment, stdio: ['ignore', fd, stderrFd] });
  let timedOut = false;
  let killTimer;
  const stop = () => {
    child.kill('SIGTERM');
    killTimer ??= setTimeout(() => child.kill('SIGKILL'), 2_000);
  };
  const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  const aborted = () => stop();
  signal.addEventListener('abort', aborted, { once: true });
  if (signal.aborted) stop();
  return new Promise((resolve, reject) => {
    child.once('error', () => reject(new ExportError('DUMP_START_FAILED', 'dump')));
    child.once('close', code => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal.removeEventListener('abort', aborted);
      if (code === 0 && !signal.aborted && !timedOut) resolve();
      else reject(new ExportError(timedOut ? 'DUMP_TIMEOUT' : 'DUMP_FAILED', 'dump'));
    });
  });
}

export function storageFile(object, bucket) {
  if (!bucket || bucket.public !== true) throw new ExportError('STORAGE_LOGIN_REQUIRED', 'storage');
  if (typeof bucket.id !== 'string' || typeof object.name !== 'string' || !bucket.id || !object.name || object.bucket_id !== bucket.id) throw new ExportError('INVALID_STORAGE_METADATA', 'storage');
  const segments = [bucket.id, ...object.name.split('/')];
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('\0') || segment.includes('\\'))) throw new ExportError('UNSAFE_OBJECT_NAME', 'storage');
  const bytes = Number(object.metadata?.size);
  if (object.metadata?.size == null || !Number.isSafeInteger(bytes) || bytes < 0) throw new ExportError('UNKNOWN_OBJECT_SIZE', 'storage');
  const key = `${bucket.id}/${object.name}`;
  return {
    key, path: `files/${createHash('sha256').update(key).digest('hex')}`,
    public: true, contentType: object.metadata?.mimetype ?? 'application/octet-stream', bytes,
    objectId: object.id, version: object.version ?? null, metadata: object,
  };
}

export function storageUrl(baseUrl, key) {
  let url;
  try { url = new URL(baseUrl); } catch { throw new ExportError('INVALID_STORAGE_URL', 'storage'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new ExportError('INVALID_STORAGE_URL', 'storage');
  return `${url.origin}/storage/v1/object/public/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function downloadFile({ directory, file, baseUrl, signal, fetchImpl = fetch }) {
  const timeout = AbortSignal.timeout(120_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetchImpl(storageUrl(baseUrl, file.key), { redirect: 'manual', signal: requestSignal });
  const rejectResponse = async code => {
    await response.body?.cancel().catch(() => {});
    throw new ExportError(code, 'storage');
  };
  if ([401, 402, 403].includes(response.status)) return rejectResponse('STORAGE_LOGIN_OR_PAYMENT_REQUIRED');
  if (response.status >= 300 && response.status < 400) return rejectResponse('STORAGE_REDIRECT_REJECTED');
  if (!response.ok || !response.body) return rejectResponse('STORAGE_HTTP_FAILED');
  const responseType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (responseType === 'text/html' && file.contentType.split(';')[0].trim().toLowerCase() !== 'text/html') return rejectResponse('STORAGE_LOGIN_PAGE');
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) !== file.bytes) return rejectResponse('STORAGE_SIZE_MISMATCH');
  const expectedEtag = file.metadata?.metadata?.eTag ?? file.metadata?.metadata?.etag;
  const cleanEtag = value => typeof value === 'string' ? value.replace(/^W\//, '').replaceAll('"', '') : null;
  const expected = cleanEtag(expectedEtag), actual = cleanEtag(response.headers.get('etag'));
  if (expected && actual && expected !== actual) return rejectResponse('STORAGE_VERSION_CHANGED');
  const filename = path.join(directory, file.path);
  const handle = await open(filename, 'wx', 0o600);
  const sha = createHash('sha256'), md5 = createHash('md5');
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > file.bytes) throw new ExportError('STORAGE_SIZE_MISMATCH', 'storage');
      sha.update(chunk); md5.update(chunk);
      await handle.writeFile(chunk);
    }
    if (bytes !== file.bytes) throw new ExportError('STORAGE_SIZE_MISMATCH', 'storage');
    if (expected && /^[a-f0-9]{32}$/i.test(expected) && expected.toLowerCase() !== md5.digest('hex')) throw new ExportError('STORAGE_CONTENT_CHANGED', 'storage');
    await handle.sync();
  } finally { await handle.close(); }
  const sha256 = sha.digest('hex');
  const stored = await hashFile(filename);
  if (stored.bytes !== bytes || stored.sha256 !== sha256) throw new ExportError('STORAGE_READBACK_FAILED', 'storage');
  return { ...file, bytes, sha256, responseEtag: actual };
}

export async function downloadFiles({ files, directory, baseUrl, fetchImpl = fetch }) {
  const controller = new AbortController();
  let cursor = 0, failure;
  const results = new Array(files.length);
  const worker = async () => {
    while (!controller.signal.aborted && cursor < files.length) {
      const index = cursor++;
      try { results[index] = await downloadFile({ file: files[index], directory, baseUrl, fetchImpl, signal: controller.signal }); }
      catch (error) { failure ??= error; controller.abort(); }
    }
  };
  await Promise.all([worker(), worker()]);
  if (failure) throw failure;
  return results;
}

export async function exportSnapshot({ database, environment, directory, dumpImpl = startDump, progress = () => {} }) {
  const controller = new AbortController();
  let dumpResult, dumpPromise, dumpHandle, stderrHandle;
  let stage = 'snapshot';
  const started = Date.now();
  try {
    return await database.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '120000ms'");
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      await tx.$executeRawUnsafe("SET LOCAL datestyle = 'ISO, YMD'");
      await tx.$executeRawUnsafe("SET LOCAL intervalstyle = 'postgres'");
      await tx.$executeRawUnsafe("SET LOCAL bytea_output = 'hex'");
      await tx.$executeRawUnsafe('SET LOCAL extra_float_digits = 3');
      const [snapshot] = await tx.$queryRawUnsafe('SELECT pg_export_snapshot() AS snapshot, version() AS version, current_setting(\'transaction_read_only\') AS read_only');
      if (snapshot.read_only !== 'on') throw new ExportError('READONLY_REQUIRED', stage);
      const inventory = await tx.$queryRawUnsafe(`SELECT n.nspname AS schema, c.relname AS name, c.relkind::text AS kind
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p') AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
        ORDER BY n.nspname COLLATE "C", c.relname COLLATE "C"`);
      const buckets = (await tx.$queryRawUnsafe('SELECT to_jsonb(b) AS bucket FROM storage.buckets b ORDER BY id')).map(row => row.bucket);
      const objects = (await tx.$queryRawUnsafe('SELECT to_jsonb(o) AS object FROM storage.objects o ORDER BY bucket_id, name')).map(row => row.object);
      const byBucket = new Map(buckets.map(bucket => [bucket.id, bucket]));
      const files = objects.map(object => storageFile(object, byBucket.get(object.bucket_id)));
      if (new Set(files.map(file => file.path)).size !== files.length) throw new ExportError('DUPLICATE_STORAGE_OBJECT', 'storage');
      stage = 'dump';
      dumpHandle = await open(path.join(directory, 'database.dump'), 'wx', 0o600);
      stderrHandle = await open(path.join(directory, 'dump.stderr.log'), 'wx', 0o600);
      // Two source connections maximum: this snapshot/checksum reader and pg_dump.
      dumpPromise = dumpImpl({ snapshot: snapshot.snapshot, environment, fd: dumpHandle.fd, stderrFd: stderrHandle.fd, timeoutMs: Math.max(1, TRANSACTION_MS - (Date.now() - started)), signal: controller.signal })
        .then(result => { dumpResult = { result }; }, error => { dumpResult = { error }; });
      const tables = [];
      stage = 'checksums';
      for (const table of inventory) {
        if (dumpResult?.error) throw dumpResult.error;
        const [result] = await tx.$queryRawUnsafe(tableChecksumSql(table.schema, table.name));
        if (!/^\d+$/.test(result.rows) || !/^[a-f0-9]{32}$/.test(result.checksum)) throw new ExportError('INVALID_CHECKSUM_RESULT', stage);
        tables.push({ ...table, rows: result.rows, checksum: result.checksum });
        progress({ tablesCompleted: tables.length, tablesTotal: inventory.length });
      }
      stage = 'dump';
      await dumpPromise;
      if (dumpResult.error) throw dumpResult.error;
      await dumpHandle.sync();
      await stderrHandle.sync();
      const dumpDiagnostics = { path: 'dump.stderr.log', ...await hashFile(path.join(directory, 'dump.stderr.log')) };
      return { snapshot: snapshot.snapshot, databaseVersion: snapshot.version, tables, buckets, files, dumpDiagnostics };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: TRANSACTION_MS });
  } catch (error) {
    if (error instanceof ExportError) throw error;
    const failure = safeFailure(error, stage);
    const wrapped = new ExportError(failure.sqlState ? `SQLSTATE_${failure.sqlState}` : 'DATABASE_READ_FAILED', stage);
    throw wrapped;
  } finally {
    controller.abort();
    if (dumpPromise) await dumpPromise;
    if (dumpHandle) await dumpHandle.close();
    if (stderrHandle) await stderrHandle.close();
  }
}

export async function runExport({ databaseUrl, storageBaseUrl, root = PROJECT_ROOT, database: injectedDatabase, dumpImpl, fetchImpl, progress }) {
  const environment = postgresEnvironment(databaseUrl);
  storageUrl(storageBaseUrl, 'validation/object');
  const directory = await createExportDirectory(root);
  const database = injectedDatabase ?? new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
  let stage = 'snapshot';
  try {
    const snapshot = await exportSnapshot({ database, environment, directory, dumpImpl, progress });
    stage = 'storage';
    const files = await downloadFiles({ files: snapshot.files, directory, baseUrl: storageBaseUrl, fetchImpl });
    stage = 'manifest';
    const dump = { path: 'database.dump', ...await hashFile(path.join(directory, 'database.dump')) };
    if (dump.bytes < 5) throw new ExportError('EMPTY_DUMP', 'dump');
    const handle = await open(path.join(directory, 'database.dump'), 'r');
    try {
      const signature = Buffer.alloc(5);
      await handle.read(signature, 0, 5, 0);
      if (signature.toString() !== 'PGDMP') throw new ExportError('INVALID_DUMP', 'dump');
    } finally { await handle.close(); }
    const manifest = {
      version: 1, status: 'complete', createdAt: new Date().toISOString(),
      checksumAlgorithm: CHECKSUM_ALGORITHM,
      consistency: { database: 'shared REPEATABLE READ snapshot', storage: 'snapshot metadata; public bytes verified by size and available ETag; SHA256 and disk readback', sequenceValues: 'PostgreSQL sequences are not MVCC snapshot-consistent' },
      snapshot: snapshot.snapshot, databaseVersion: snapshot.databaseVersion,
      dump, tables: snapshot.tables, buckets: snapshot.buckets, files,
      dumpDiagnostics: snapshot.dumpDiagnostics,
      limits: { snapshotTransactionMs: TRANSACTION_MS, checksumStatementMs: 120_000, dumpProcessMs: TRANSACTION_MS, storageConcurrency: 2 },
    };
    await writePrivateJson(path.join(directory, 'manifest.json'), manifest);
    const manifestDigest = await hashFile(path.join(directory, 'manifest.json'));
    return { directory, manifest, summary: { status: 'complete', tables: manifest.tables.length, rows: manifest.tables.reduce((sum, table) => sum + BigInt(table.rows), 0n).toString(), buckets: manifest.buckets.length, files: files.length, storageBytes: files.reduce((sum, file) => sum + file.bytes, 0), dumpBytes: dump.bytes, dumpSha256: dump.sha256, manifestSha256: manifestDigest.sha256 } };
  } catch (error) {
    await writePrivateJson(path.join(directory, 'failure.json'), safeFailure(error, stage)).catch(() => {});
    throw error;
  } finally { if (!injectedDatabase) await database.$disconnect(); }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!args.run) {
    process.stdout.write(`${JSON.stringify({ status: 'plan', sourceWrites: 0, snapshotTransactionSeconds: 600, checksumStatementSeconds: 120, storageConcurrency: 2, executeRequiresRunFlag: true })}\n`);
    return;
  }
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local'), quiet: true });
  const result = await runExport({ databaseUrl: process.env.DATABASE_URL, storageBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, progress: counts => process.stdout.write(`${JSON.stringify(counts)}\n`) });
  process.stdout.write(`${JSON.stringify(result.summary)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${JSON.stringify(safeFailure(error))}\n`); process.exitCode = 1; });
}
