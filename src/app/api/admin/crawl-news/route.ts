// src/app/api/admin/crawl-news/route.ts
// 관리자용 뉴스 크롤링 API

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 제한

export async function POST(request: Request) {
  try {
    // Supabase 인증 확인
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인 (실제로는 DB에서 확인하거나 환경변수로 설정)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email!)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`📰 Manual news crawl started by admin: ${user.email}`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mavs.kr';
    const cronSecret = process.env.CRON_SECRET;

    // 뉴스 크롤링 실행
    const response = await fetch(`${baseUrl}/api/cron/crawl-news`, {
      method: 'POST',
      headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Manual news crawl completed');
      return NextResponse.json({
        success: true,
        message: 'News crawling completed successfully',
        result,
        crawledBy: user.email,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('❌ Manual news crawl failed:', result);
      return NextResponse.json({
        success: false,
        error: 'News crawling failed',
        details: result,
        crawledBy: user.email,
        timestamp: new Date().toISOString(),
      }, { status: response.status });
    }

  } catch (error) {
    console.error('❌ Admin crawl news error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET으로도 실행 가능하게 (테스트용)
export async function GET(request: Request) {
  return POST(request);
}
