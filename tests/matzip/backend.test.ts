import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinates, regionPath, safeBlogUrl, submissionInput } from '../../src/lib/matzip/validation';
import { resolvePlace, topBlog } from '../../src/lib/matzip/providers';
import { authenticate, database, jsonBody } from '../../src/lib/matzip/server';
import { PATCH } from '../../src/app/api/matzip/admin/route';

test('submission ignores attacker supplied coordinates/status and requires selected place', () => {
  assert.deepEqual(submissionInput({ kakao_place_id: '123', place_name: '맛집', search_query: '서울 맛집', menu: '국밥', recommendation: '팬 추천', status: 'approved', latitude: 0 }), {
    kakao_place_id: '123', place_name: '맛집', search_query: '서울 맛집', menu: '국밥', recommendation: '팬 추천',
  });
  assert.throws(() => submissionInput({ kakao_place_id: '../admin' }));
  assert.throws(() => submissionInput({ kakao_place_id: '123', place_name: '맛집', search_query: '서울 맛집', menu: '', recommendation: '추천' }), /대표 메뉴/);
  assert.throws(() => submissionInput({ kakao_place_id: '123', place_name: '맛집', search_query: '서울 맛집', menu: '국밥', recommendation: 'x'.repeat(1001) }), /추천 내용/);
  assert.throws(() => submissionInput({ kakao_place_id: '123', place_name: '맛집', menu: '국밥', recommendation: '추천' }), /장소 검색어/);
});

test('coordinates reject swapped, nonfinite and foreign coordinates', () => {
  assert.deepEqual(coordinates('127.1', '37.2'), { longitude: 127.1, latitude: 37.2 });
  for (const [x, y] of [['37.2', '127.1'], ['NaN', '37'], ['-96.8', '32.8'], ['127', 'Infinity']]) assert.throws(() => coordinates(x, y));
});

test('regions include general district and skip absent levels without losing ancestry', () => {
  assert.deepEqual(regionPath('경기도', '수원시 영통구', '매탄1동'), [
    { id: '경기도', name: '경기도', parent_id: null, level: 1 },
    { id: '경기도/수원시', name: '수원시', parent_id: '경기도', level: 2 },
    { id: '경기도/수원시/영통구', name: '영통구', parent_id: '경기도/수원시', level: 3 },
    { id: '경기도/수원시/영통구/매탄1동', name: '매탄1동', parent_id: '경기도/수원시/영통구', level: 4 },
  ]);
  assert.equal(regionPath('세종특별자치시', '', '조치원읍')[1].parent_id, '세종특별자치시');
});

test('unsafe blog links cannot become clickable stored content', () => {
  assert.equal(safeBlogUrl('https://blog.naver.com/example/1'), 'https://blog.naver.com/example/1');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', null]) assert.throws(() => safeBlogUrl(value));
});

test('public API cannot acquire service privileges without service key', () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.throws(() => database(true));
  if (previous !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
});

test('authentication rejects absent bearer before any external call', async () => {
  await assert.rejects(authenticate(new Request('https://example.test')), { status: 401 });
});

test('request body rejects arrays and oversized input', async () => {
  await assert.rejects(jsonBody(new Request('https://example.test', { method: 'POST', body: '[]' })), { status: 400 });
  await assert.rejects(jsonBody(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(6001) })), { status: 413 });
});

test('blog retrieval uses first relevance result with API HUB credentials, never visits blog URL', async () => {
  const previousFetch = global.fetch;
  const previousId = process.env.NAVER_BLOG_CLIENT_ID, previousSecret = process.env.NAVER_BLOG_CLIENT_SECRET;
  process.env.NAVER_BLOG_CLIENT_ID = 'test-id'; process.env.NAVER_BLOG_CLIENT_SECRET = 'test-secret';
  let calls = 0;
  global.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.hostname, 'naverapihub.apigw.ntruss.com');
    assert.equal(url.searchParams.get('display'), '1');
    assert.equal(url.searchParams.get('sort'), 'sim');
    assert.equal(url.searchParams.get('query'), '서울 강남구 역삼동 테스트식당');
    assert.equal((init?.headers as Record<string, string>)['X-NCP-APIGW-API-KEY-ID'], 'test-id');
    return Response.json({ items: [{ title: '<b>맛집</b> 방문', link: 'https://blog.naver.com/test/1' }, { title: 'second', link: 'https://example.test/2' }] });
  };
  try {
    assert.deepEqual(await topBlog('테스트식당', '서울 강남구 역삼동 123'), { blog_url: 'https://blog.naver.com/test/1', blog_title: '맛집 방문' });
    assert.equal(calls, 1);
    global.fetch = async () => Response.json({ items: [] });
    assert.deepEqual(await topBlog('식당', '서울'), { blog_url: null, blog_title: null });
    global.fetch = async () => new Response('', { status: 429 });
    await assert.rejects(topBlog('식당', '서울'), { status: 502 });
    delete process.env.NAVER_BLOG_CLIENT_ID;
    await assert.rejects(topBlog('식당', '서울'), { status: 503 });
  } finally {
    global.fetch = previousFetch;
    if (previousId === undefined) delete process.env.NAVER_BLOG_CLIENT_ID; else process.env.NAVER_BLOG_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.NAVER_BLOG_CLIENT_SECRET; else process.env.NAVER_BLOG_CLIENT_SECRET = previousSecret;
  }
});

test('server resolves coordinates and region from provider, rejects unrelated selected ID', async () => {
  const previousFetch = global.fetch, previousKey = process.env.KAKAO_REST_API_KEY;
  process.env.KAKAO_REST_API_KEY = 'test-key';
  global.fetch = async input => {
    if (String(input).includes('keyword')) {
      assert.equal(new URL(String(input)).searchParams.get('query'), '서울 역삼 검증식당');
      return Response.json({ documents: [{ id: '123', place_name: '검증식당', road_address_name: '서울 강남구 테스트로 1', x: '127.1', y: '37.4' }] });
    }
    return Response.json({ documents: [{ region_type: 'H', region_1depth_name: '서울특별시', region_2depth_name: '강남구', region_3depth_name: '역삼1동' }] });
  };
  try {
    const resolved = await resolvePlace('123', '서울 역삼 검증식당');
    assert.equal(resolved.longitude, 127.1);
    assert.equal(resolved.address, '서울 강남구 테스트로 1');
    assert.equal(resolved.regions[2].id, '서울특별시/강남구/역삼1동');
    await assert.rejects(resolvePlace('999', '서울 역삼 검증식당'), { status: 400 });
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.KAKAO_REST_API_KEY; else process.env.KAKAO_REST_API_KEY = previousKey;
  }
});

test('administrator API rejects ordinary/unconfirmed users and duplicate review without publishing twice', async () => {
  const original = global.fetch;
  const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NAVER_BLOG_CLIENT_ID', 'NAVER_BLOG_CLIENT_SECRET'];
  const previous = keys.map(key => process.env[key]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service';
  process.env.NAVER_BLOG_CLIENT_ID = 'fixture-id';
  process.env.NAVER_BLOG_CLIENT_SECRET = 'fixture-secret';
  const id = '00000000-0000-4000-8000-000000000001';
  let email = 'member@example.test', confirmed: string | undefined = '2026-01-01T00:00:00Z', state = 'pending', rpcCalls = 0;
  global.fetch = async input => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return Response.json({ id, email, email_confirmed_at: confirmed });
    if (url.includes('matzip_submissions')) return Response.json({ name: '식당', address: '서울 강남구', status: state });
    if (url.includes('naverapihub')) return Response.json({ items: [] });
    if (url.includes('/rpc/matzip_review')) { rpcCalls++; return Response.json({ code: '23505', message: 'duplicate' }, { status: 409 }); }
    throw new Error(`Unexpected fixture call: ${url}`);
  };
  const request = () => new Request('https://example.test/api/matzip/admin', { method: 'PATCH', headers: { authorization: 'Bearer fixture-token' }, body: JSON.stringify({ id, action: 'approve' }) });
  try {
    assert.equal((await PATCH(request())).status, 403);
    email = 'mavsdotkr@gmail.com'; confirmed = undefined;
    assert.equal((await PATCH(request())).status, 403);
    confirmed = '2026-01-01T00:00:00Z'; state = 'approved';
    assert.equal((await PATCH(request())).status, 409);
    assert.equal(rpcCalls, 0);
    state = 'pending';
    assert.equal((await PATCH(request())).status, 409);
    assert.equal(rpcCalls, 1);
  } finally {
    global.fetch = original;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
