import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting news update cron job...');

    // 모든 뉴스 소스 업데이트
    const sources = ['espn', 'reddit', 'tsc'];
    const updates = await Promise.allSettled(
      sources.map(async (source) => {
        try {
          const response = await fetch(`${request.nextUrl.origin}/api/news/${source}?limit=20`);
          if (!response.ok) throw new Error(`Failed to fetch ${source}`);
          const data = await response.json();
          return { source, articles: data.articles || [], success: true };
        } catch (error) {
          console.error(`Error updating ${source}:`, error);
          return { source, articles: [], success: false, error: error.message };
        }
      })
    );

    const results = updates.map(result =>
      result.status === 'fulfilled' ? result.value : { source: 'unknown', articles: [], success: false }
    );

    const totalArticles = results.reduce((sum, result) => sum + result.articles.length, 0);
    const successfulSources = results.filter(r => r.success).length;

    console.log(`News update completed: ${totalArticles} articles from ${successfulSources}/${sources.length} sources`);

    // 데이터베이스에 저장하는 로직 (필요시 추가)
    // await saveNewsToDatabase(results.flatMap(r => r.articles));

    // 웹소켓으로 실시간 알림 (필요시 추가)
    // notifyClients({ type: 'news:updated', timestamp: new Date() });

    return NextResponse.json({
      success: true,
      updated: totalArticles,
      sources: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST 요청도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
}
