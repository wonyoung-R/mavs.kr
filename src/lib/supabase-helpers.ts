// src/lib/supabase-helpers.ts
// Supabase 환경변수를 안전하게 가져오는 헬퍼 함수

export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

  // 빌드 시에는 placeholder 허용, 런타임에는 실제 값 필요
  const isPlaceholder = supabaseUrl === 'https://placeholder.supabase.co';

  return {
    supabaseUrl,
    supabaseAnonKey,
    isPlaceholder,
  };
}

export function requireSupabaseEnv() {
  const { supabaseUrl, supabaseAnonKey, isPlaceholder } = getSupabaseEnv();

  if (isPlaceholder) {
    throw new Error('Supabase environment variables are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return { supabaseUrl, supabaseAnonKey };
}
