/**
 * 발행 즉시 검색 엔진에 sitemap 갱신 ping.
 *
 * Google은 더 이상 ping 받지 않지만 (IndexNow 사용 권장),
 * Bing/Yandex 등은 여전히 동작. 그리고 IndexNow API 사용 가능.
 *
 * 환경변수:
 * - INDEXNOW_API_KEY: IndexNow 키 (https://www.indexnow.org/)
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mavs.kr';

export async function pingIndexing(urls: string[]): Promise<{ ok: boolean; provider?: string; error?: string }> {
  if (urls.length === 0) return { ok: true };

  const apiKey = process.env.INDEXNOW_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'INDEXNOW_API_KEY missing' };
  }

  const host = new URL(SITE_URL).host;
  const body = {
    host,
    key: apiKey,
    keyLocation: `${SITE_URL}/${apiKey}.txt`,
    urlList: urls,
  };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, provider: 'IndexNow' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
