import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecordsDatabaseUrl, getRecordsWriterDatabaseUrl, RECORDS_SUPABASE_PROJECT_REF } from '../../src/lib/records/connection';
import { getRecordsPrisma } from '../../src/lib/records/database';
import { NextRequest } from 'next/server';
import { GET as collectRecords } from '../../src/app/api/cron/update-records/route';

const target = `postgresql://mavs_records_reader.${RECORDS_SUPABASE_PROJECT_REF}:fixture-secret@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`;
const previous = 'postgresql://mavs_records_reader.ztlqbnmfppcndprmenti:fixture-secret@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

test('records reads and writes require their own URL, even if an application URL exists', () => {
  assert.equal(getRecordsDatabaseUrl({ DATABASE_URL: previous }), undefined);
  assert.equal(getRecordsWriterDatabaseUrl({ DATABASE_URL: previous, RECORDS_DATABASE_URL: target }), undefined);
  assert.equal(getRecordsDatabaseUrl({ DATABASE_URL: previous, RECORDS_WRITER_DATABASE_URL: target }), undefined);
  assert.equal(getRecordsDatabaseUrl({ RECORDS_DATABASE_URL: ` ${target}\n`, DATABASE_URL: previous }), target);
});

test('both readers and collectors reject a stale source-project URL without exposing credentials', () => {
  for (const [get, key] of [[getRecordsDatabaseUrl, 'RECORDS_DATABASE_URL'], [getRecordsWriterDatabaseUrl, 'RECORDS_WRITER_DATABASE_URL']] as const) {
    assert.throws(() => get({ [key]: previous }), error => {
      assert(error instanceof Error);
      assert.match(error.message, /migrated records project/);
      assert.doesNotMatch(error.message, /fixture-secret|ztlqbnmfppcndprmenti|postgresql:\/\//);
      return true;
    });
    assert.equal(get({ [key]: target }), target);
  }
});

test('direct target connections and explicit local verification are supported', () => {
  const direct = `postgresql://reader:fixture-secret@db.${RECORDS_SUPABASE_PROJECT_REF}.supabase.co/postgres`;
  assert.equal(getRecordsDatabaseUrl({ RECORDS_DATABASE_URL: direct }), direct);
  assert.throws(() => getRecordsDatabaseUrl({ RECORDS_DATABASE_URL: 'postgresql://reader:fixture-secret@db.ztlqbnmfppcndprmenti.supabase.co/postgres' }));
  const local = 'postgresql://reader:fixture@127.0.0.1:55432/records';
  assert.equal(getRecordsDatabaseUrl({ RECORDS_DATABASE_URL: local }), local);
  assert.equal(getRecordsDatabaseUrl({ RECORDS_DATABASE_URL: previous, RECORDS_DATA_BACKEND: 'local' }), undefined);
});

test('DNS root dots cannot bypass the migrated-project restriction', () => {
  const direct = 'postgresql://reader:fixture-secret@db.ztlqbnmfppcndprmenti.supabase.co./postgres';
  const pooler = previous.replace('pooler.supabase.com:', 'pooler.supabase.com.:');
  for (const value of [direct, pooler, 'postgresql://reader:fixture-secret@unrelated.example/postgres']) {
    assert.throws(() => getRecordsDatabaseUrl({ RECORDS_DATABASE_URL: value }));
    assert.throws(() => getRecordsWriterDatabaseUrl({ RECORDS_WRITER_DATABASE_URL: value }));
  }
});

test('invalid reader/writer configuration fails without secret-bearing parser errors', () => {
  for (const value of ['not a URL with fixture-secret', 'https://example.test/fixture-secret']) {
    assert.throws(() => getRecordsWriterDatabaseUrl({ RECORDS_WRITER_DATABASE_URL: value }), error => {
      assert(error instanceof Error);assert.doesNotMatch(error.message, /fixture-secret/);return true;
    });
  }
});

test('direct database reads cannot acquire the application Prisma client when records config is missing', () => {
  const previous = process.env.RECORDS_DATABASE_URL;
  delete process.env.RECORDS_DATABASE_URL;
  try { assert.throws(() => getRecordsPrisma(), /RECORDS_DATABASE_URL is required/); }
  finally { if (previous !== undefined) process.env.RECORDS_DATABASE_URL = previous; }
});

test('collector refuses stale or missing writer configuration before opening a database connection', async () => {
  const keys = ['RECORDS_WRITER_DATABASE_URL', 'DATABASE_URL', 'CRON_SECRET'];
  const saved = keys.map(key => process.env[key]);
  const secret = 'fixture-records-collector-secret';
  process.env.CRON_SECRET = secret;
  process.env.DATABASE_URL = previous;
  try {
    for (const value of [previous, ' \n ']) {
      process.env.RECORDS_WRITER_DATABASE_URL = value;
      const response = await collectRecords(new NextRequest('https://example.test/api/cron/update-records', { headers: { authorization: `Bearer ${secret}` } }));
      assert.equal(response.status, 503);
      assert.doesNotMatch(JSON.stringify(await response.json()), /fixture-secret|ztlqbnmfppcndprmenti/);
    }
    const unauthenticated = await collectRecords(new NextRequest('https://example.test/api/cron/update-records'));
    assert.equal(unauthenticated.status, 401);
  } finally {
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
});
