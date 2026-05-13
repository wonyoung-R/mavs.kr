import { NextResponse } from 'next/server';

export function checkCronAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return null;

  // Vercel cron 호출은 자체 인증되므로 user-agent로 추가 허용
  const ua = request.headers.get('user-agent') ?? '';
  if (ua.includes('vercel-cron')) return null;

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function parseDryRun(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get('dry') === '1';
}
