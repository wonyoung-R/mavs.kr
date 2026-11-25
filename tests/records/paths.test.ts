import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../../src/proxy';
import {
  recordHref,
  recordLanguageHref,
  resolveRecordPath,
  legacyRecordPath,
} from '../../src/lib/records/paths';

test('archive navigation and language changes preserve IDs and filters under /stat', () => {
  assert.equal(recordHref('ko'), '/stat');
  assert.equal(recordHref('en', '/'), '/stat/en');
  assert.equal(recordHref('ko', '/players/nba%3Aplayer%3A1717'), '/stat/players/nba%3Aplayer%3A1717');
  assert.equal(recordHref('en', 'search'), '/stat/en/search');
  assert.equal(recordLanguageHref('ko', '/stat', ''), '/stat/en');
  assert.equal(recordLanguageHref('en', '/stat/en', ''), '/stat');
  const query = 'season=2010&competition=playoffs&q=Dirk+points';
  assert.equal(recordLanguageHref('ko', '/stat/players/nba%3Aplayer%3A1717', query), `/stat/en/players/nba%3Aplayer%3A1717?${query}`);
  assert.equal(recordLanguageHref('en', '/stat/en/search', query), `/stat/search?${query}`);
});

test('archive routes resolve both languages and reject invalid or recursively encoded IDs', () => {
  assert.deepEqual(resolveRecordPath(), { locale: 'ko', section: 'home', canonicalPath: '' });
  assert.deepEqual(resolveRecordPath(['en']), { locale: 'en', section: 'home', canonicalPath: '' });
  assert.deepEqual(resolveRecordPath(['en', 'seasons']), { locale: 'en', section: 'seasons', canonicalPath: 'seasons' });
  assert.deepEqual(resolveRecordPath(['games', 'nba%3Agame%3A0022501193']), {
    locale: 'ko', section: 'game', canonicalPath: 'games/nba%3Agame%3A0022501193', id: 'nba:game:0022501193',
  });
  for (const path of [['en', 'en'], ['unknown'], ['games'], ['players', '%'], ['players', 'nba%253Aplayer%253A1717'], ['games', 'a%2Fb'], ['players', 'dirk', 'extra']]) {
    assert.equal(resolveRecordPath(path), null, path.join('/'));
  }
});

test('legacy record URLs redirect permanently once while preserving escaped IDs and search', () => {
  for (const [oldPath, newPath] of [
    ['/search?q=Dirk+points&season=2010', '/stat/search?q=Dirk+points&season=2010'],
    ['/players/nba%3Aplayer%3A1717?competition=playoffs', '/stat/players/nba%3Aplayer%3A1717?competition=playoffs'],
    ['/games/nba%3Agame%3A0022501193', '/stat/games/nba%3Agame%3A0022501193'],
    ['/en', '/stat/en'],
    ['/en/records?metric=AST', '/stat/en/records?metric=AST'],
  ]) {
    const response = proxy(new NextRequest(`https://www.mavs.kr${oldPath}`));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), `https://www.mavs.kr${newPath}`);
    const destination = proxy(new NextRequest(response.headers.get('location')!));
    assert.equal(destination.status, 200);
    assert.equal(destination.headers.get('location'), null);
  }
});

test('homepage, fans, API and auth remain at their current addresses and archive language is explicit', () => {
  for (const path of ['/', '/fan', '/comm', '/news/a', '/api/records/query', '/auth/callback', '/stat', '/stat/players/dirk']) {
    assert.equal(legacyRecordPath(path), null);
    const response = proxy(new NextRequest(`https://www.mavs.kr${path}`));
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-middleware-request-x-mavs-language'), 'ko');
  }
  assert.equal(proxy(new NextRequest('https://www.mavs.kr/stat/en/players/dirk')).headers.get('x-middleware-request-x-mavs-language'), 'en');
  assert.equal(proxy(new NextRequest('https://www.mavs.kr/stat/english')).headers.get('x-middleware-request-x-mavs-language'), 'ko');
});
