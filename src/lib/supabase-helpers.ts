// src/lib/supabase-helpers.ts
// Supabase 환경변수를 안전하게 가져오는 헬퍼 함수

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
