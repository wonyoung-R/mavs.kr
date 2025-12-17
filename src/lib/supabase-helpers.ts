// src/lib/supabase-helpers.ts
// Supabase 환경변수를 안전하게 가져오는 헬퍼 함수

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 실제 값이 없으면 null 반환
  const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');

  return {
    supabaseUrl: supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey: supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder',
    isConfigured,
  };
}

export function requireSupabaseEnv() {
  const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    throw new Error('Supabase is not configured. Please login to use this feature.');
  }

  return { supabaseUrl, supabaseAnonKey };
}

// Server Action용 Supabase 클라이언트 생성
export async function createServerActionClient() {
  const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    throw new Error('로그인 기능이 설정되지 않았습니다.');
  }

  const cookieStore = await cookies();

  // 디버깅: 모든 쿠키 출력
  const allCookies = cookieStore.getAll();
  console.log('🍪 Available cookies:', allCookies.map(c => c.name));

  // Supabase 인증 쿠키 확인
  const authCookie = allCookies.find(c => c.name.includes('auth-token'));
  console.log('🔑 Auth cookie found:', !!authCookie);

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          const value = cookieStore.get(name)?.value;
          if (name.includes('auth-token')) {
            console.log(`🍪 Getting cookie: ${name}, exists: ${!!value}`);
          }
          return value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // Server Component에서는 쿠키 설정이 안 될 수 있음
            console.log('⚠️ Failed to set cookie:', name);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', options);
          } catch {
            // 무시
          }
        },
      },
    }
  );
}
