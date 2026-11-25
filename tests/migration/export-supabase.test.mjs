import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeSync } from 'node:fs';
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseArguments, postgresEnvironment, dumpArguments, tableChecksumSql, storageFile, storageUrl, createExportDirectory, downloadFile, downloadFiles, runExport, safeFailure, ExportError } from '../../scripts/migration/export-supabase.mjs';

const databaseUrl = 'postgresql://reader%2Bunit:private%24%2B%40pass@db.example.test:5432/example?schema=records&connection_limit=2&pool_timeout=5&sslmode=require';
const baseUrl = 'https://storage.example.test';
const content = Buffer.from('MAVS fixture content');
const checksum = algorithm => createHash(algorithm).update(content).digest('hex');
const bucket = { id: 'public-images', public: true, name: 'public-images' };
function object(name = '선수/Dirk #41.png') {
  return { id: 'object-1', bucket_id: bucket.id, name, metadata: { size: content.length, mimetype: 'image/png', eTag: checksum('md5') } };
}
const response = () => new Response(content, { headers: { 'content-length': String(content.length), 'content-type': 'image/png', etag: `"${checksum('md5')}"` } });
async function temporaryDirectory() { return createExportDirectory(await mkdtemp(path.join(os.tmpdir(), 'mavs-export-test-'))); }

test('CLI is a no-network plan unless the exact --run flag is supplied', () => {
  assert.deepEqual(parseArguments([]), { run: false });
  assert.deepEqual(parseArguments(['--plan']), { run: false });
  assert.deepEqual(parseArguments(['--run']), { run: true });
  for (const args of [['--run', '--run'], ['--source', databaseUrl], ['--force']]) assert.throws(() => parseArguments(args), /INVALID_ARGUMENTS/);
});

test('pg_dump uses decoded PG environment credentials and contains none in argv', () => {
  const environment = postgresEnvironment(databaseUrl);
  assert.equal(environment.PGUSER, 'reader+unit');
  assert.equal(environment.PGPASSWORD, 'private$+@pass');
  assert.equal(environment.PGHOST, 'db.example.test');
  assert.equal(environment.PGSSLMODE, 'require');
  assert.equal(environment.PGOPTIONS, '-c default_transaction_read_only=on -c timezone=UTC');
  assert.equal(environment.PGSERVICE, undefined);
  assert.equal(environment.PGPASSFILE, undefined);
  assert.equal(environment.DATABASE_URL, undefined);
  const args = dumpArguments('00000003-000001A4-1');
  assert.ok(args.includes('--format=custom'));
  assert.ok(args.includes('--snapshot=00000003-000001A4-1'));
  assert.ok(args.includes('--no-password'));
  assert.ok(!JSON.stringify(args).includes('private'));
  assert.ok(!JSON.stringify(environment).includes('schema='));
  assert.throws(() => dumpArguments('x;DROP TABLE users'), /INVALID_SNAPSHOT/);
  assert.throws(() => postgresEnvironment('https://example.test'), /INVALID_DATABASE_URL/);
});

test('checksum quotes identifiers, sorts with C collation, and counts duplicate physical rows', () => {
  const sql = tableChecksumSql('odd"schema', 'table; DROP SCHEMA public;--');
  assert.ok(sql.includes('FROM ONLY "odd""schema"."table; DROP SCHEMA public;--"'));
  assert.ok(sql.includes('ORDER BY row_hash COLLATE "C"'));
  assert.ok(!sql.includes('DISTINCT'));
  assert.ok(sql.includes("COALESCE(string_agg(row_hash, ''"));
});

test('storage paths are deterministic safe digests and public URLs encode every original segment', () => {
  const file = storageFile(object(), bucket);
  assert.match(file.path, /^files\/[a-f0-9]{64}$/);
  assert.equal(file.key, 'public-images/선수/Dirk #41.png');
  assert.equal(file.path, storageFile(object(), bucket).path);
  assert.notEqual(file.path, storageFile(object('different.png'), bucket).path);
  assert.equal(storageUrl(baseUrl, file.key), 'https://storage.example.test/storage/v1/object/public/public-images/%EC%84%A0%EC%88%98/Dirk%20%2341.png');
  for (const name of ['../secret', 'a/../../secret', '/secret', 'a\\secret']) assert.throws(() => storageFile(object(name), bucket), /UNSAFE_OBJECT_NAME/);
  assert.throws(() => storageFile(object(), { ...bucket, public: false }), /LOGIN_REQUIRED/);
  assert.throws(() => storageFile({ ...object(), metadata: {} }, bucket), /UNKNOWN_OBJECT_SIZE/);
  assert.throws(() => storageUrl('http://storage.example.test', file.key), /INVALID_STORAGE_URL/);
});

test('successful public download validates snapshot ETag, size, SHA256, disk bytes and private modes', async () => {
  const directory = await temporaryDirectory();
  let request;
  const file = await downloadFile({ directory, file: storageFile(object(), bucket), baseUrl, fetchImpl: async (url, options) => { request = { url, options }; return response(); } });
  assert.equal(file.bytes, content.length);
  assert.equal(file.sha256, checksum('sha256'));
  assert.equal(request.options.redirect, 'manual');
  assert.equal(request.options.headers, undefined);
  assert.deepEqual(await readFile(path.join(directory, file.path)), content);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(path.join(directory, file.path))).mode & 0o777, 0o600);
  await assert.rejects(() => downloadFile({ directory, file: storageFile(object(), bucket), baseUrl, fetchImpl: async () => response() }), { code: 'EEXIST' });
});

test('login, payment, redirects and unexpected login HTML stop without creating an object file', async () => {
  const directory = await temporaryDirectory();
  for (const status of [401, 402, 403, 302]) {
    await assert.rejects(() => downloadFile({ directory, file: storageFile(object(), bucket), baseUrl, fetchImpl: async () => new Response('', { status, headers: { location: 'https://login.example.test' } }) }), ExportError);
  }
  await assert.rejects(() => downloadFile({ directory, file: storageFile(object(), bucket), baseUrl, fetchImpl: async () => new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }) }), /STORAGE_LOGIN_PAGE/);
  assert.deepEqual(await readdir(path.join(directory, 'files')), []);
});

test('snapshot changes and oversized or incomplete responses fail validation', async () => {
  const directory = await temporaryDirectory();
  const file = storageFile(object(), bucket);
  await assert.rejects(() => downloadFile({ directory, file, baseUrl, fetchImpl: async () => new Response(content, { headers: { etag: 'changed' } }) }), /STORAGE_VERSION_CHANGED/);
  await assert.rejects(() => downloadFile({ directory, file, baseUrl, fetchImpl: async () => new Response(content, { headers: { 'content-length': '9999' } }) }), /STORAGE_SIZE_MISMATCH/);
  await assert.rejects(() => downloadFile({ directory, file, baseUrl, fetchImpl: async () => new Response('short') }), /STORAGE_SIZE_MISMATCH/);
  const second = storageFile(object('different.png'), bucket);
  await assert.rejects(() => downloadFile({ directory, file: second, baseUrl, fetchImpl: async () => new Response(Buffer.alloc(content.length, 'x')) }), /STORAGE_CONTENT_CHANGED/);
});

test('download concurrency is exactly bounded at two and failure stops scheduling new files', async () => {
  const directory = await temporaryDirectory();
  const files = Array.from({ length: 5 }, (_, index) => storageFile(object(`${index}.png`), bucket));
  let active = 0, maximum = 0;
  const results = await downloadFiles({ directory, files, baseUrl, fetchImpl: async () => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return response();
  } });
  assert.equal(maximum, 2);
  assert.equal(results.length, 5);
  let requested = 0;
  await assert.rejects(() => downloadFiles({ directory, files, baseUrl, fetchImpl: async () => { requested++; return new Response('', { status: 403 }); } }), /LOGIN_OR_PAYMENT_REQUIRED/);
  assert.equal(requested, 2);
});

function databaseFixture({ failChecksum = false } = {}) {
  const calls = [];
  let active = false;
  return {
    calls, get active() { return active; },
    async $transaction(callback, options) {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      assert.equal(options.timeout, 600_000);
      active = true;
      try { return await callback({
        async $executeRawUnsafe(sql) { calls.push(sql); return 0; },
        async $queryRawUnsafe(sql) {
          calls.push(sql);
          if (sql.includes('pg_export_snapshot')) return [{ snapshot: '00000003-000001A4-1', version: 'PostgreSQL fixture', read_only: 'on' }];
          if (sql.includes('FROM pg_class')) return [{ schema: 'public', name: 'fixtures', kind: 'r' }];
          if (sql.includes('FROM storage.buckets')) return [{ bucket }];
          if (sql.includes('FROM storage.objects')) return [{ object: object() }];
          if (failChecksum) throw Object.assign(new Error('secret-user-data password'), { meta: { code: '57014' } });
          return [{ rows: '2', checksum: 'd41d8cd98f00b204e9800998ecf8427e' }];
        },
      }); } finally { active = false; }
    },
  };
}

test('export shares one live read-only snapshot with dump and writes complete private manifest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mavs-export-integration-'));
  const database = databaseFixture();
  let suppliedSnapshot;
  const result = await runExport({ root, databaseUrl, storageBaseUrl: baseUrl, database,
    dumpImpl: async ({ snapshot, fd, environment, signal, timeoutMs }) => {
      assert.equal(database.active, true);
      assert.equal(signal.aborted, false);
      assert.ok(timeoutMs <= 600_000);
      assert.equal(environment.PGUSER, 'reader+unit');
      suppliedSnapshot = snapshot;
      writeSync(fd, Buffer.from('PGDMP fixture custom archive'));
      return { stderrSha256: 'fixture-digest' };
    },
    fetchImpl: async () => { assert.equal(database.active, false); return response(); },
  });
  assert.equal(result.manifest.snapshot, suppliedSnapshot);
  assert.equal(result.summary.tables, 1);
  assert.equal(result.summary.rows, '2');
  assert.equal(result.summary.files, 1);
  assert.equal(result.summary.storageBytes, content.length);
  assert.equal(result.manifest.files[0].sha256, checksum('sha256'));
  assert.equal(result.manifest.files[0].public, true);
  assert.equal(result.manifest.tables[0].schema, 'public');
  assert.equal(database.calls[0], 'SET TRANSACTION READ ONLY');
  assert.ok(database.calls.includes("SET LOCAL statement_timeout = '120000ms'"));
  assert.ok(database.calls.every(sql => /^(SET|SELECT)/.test(sql)));
  const manifest = await readFile(path.join(result.directory, 'manifest.json'), 'utf8');
  assert.equal(JSON.parse(manifest).status, 'complete');
  assert.ok(!manifest.includes('private$'));
  assert.equal((await stat(path.join(result.directory, 'manifest.json'))).mode & 0o777, 0o600);
  assert.equal((await stat(path.join(result.directory, 'database.dump'))).mode & 0o777, 0o600);
});

test('checksum failure aborts dump, leaves no success manifest and logs no raw data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mavs-export-failure-'));
  const database = databaseFixture({ failChecksum: true });
  let aborted = false;
  await assert.rejects(() => runExport({ root, databaseUrl, storageBaseUrl: baseUrl, database,
    dumpImpl: ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new ExportError('DUMP_FAILED', 'dump')); }, { once: true });
    }),
    fetchImpl: async () => { assert.fail('No download after failed snapshot'); },
  }), /SQLSTATE_57014/);
  assert.equal(aborted, true);
  const parent = path.join(root, 'data/migrations');
  const [name] = await readdir(parent);
  const children = await readdir(path.join(parent, name));
  assert.ok(!children.includes('manifest.json'));
  const failure = await readFile(path.join(parent, name, 'failure.json'), 'utf8');
  assert.ok(failure.includes('SQLSTATE_57014'));
  assert.ok(!failure.includes('secret-user-data'));
  assert.deepEqual(safeFailure(new Error(databaseUrl)), { status: 'failed', stage: 'export', code: 'EXPORT_FAILED' });
});
