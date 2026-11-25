// Read-only, sequential HTTP QA against the isolated native Rails server.
// Does not load credentials, connect to a database, or follow redirects.
import assert from 'node:assert/strict';
import { readFile, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { load } from 'cheerio';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = new URL(process.argv[2] || 'http://127.0.0.1:3002');
assert.equal(base.origin, 'http://127.0.0.1:3002', 'Only the isolated Rails port is allowed.');
const archive = process.argv[3] && path.resolve(process.argv[3]);
assert(archive?.startsWith(path.join(root, 'data/migrations/')), 'Pass the private migration archive directory.');
const manifest = JSON.parse(await readFile(path.join(archive, 'manifest.json'), 'utf8'));
const currentRelease = 'r_874077cc8f884010548fb51b';
const olderRelease = 'r_a21cf51e49045e94449df4ba';
const checks = [];
const state = { articles: {}, sitemaps: {}, localMedia: new Set() };
let requestCount = 0;
const digest = value => createHash('sha256').update(value).digest('hex');

async function request(url) {
  const target = new URL(url, base);
  assert.equal(target.origin, base.origin, 'External request refused.');
  requestCount++;
  return fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(45000) });
}

async function check(name, callback) {
  const start = performance.now();
  let result;
  try {
    result = { name, passed: true, ...await callback() };
  } catch (error) {
    result = { name, passed: false, reason: error.message.split('\n')[0] };
  }
  result.elapsedMs = Math.round(performance.now() - start);
  checks.push(result);
  console.log(JSON.stringify(result));
  return result.passed;
}

async function page(url, expectedStatus = 200) {
  const response = await request(url);
  assert.equal(response.status, expectedStatus, `Unexpected HTTP status for ${url}`);
  const html = await response.text();
  const $ = load(html);
  if (expectedStatus === 200) {
    assert($('h1').text().trim(), 'Missing page heading.');
    assert($('title').text().trim(), 'Missing document title.');
    assert.equal($('link[rel="canonical"]').length, 1, 'Canonical missing or duplicated.');
    assert(!$('link[rel="canonical"]').attr('href').includes('%253A'), 'Double-encoded canonical.');
    assert(!html.includes('NEXT_HTTP_ERROR_FALLBACK;404'), 'Streamed not-found response.');
    assert(!/기록 데이터를 표시할 수 없습니다|Record data cannot be displayed|페이지를 불러오지 못했습니다|Unable to load this page/.test(visibleText($)), 'Error fallback rendered.');
    $('script[type="application/ld+json"]').each((_i, el) => JSON.parse($(el).text()));
  }
  return { response, html, $ };
}

function visibleText($) {
  const body = $('body').clone();
  body.find('script, style, template').remove();
  return body.text().replace(/\s+/g, ' ');
}

const core = [];
for (const locale of ['', '/en']) {
  const dirk = locale ? 'Dirk Nowitzki' : '디르크 노비츠키';
  const luka = locale ? 'Luka Doncic' : '루카 돈치치';
  for (const [url, texts, rows] of [
    ['/', ['3956', '2026-04-12'], 8],
    ['/seasons?season=2010&competition=playoffs', ['2010–11', '2011-06-12'], 21],
    ['/players', [dirk, luka]],
    ['/records?season=2010&competition=playoffs', [dirk, '582']],
    ['/compare?p1=nba%3Aplayer%3A1717&p2=nba%3Aplayer%3A1629029', [dirk, luka]],
    ['/search?q=Dirk%202010%20playoffs%20points', [dirk, '48'], 21],
    ['/history', ['1980–81', '2025–26']],
    ['/data', ['3956', '92120']],
    ['/games/nba%3Agame%3A0022501193', ['Chicago Bulls', 'Dallas Mavericks', '128', '149'], 26],
    ['/games/nba%3Agame%3A0041000406', ['2011-06-12', '95', '105', dirk]],
    ['/players/nba%3Aplayer%3A1717?season=2010&competition=playoffs', [dirk, '2011-06-12'], 21],
    ['/players/nba%3Aplayer%3A1717?page=2', [dirk, '2016-03-23', '2014-01-01'], 200],
  ]) core.push({ url: `${locale}${url}`, texts, rows });
  for (const kind of ['game', 'player']) core.push({ url: `${locale}/${kind}s/nba%3A${kind}%3A0000000000`, missing: true });
}

for (const item of core) await check(`records ${item.url}`, async () => {
  const { $, response } = await page(item.url, item.missing ? 404 : 200);
  if (item.missing) return { status: response.status };
  const text = visibleText($);
  for (const value of item.texts) assert(text.replace(/,/g, '').includes(value), `Expected visible record value missing: ${value}`);
  if (item.rows !== undefined) assert.equal($('tbody tr').length, item.rows, 'Unexpected data row count.');
  assert.equal($('link[rel="alternate"][hreflang]').length, 3, 'Missing bilingual alternate URLs.');
  if (/\/(search|compare)\?/.test(item.url)) assert.match($('meta[name="robots"]').attr('content'), /noindex/);
  if (item.url.includes('0022501193')) {
    assert.deepEqual($('.scoreNumbers strong').map((_i, el) => $(el).text()).get(), ['128', '149']);
    assert($('.scoreTeam').first().text().includes('AWAY') && $('.scoreTeam').first().text().includes('Chicago Bulls'));
    assert($('.scoreTeam').last().text().includes('HOME') && $('.scoreTeam').last().text().includes('Dallas Mavericks'));
    assert.equal($('table').length, 2);
    $('table').each((_i, table) => {
      const rows = $(table).find('tr[data-lineup-role]').toArray();
      assert.equal(rows.length, 12);
      const roles = rows.map(row => $(row).attr('data-lineup-role'));
      assert.deepEqual(roles.slice(0, 5), Array(5).fill('Starter'));
      assert.equal(roles.filter(role => role === 'Starter').length, 5);
      assert.deepEqual(rows.slice(0, 5).map(row => $(row).attr('data-position')), ['G', 'G', 'F', 'F', 'C']);
      const minutes = rows.filter(row => $(row).attr('data-lineup-role') === 'Bench').map(row => {
        const value = $(row).find('td').eq(3).text();
        if (value === '—') return -1;
        const [m, s] = value.split(':').map(Number);
        return m * 60 + s;
      });
      assert.deepEqual(minutes, [...minutes].sort((a, b) => b - a));
      const firstDnp = roles.findIndex(role => ['DNP', 'Inactive'].includes(role));
      if (firstDnp !== -1) assert(roles.slice(firstDnp).every(role => ['DNP', 'Inactive'].includes(role)));
    });
    assert(text.includes(item.url.startsWith('/en') ? 'Neutral-site status is unverified.' : '중립구장 여부는 미확인입니다.'));
  }
  if (item.url.includes('0041000406')) {
    assert.equal($('[data-lineup-role="Starter"], [data-lineup-role="Bench"]').length, 0);
    assert.equal($('[data-lineup-role="Unknown"]').length, 18);
    assert.equal($('[data-lineup-role="DNP"]').length, 6);
    assert.equal($('[data-position]').filter((_i, el) => $(el).attr('data-position') !== '').length, 15);
    assert($('[data-position=""]').toArray().every(el => $(el).find('td').eq(2).text() === '—'));
  }
  return { status: response.status, rows: $('tbody tr').length };
});

await check('API current coverage', async () => {
  const response = await request('/api/records/coverage');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.releaseId, currentRelease);
  assert.equal(data.totalGames, 3956);
  assert.equal(data.totalPlayerStatRows, 92120);
  assert.equal(data.seasons.length, 46);
  state.coverage = data;
  return { status: response.status, release: data.releaseId, games: data.totalGames, playerRows: data.totalPlayerStatRows, seasons: data.seasons.length };
});

for (const [label, release] of [['current', currentRelease], ['older', olderRelease]]) await check(`API ${label} immutable scope and nulls`, async () => {
  const response = await request(`/api/records/scope?kind=game&id=nba%3Agame%3A0022501193&releaseId=${release}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /immutable/);
  const data = await response.json();
  assert.equal(data.releaseId, release);
  const game = data.dataset.games[0];
  assert.equal(game.awayScore, 128);
  assert.equal(game.homeScore, 149);
  assert.equal(game.neutral, null);
  assert.equal(game.tipoffUtc, null);
  assert.equal(data.dataset.playerStats.length, 24);
  const positions = data.dataset.playerStats.map(row => row.starterPosition);
  if (label === 'current') {
    assert.equal(positions.filter(Boolean).length, 10);
    state.dalPlayers = data.dalPlayerIds;
  } else assert(positions.every(position => position === null));
  return { status: response.status, players: data.dataset.playerStats.length, positions: positions.filter(Boolean).length, nullPositions: positions.filter(position => position === null).length };
});

for (const [url, status] of [
  ['/api/records/coverage?releaseId=invalid', 400],
  ['/api/records/coverage?releaseId=r_000000000000000000000000', 404],
  ['/api/records/coverage?releaseId[]=invalid', 400],
  [`/api/records/coverage?releaseId=${currentRelease}&release=${currentRelease}`, 400],
  ['/api/records/scope?kind=season&season=all', 400],
  ['/games/nba%253Agame%253A0022501193', 404],
  ['/en/players/nba%253Aplayer%253A1717', 404],
  ['/media/not-a-bucket/missing.png', 404],
]) await check(`negative ${url}`, async () => {
  const response = await request(url);
  assert.equal(response.status, status);
  return { status: response.status };
});

for (const kind of ['news', 'comm', 'column', 'analysis']) {
  state.articles[kind] = [];
  await check(`content ${kind} all list pages`, async () => {
    let count = 0, next = `/${kind}`;
    while (next) {
      assert(++count <= 30, 'Unexpected pagination loop.');
      const { $ } = await page(next);
      const links = $('.contentList h2 a').map((_i, el) => $(el).attr('href')).get();
      assert(links.length <= 30);
      if (count === 1) state.articles[kind].firstTitleHash = digest($('.contentList h2 a').first().text());
      state.articles[kind].push(...links);
      next = $('a[rel="next"]').attr('href');
      if (next) assert.equal(new URL(next, base).pathname, `/${kind}`);
    }
    assert.equal(new Set(state.articles[kind]).size, state.articles[kind].length, 'Duplicate article across list pages.');
    return { pages: count, articles: state.articles[kind].length };
  });
  await check(`content ${kind} detail`, async () => {
    const url = state.articles[kind][0];
    assert(url, 'No detail sample available.');
    const { $ } = await page(url);
    assert.equal(digest($('h1.pageTitle').text()), state.articles[kind].firstTitleHash, 'Detail title differs from list.');
    assert($('.articleBody').text().trim().length > 20, 'Article body is empty.');
    assert.equal($('.articleBody script, .articleBody iframe, .articleBody object').length, 0);
    $('.articleBody *').each((_i, el) => assert(!Object.keys(el.attribs || {}).some(name => /^on/i.test(name)), 'Executable event handler remains.'));
    assert.equal(new URL($('link[rel="canonical"]').attr('href')).pathname, url);
    const schema = JSON.parse($('script[type="application/ld+json"]').text());
    assert.equal(schema.headline, $('h1.pageTitle').text());
    assert.equal(schema['@type'], kind === 'news' ? 'NewsArticle' : 'Article');
    $('[src], [href]').each((_i, el) => {
      for (const attr of ['src', 'href']) if ($(el).attr(attr)?.startsWith('/media/')) state.localMedia.add($(el).attr(attr));
    });
    return { status: 200, path: url, bodyCharacters: $('.articleBody').text().trim().length, localMediaLinks: state.localMedia.size };
  });
}

await check('content migrated column image', async () => {
  const { $ } = await page('/column/cmj11nwt70004vxcaavj8xhjf');
  const expected = '/media/Column/1y9l95cmcxu.png';
  assert.equal($('.articleBody img').length, 1);
  assert.equal($('.articleBody img').attr('src'), expected);
  state.localMedia.add(expected);
  return { status: 200, rewrittenImages: 1 };
});

// These real NOTICE posts exposed the category mismatch between sitemap/list/detail.
for (const id of ['cmja8hgnf0001lb0anl92f1t3', 'cmjb7095t0001l20a2cypun4c']) await check(`content category regression ${id}`, async () => {
  const url = `/community/${id}`;
  assert(state.articles.comm.includes(url), 'Previously omitted article remains absent from the community list.');
  const { $ } = await page(url);
  assert($('h1.pageTitle').text().trim());
  assert($('.articleBody').text().trim());
  assert.equal(new URL($('link[rel="canonical"]').attr('href')).pathname, url);
  return { status: 200 };
});

await check('robots crawl/noindex boundaries', async () => {
  const response = await request('/robots.txt');
  assert.equal(response.status, 200);
  const text = await response.text();
  assert(!/Disallow:\s*\/(search|compare)/.test(text));
  assert.match(text, /Disallow: \/auth\//);
  assert.match(text, /Sitemap: https?:\/\/[^\s]+\/sitemap.xml/);
  return { status: 200 };
});

await check('sitemap index', async () => {
  const response = await request('/sitemap.xml');
  assert.equal(response.status, 200);
  const $ = load(await response.text(), { xmlMode: true });
  const paths = $('sitemap > loc').map((_i, el) => new URL($(el).text()).pathname).get();
  assert.deepEqual(paths.sort(), ['articles', 'games', 'pages', 'players', 'seasons'].map(kind => `/sitemaps/${kind}.xml`).sort());
  return { status: 200, entries: paths.length };
});

for (const kind of ['pages', 'games', 'players', 'seasons', 'articles']) await check(`sitemap ${kind} full counts`, async () => {
  const response = await request(`/sitemaps/${kind}.xml`);
  assert.equal(response.status, 200);
  const $ = load(await response.text(), { xmlMode: true });
  const paths = $('url > loc').map((_i, el) => new URL($(el).text()).pathname).get();
  assert.equal(new Set(paths).size, paths.length, 'Duplicate sitemap URLs.');
  assert(paths.every(url => !url.includes('%253A')), 'Double-encoded sitemap URL.');
  state.sitemaps[kind] = paths.length;
  if (kind === 'games') {
    assert.equal(paths.length, state.coverage.totalGames * 2);
    assert(paths.includes('/games/nba%3Agame%3A0022501193') && paths.includes('/en/games/nba%3Agame%3A0041000406'));
  } else if (kind === 'players') {
    const expected = state.dalPlayers.flatMap(id => [`/players/${encodeURIComponent(id)}`, `/en/players/${encodeURIComponent(id)}`]);
    assert.deepEqual(paths.sort(), expected.sort());
  } else if (kind === 'seasons') {
    const pairs = state.coverage.coverage.filter(row => row.dataset === 'games' && row.field === 'all' && row.observed > 0);
    const expected = pairs.flatMap(row => [`/seasons/${row.season}/${row.competition}`, `/en/seasons/${row.season}/${row.competition}`]);
    assert.deepEqual(paths.sort(), expected.sort());
  } else if (kind === 'articles') {
    const expected = Object.values(state.articles).flat();
    assert.deepEqual(paths.sort(), expected.sort(), 'Sitemap differs from all published list pages.');
    assert.equal($('url > lastmod').length, paths.length);
  } else assert.equal(paths.length, 14);
  if (['games', 'players', 'seasons'].includes(kind)) {
    assert.equal($('url').length * 3, $('xhtml\\:link').length);
    assert(!paths.some(url => /\/(search|compare|login|admin)/.test(url)));
  }
  return { status: 200, entries: paths.length };
});

for (const url of ['/login', '/auth/callback', '/community/new', '/column/new', '/analysis/new', '/fan?tab=gallery']) await check(`legacy redirect ${url}`, async () => {
  const response = await request(url);
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get('location'));
  assert.notEqual(location.origin, base.origin, 'Legacy forwarding loop.');
  assert.equal(location.pathname, new URL(url, base).pathname);
  assert.equal(location.search, new URL(url, base).search);
  assert.match(response.headers.get('cache-control'), /no-store/);
  return { status: response.status, locationOrigin: location.origin, path: location.pathname, followed: false };
});

const mediaSamples = new Map();
for (const bucket of manifest.buckets) {
  const file = manifest.files.find(row => row.public === true && row.key.startsWith(`${bucket.id}/`));
  if (file) mediaSamples.set(file.key, file);
}
for (const link of state.localMedia) {
  const key = decodeURIComponent(link.slice('/media/'.length));
  const file = manifest.files.find(row => row.key === key && row.public === true);
  if (file && mediaSamples.size < 6) mediaSamples.set(file.key, file);
}
for (const file of mediaSamples.values()) await check(`media sha256 ${file.key}`, async () => {
  const response = await request(`/media/${file.key.split('/').map(encodeURIComponent).join('/')}`);
  assert.equal(response.status, 200, `Media HTTP status ${response.status}; expected 200.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const disk = await readFile(path.join(archive, file.path));
  assert.equal(bytes.length, file.bytes);
  assert.equal(digest(bytes), file.sha256, 'HTTP bytes differ from export SHA-256.');
  assert.equal(digest(disk), file.sha256, 'Archive bytes differ from export SHA-256.');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /sandbox/);
  assert.match(response.headers.get('content-disposition'), /^inline;/);
  return { status: 200, bytes: bytes.length, sha256: file.sha256 };
});

const summary = {
  passed: checks.filter(item => item.passed).length,
  failed: checks.filter(item => !item.passed).length,
  total: checks.length,
  coreRoutes: checks.filter(item => item.name.startsWith('records ')).length,
  sitemapCounts: state.sitemaps,
  articleCounts: Object.fromEntries(Object.entries(state.articles).map(([kind, rows]) => [kind, rows.length])),
  mediaSamples: mediaSamples.size,
  requests: requestCount,
};
const report = {
  version: 1, createdAt: new Date().toISOString(), target: base.origin,
  scope: 'Sequential HTTP GET: actual Rails SSR/API, sitemap membership/counts, and exported media hash samples. Browser layout/clicks and authenticated writes excluded.',
  databaseWrites: 0, externalRequests: 0, followedRedirects: 0, summary, checks,
};
const filename = path.join(root, 'data/migrations/local-validation', `http-${Date.now()}-${randomBytes(4).toString('hex')}.json`);
const handle = await open(filename, 'wx', 0o600);
try { await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`); } finally { await handle.close(); }
console.log(JSON.stringify({ ...summary, report: path.relative(root, filename), reportSha256: digest(JSON.stringify(report)) }));
if (summary.failed) process.exitCode = 1;
