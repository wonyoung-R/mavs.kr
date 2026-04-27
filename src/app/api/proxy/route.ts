import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Allowed domains to prevent open-proxy abuse
const ALLOWED_DOMAINS = [
  'espn.com',
  'espn.go.com',
  'mavsmoneyball.com',
  'sbnation.com',
  'thesmokingcuban.com',
  'nba.com',
  'nbcsports.com',
  'theringer.com',
  'bleacherreport.com',
  'theathletic.com',
  'dallasmavs.com',
];

function isAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url || !isAllowed(url)) {
    return new Response('Not allowed', { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const contentType = upstream.headers.get('content-type') ?? 'text/html';
    let html = await upstream.text();

    // Inject <base> so relative URLs (images, CSS, JS) resolve against the original domain
    const { origin } = new URL(url);
    const baseTag = `<base href="${origin}/" target="_blank">`;
    html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    if (!html.includes('<head')) {
      html = baseTag + html;
    }

    return new Response(html, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        // Strip frame-blocking headers — this is the whole point of the proxy
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response('Proxy error', { status: 502 });
  }
}
