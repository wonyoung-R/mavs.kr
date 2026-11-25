import { createClient } from '@supabase/supabase-js';

const url = 'https://fyndqosuunhfwkgqmofu.supabase.co';
let browserClient: NonNullable<ReturnType<typeof createTourAuthClient>> | undefined;

export function createTourAuthClient(persistSession: boolean) {
  const key = process.env.NEXT_PUBLIC_TOUR_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key?.startsWith('sb_publishable_')) return null;
  return createClient(url, key, {
    auth: { storageKey: 'mavs-tour-admin', persistSession, autoRefreshToken: persistSession, detectSessionInUrl: false },
  });
}

export function getTourBrowserAuth() {
  return browserClient ??= createTourAuthClient(true) ?? undefined;
}
