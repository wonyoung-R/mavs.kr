import { NextRequest, NextResponse } from 'next/server';
import { legacyRecordPath } from '@/lib/records/paths';

export function proxy(request: NextRequest) {
  const destination = legacyRecordPath(request.nextUrl.pathname);
  if (destination) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    return NextResponse.redirect(url, 308);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-mavs-language', /^\/stat\/en(?:\/|$)/.test(request.nextUrl.pathname) ? 'en' : 'ko');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
