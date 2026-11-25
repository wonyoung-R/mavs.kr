import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { MatzipError } from './validation';

export const ADMIN_EMAIL = 'mavsdotkr@gmail.com';

export function database(service = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = service ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('placeholder')) throw new MatzipError('맛집 서비스를 준비 중입니다. 잠시 후 다시 이용해 주세요.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticate(request: Request, admin = false) {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ') || header.length > 8192) throw new MatzipError('로그인이 필요합니다.', 401);
  const token = header.slice(7);
  const { data, error } = await database().auth.getUser(token);
  if (error || !data.user) throw new MatzipError('다시 로그인해 주세요.', 401);
  if (admin && (data.user.email?.toLowerCase() !== ADMIN_EMAIL || !data.user.email_confirmed_at)) throw new MatzipError('관리자만 이용할 수 있습니다.', 403);
  return data.user;
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 6000) throw new MatzipError('입력 내용이 너무 깁니다.', 413);
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new MatzipError('입력 내용을 확인해 주세요.'); }
}

export function failure(error: unknown) {
  if (error instanceof MatzipError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('[matzip]', error instanceof Error ? error.message : 'Database request failed');
  return NextResponse.json({ error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
}

export function requireData(error: { code?: string } | null) {
  if (error?.code === '23505') throw new MatzipError('이미 등록되었거나 승인 대기 중인 장소입니다.', 409);
  if (error) throw new MatzipError('맛집 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
}
