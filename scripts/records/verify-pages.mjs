// Read-only integration checks against a running local server. A streamed 404
// can have HTTP 200, so verify rendered content and the RSC error digest too.
import assert from 'node:assert/strict';
import { load } from 'cheerio';

const base = new URL(process.argv[2] || 'http://127.0.0.1:3000');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use a local server.');
const cases = [];
for (const locale of ['', '/en']) {
  const dirk = locale ? 'Dirk Nowitzki' : '디르크 노비츠키';
  const luka = locale ? 'Luka Doncic' : '루카 돈치치';
  for (const [path, texts, rows] of [
    ['/', ['3956', '2026-04-12'], 8],
    ['/seasons?season=2010&competition=playoffs', ['2010–11', '2011-06-12'], 21],
    ['/players', [dirk, luka]],
    ['/records?season=2010&competition=playoffs', [dirk, '582']],
    ['/compare?p1=nba%3Aplayer%3A1717&p2=nba%3Aplayer%3A1629029', [dirk, luka]],
    ['/search?q=Dirk%202010%20playoffs%20points', [dirk, '48'], 21],
    ['/history', ['1980–81', '2025–26']],
    ['/data', ['3,956', '92,120']],
    ['/games/nba%3Agame%3A0022501193', ['Chicago Bulls', 'Dallas Mavericks', '128', '149'], 26],
    ['/games/nba%3Agame%3A0041000406', ['2011-06-12', '95', '105', dirk]],
    ['/players/nba%3Aplayer%3A1717?season=2010&competition=playoffs', [dirk, '2011-06-12'], 21],
    ['/players/nba%3Aplayer%3A1717?page=2', [dirk, '2016-03-23', '2014-01-01'], 200],
  ]) cases.push({ path: `${locale}${path}`, texts, rows });
  for (const resource of ['games', 'players']) {
    cases.push({ path: `${locale}/${resource}/nba%3A${resource === 'games' ? 'game' : 'player'}%3A0000000000`, missing: true });
  }
}

let passed = 0;
for (const check of cases) {
  const started = Date.now();
  try {
    const response = await fetch(new URL(check.path, base), { signal: AbortSignal.timeout(45000) });
    const html = await response.text();
    const streamed404 = html.includes('NEXT_HTTP_ERROR_FALLBACK;404');
    if (check.missing) {
      assert(response.status === 404 || streamed404, 'Missing record did not return a not-found boundary.');
    } else {
      assert.equal(response.status, 200);
      assert(!streamed404, 'HTTP 200 contains a streamed 404.');
      const $ = load(html);
      $('script, style, template').remove();
      const text = $('body').text().replace(/\s+/g, ' ');
      assert(!/기록 데이터를 표시할 수 없습니다|Record data cannot be displayed|페이지를 불러오지 못했습니다|Unable to load this page/.test(text), 'Page contains an error fallback.');
      for (const value of check.texts) assert(text.includes(value), `Missing visible content: ${value}`);
      if (check.rows !== undefined) assert.equal($('tbody tr').length, check.rows, 'Unexpected rendered row count.');
      assert(!$('link[rel="canonical"]').attr('href')?.includes('%253A'), 'Canonical ID was encoded twice.');
      if (check.path.includes('/games/nba%3Agame%3A0022501193')) {
        assert(text.includes('AWAY') && text.includes('HOME'), 'Missing game-side designations.');
        assert.equal($('table').length, 2);
        $('table').each((_index, table) => {
          assert($(table).find('th').toArray().some(th => $(th).text() === 'POS'), 'Missing position column.');
          const rows = $(table).find('tr[data-lineup-role]').toArray();
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
          assert.deepEqual(minutes, [...minutes].sort((a, b) => b - a), 'Bench is not sorted by minutes.');
          const firstDnp = roles.findIndex(role => role === 'DNP' || role === 'Inactive');
          if (firstDnp !== -1) assert(roles.slice(firstDnp).every(role => role === 'DNP' || role === 'Inactive'), 'Non-participants are not last.');
        });
      }
    }
    passed++;
    console.log(JSON.stringify({ path: check.path, passed: true, ms: Date.now() - started }));
  } catch (error) {
    console.log(JSON.stringify({ path: check.path, passed: false, reason: error.message, ms: Date.now() - started }));
  }
}
console.log(JSON.stringify({ passed, total: cases.length, scope: 'HTTP rendered content and RSC; excludes browser hydration/clicks' }));
if (passed !== cases.length) process.exitCode = 1;
