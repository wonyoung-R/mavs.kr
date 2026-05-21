// src/app/api/admin/crawl-news/route.ts
// 관리자용 뉴스 크롤링 API

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 제한

export async function POST(request: Request) {
  try {
    // 임시로 인증 체크 비활성화 (테스트용)
    const skipAuth = true;
    let userEmail: string = 'system'; // 기본값
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!skipAuth) {
      // Supabase 인증 확인
      const cookieStore = await cookies();
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

      // 관리자 권한 확인
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
      if (!adminEmails.includes(user.email!)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      userEmail = user.email!;
    }

    console.log(`📰 Manual news crawl started by admin: ${userEmail}`);

    // 로컬 개발 환경에서는 request URL에서 호스트 추출
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.mavs.kr';

    if (isDevelopment) {
      const requestUrl = new URL(request.url);
      baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      console.log(`🔧 Development mode - using baseUrl: ${baseUrl}`);
    }

    const cronSecret = process.env.CRON_SECRET;

    // 뉴스 크롤링 실행
    console.log(`📡 Calling ${baseUrl}/api/cron/crawl-news`);
    const response = await fetch(`${baseUrl}/api/cron/crawl-news`, {
      method: 'POST',
      headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
    });

    // 응답 확인
    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Cron API returned ${response.status}: ${text.substring(0, 200)}`);
      throw new Error(`Cron API failed with status ${response.status}`);
    }

    // 응답 타입 확인
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`❌ Cron API returned non-JSON: ${text.substring(0, 200)}`);
      throw new Error('Cron API did not return JSON');
    }

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Manual news crawl completed');
      return NextResponse.json({
        success: true,
        message: 'News crawling completed successfully',
        result,
        crawledBy: userEmail,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('❌ Manual news crawl failed:', result);
      return NextResponse.json({
        success: false,
        error: 'News crawling failed',
        details: result,
        crawledBy: userEmail,
        timestamp: new Date().toISOString(),
      }, { status: response.status });
    }

  } catch (error) {
    console.error('❌ Admin crawl news error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET으로도 실행 가능하게 (테스트용)
export async function GET(request: Request) {
  return POST(request);
}
