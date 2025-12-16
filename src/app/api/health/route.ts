// Health check API - 환경변수 설정 상태 확인
import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co',
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key',
    supabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: !!process.env.DATABASE_URL,
    geminiApiKey: !!process.env.GEMINI_API_KEY,
  };

  const allConfigured = Object.values(checks).every(v => v);

  return NextResponse.json({
    status: allConfigured ? 'healthy' : 'misconfigured',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks,
    message: allConfigured 
      ? 'All environment variables are configured' 
      : 'Some environment variables are missing or using placeholders',
  });
}
