// Compare the existing TypeScript repository and native Ruby repository against
// the SAME isolated restore. This script never loads the source .env.local.
import { readFile, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUBY = path.join(ROOT, 'ruby');

export function localDatabaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('LOCAL_DATABASE_URL_REQUIRED'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55432' || url.pathname !== '/mavs_validation' || !url.username) throw new Error('ISOLATED_LOCAL_DATABASE_REQUIRED');
  // Do not accept URI options that could override host, role or session settings.
  url.search = '';
  url.hash = '';
  url.searchParams.set('sslmode', 'disable');
  url.searchParams.set('connection_limit', '2');
  url.searchParams.set('pool_timeout', '5');
  url.searchParams.set('connect_timeout', '5');
  return url.toString();
}

export function canonical(value, key = '', method = '') {
  if (Array.isArray(value)) {
    const rows = value.map(item => canonical(item, '', method));
    // These are SQL relations with no ordering contract. Ordered UI results
    // (games, leaderboard, query rows, summaries, aliases) stay in exact order.
    if (['coverage', 'playerStats', 'teamStats'].includes(key) || (key === '' && method === 'comparison')) {
      rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    }
    return rows;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(name => [name, canonical(value[name], name, method)]));
  return value;
}

export function differences(expected, actual, location = '$', output = []) {
  if (output.length >= 20 || Object.is(expected, actual)) return output;
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object' || Array.isArray(expected) !== Array.isArray(actual)) {
    output.push({ path: location, expected, actual });
    return output;
  }
  if (Array.isArray(expected) && expected.length !== actual.length) output.push({ path: `${location}.length`, expected: expected.length, actual: actual.length });
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    if (output.length >= 20) break;
    if (!Object.hasOwn(expected, key) || !Object.hasOwn(actual, key)) output.push({ path: `${location}.${key}`, expected: Object.hasOwn(expected, key) ? expected[key] : '<absent>', actual: Object.hasOwn(actual, key) ? actual[key] : '<absent>' });
    else differences(expected[key], actual[key], `${location}.${key}`, output);
  }
  return output;
}

export function representativeCases({ current, older, earliestGame }) {
  const dirk = 'nba:player:1717', luka = 'nba:player:1629029';
  const cases = [{ name: 'catalog-current', method: 'catalog', args: {} }];
  for (const [label, releaseId] of [['current-pin', current], ['older-pin', older]]) {
    const add = (name, method, args) => cases.push({ name: `${label}-${name}`, method, args: { ...args, releaseId } });
    add('catalog', 'catalog', {});
    add('latest-game', 'scope', { kind: 'game', id: 'nba:game:0022501193' });
    add('2011-finals-game', 'scope', { kind: 'game', id: 'nba:game:0041000406' });
    add('earliest-game', 'scope', { kind: 'game', id: earliestGame });
    add('missing-game', 'scope', { kind: 'game', id: 'nba:game:0000000000' });
    add('dirk-page2', 'scope', { kind: 'player', id: dirk, offset: 200, limit: 200 });
    add('dirk-playoffs', 'scope', { kind: 'player', id: dirk, season: 2010, competition: 'playoffs' });
    add('dirk-empty-page', 'scope', { kind: 'player', id: dirk, offset: 999999 });
    add('missing-player', 'scope', { kind: 'player', id: 'nba:player:0000000000' });
    add('season-playoffs', 'scope', { kind: 'season', season: 2010, competition: 'playoffs' });
    add('season-home', 'scope', { kind: 'season', season: 2024, competition: 'regular', venue: 'home' });
    add('leaderboard-pts', 'leaderboard', { season: 2010, competition: 'playoffs', stat: 'PTS' });
    add('leaderboard-missing-stat', 'leaderboard', { season: 1980, competition: 'regular', stat: 'PLUS_MINUS' });
    add('comparison', 'comparison', { playerIds: [luka, dirk], competition: 'regular' });
    add('query-games', 'query', { text: 'Dirk 2010 playoffs points' });
    add('query-korean', 'query', { text: '노비츠키 2010-11 플레이오프 득점' });
    add('query-total', 'query', { text: 'Dirk 2010 playoffs total points' });
    add('query-known-zero', 'query', { text: 'Dirk 2010 playoffs count over 99 points' });
    add('query-unknown-count', 'query', { text: 'Dirk playoffs count over 99 points' });
    add('query-unknown-venue', 'query', { text: 'Dirk 2010 playoffs away points' });
    add('query-zero-points', 'query', { text: 'Dirk regular season exactly 0 points' });
    add('query-mention-order', 'query', { text: 'Luka Doncic vs Dirk Nowitzki compare points' });
    add('query-unsupported', 'query', { text: 'Dirk clutch points' });
    add('query-ambiguous', 'query', { text: 'Dirk 2010 2011 points' });
  }
  return cases;
}

async function readOnly(prisma, sql) {
  const [, , rows] = await prisma.$transaction([
    prisma.$executeRawUnsafe('SET TRANSACTION READ ONLY'),
    prisma.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'"),
    prisma.$queryRawUnsafe(sql),
  ]);
  return rows;
}

async function rubyResults(cases, databaseUrl) {
  const env = Object.fromEntries(['PATH', 'HOME', 'RBENV_ROOT', 'TMPDIR', 'LANG'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, { RBENV_VERSION: '3.4.0', RAILS_ENV: 'test', DATABASE_URL: databaseUrl, LOCAL_RECORDS_DATABASE_URL: databaseUrl, BUNDLE_GEMFILE: path.join(RUBY, 'Gemfile') });
  return new Promise((resolve, reject) => {
    const child = spawn('rbenv', ['exec', 'bundle', 'exec', 'ruby', 'scripts/compare_records.rb'], { cwd: RUBY, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('RUBY_PARITY_TIMEOUT')); }, 180_000);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 64 * 1024 * 1024) child.kill('SIGTERM'); });
    child.stderr.on('data', chunk => { if (stderr.length < 2048) stderr += chunk; });
    child.stdin.on('error', () => {});
    child.once('error', () => { clearTimeout(timer); reject(new Error('RUBY_RUNNER_UNAVAILABLE')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error('RUBY_RUNNER_FAILED')); return; }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('INVALID_RUBY_RESULTS')); }
    });
    child.stdin.end(JSON.stringify({ cases }));
  });
}

function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

export async function compareRecords(databaseUrl) {
  const localUrl = localDatabaseUrl(databaseUrl);
  // Set the explicit, validated local URI BEFORE importing the Prisma singleton.
  process.env.DATABASE_URL = localUrl;
  process.env.RECORDS_DATA_BACKEND = 'database';
  process.env.NODE_ENV = 'test';
  const prismaModule = await import('../../src/lib/db/prisma.ts');
  const prisma = prismaModule.prisma ?? prismaModule.default?.prisma;
  const repositoryModule = await import('../../src/lib/records/repository.ts');
  const repository = repositoryModule.readRecordCatalog ? repositoryModule : repositoryModule.default;
  try {
    const [pointer] = await readOnly(prisma, 'SELECT release_id FROM records.current_release WHERE singleton=true');
    const releases = await readOnly(prisma, 'SELECT id FROM records.releases ORDER BY created_at DESC,id');
    const [earliest] = await readOnly(prisma, 'SELECT id FROM records.games ORDER BY date,id LIMIT 1');
    const older = releases.find(row => row.id !== pointer?.release_id)?.id;
    if (!pointer?.release_id || !older || !earliest?.id) throw new Error('TWO_COMPLETE_RELEASES_REQUIRED');
    const cases = representativeCases({ current: pointer.release_id, older, earliestGame: earliest.id });
    const tsResults = [];
    for (const item of cases) {
      const start = performance.now();
      const args = item.args;
      let result;
      if (item.method === 'catalog') result = await repository.readRecordCatalog(args.releaseId);
      else if (item.method === 'scope') result = await repository.readRecordScope(args);
      else if (item.method === 'leaderboard') result = await repository.readLeaderboard(args);
      else if (item.method === 'comparison') result = await repository.readComparison(args);
      else if (item.method === 'query') result = await repository.queryRecords(args.text, args.releaseId);
      tsResults.push({ name: item.name, result: JSON.parse(JSON.stringify(result)), elapsedMs: Math.round(performance.now() - start) });
    }
    // Ruby starts after all TypeScript reads, so total read concurrency stays <=2.
    const ruby = await rubyResults(cases, localUrl);
    if (!Array.isArray(ruby) || ruby.length !== cases.length) throw new Error('RUBY_CASES_MISSING');
    const checks = cases.map((item, index) => {
      const expected = canonical(tsResults[index].result, '', item.method);
      const actual = canonical(ruby[index].result, '', item.method);
      const diff = differences(expected, actual);
      return { name: item.name, passed: ruby[index].name === item.name && diff.length === 0 && !ruby[index].error, tsMs: tsResults[index].elapsedMs, rubyMs: ruby[index].elapsedMs, tsSha256: digest(expected), rubySha256: digest(actual), differences: diff, ...(ruby[index].error ? { rubyError: ruby[index].error } : {}) };
    });
    const report = { version: 1, target: 'isolated-local-55432', createdAt: new Date().toISOString(), normalization: 'object keys and unordered coverage/playerStats/teamStats/comparison relations; all other arrays preserve order', releases: { current: pointer.release_id, older }, checks };
    const parent = path.join(ROOT, 'data/migrations');
    await mkdir(parent, { recursive: true, mode: 0o700 });
    const filename = path.join(parent, `records-parity-${Date.now()}-${randomBytes(4).toString('hex')}.json`);
    const handle = await open(filename, 'wx', 0o600);
    try { await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`); } finally { await handle.close(); }
    return { filename, report, summary: { passed: checks.filter(check => check.passed).length, failed: checks.filter(check => !check.passed).length, total: checks.length, reportSha256: digest(report) } };
  } finally { await prisma.$disconnect(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--plan')) {
    process.stdout.write(`${JSON.stringify({ status: 'plan', localPort: 55432, sourceConnections: 0, expectedCases: representativeCases({ current: 'current', older: 'older', earliestGame: 'first' }).length })}\n`);
    return;
  }
  if (args.length !== 1 || args[0] !== '--run') throw new Error('INVALID_ARGUMENTS');
  const configured = process.env.LOCAL_RECORDS_DATABASE_URL ?? dotenv.parse(await readFile(path.join(RUBY, '.env.local'))).DATABASE_URL;
  const result = await compareRecords(configured);
  process.stdout.write(`${JSON.stringify(result.summary)}\n`);
  if (result.summary.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    const code = /^[A-Z_]+$/.test(error.message ?? '') ? error.message : 'PARITY_FAILED';
    const sqlState = /^[A-Z0-9]{5}$/.test(error?.meta?.code ?? '') ? error.meta.code : undefined;
    process.stderr.write(`${JSON.stringify({ status: 'failed', code, ...(sqlState ? { sqlState } : {}) })}\n`);
    process.exitCode = 1;
  });
}
