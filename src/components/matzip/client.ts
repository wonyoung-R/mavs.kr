import { supabase } from '@/lib/db/supabase';

export async function matzipRequest<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (authenticated) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('로그인 후 이용해 주세요.');
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
  return data as T;
}
