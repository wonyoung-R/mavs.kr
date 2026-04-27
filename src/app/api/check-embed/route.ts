import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ embedAllowed: false });

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MavsKR/1.0)' },
    });

    const xfo = res.headers.get('x-frame-options') ?? '';
    const csp = res.headers.get('content-security-policy') ?? '';

    // X-Frame-Options: DENY or SAMEORIGIN → blocked for cross-origin
    const xfoBlocked = /deny|sameorigin/i.test(xfo);

    // CSP frame-ancestors: anything other than * is effectively blocked for us
    const faMatch = csp.match(/frame-ancestors\s+([^;]+)/i);
    const cspBlocked = faMatch ? !faMatch[1].includes('*') : false;

    return NextResponse.json({ embedAllowed: !xfoBlocked && !cspBlocked });
  } catch {
    // Can't reach or timeout → open in new tab to avoid broken iframe
    return NextResponse.json({ embedAllowed: false });
  }
}
