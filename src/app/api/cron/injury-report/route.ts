import { NextResponse } from 'next/server';
import { checkCronAuth, parseDryRun } from '@/lib/auto-content/cron-auth';

/**
 * NBA Injury Report PDF 파이프라인.
 *
 * 현재 상태: 스켈레톤. `pdf-parse` 의존성 추가 후 본격 구현 예정.
 *
 * 추가 필요한 작업 (Ryu 확인 후 진행):
 *   1. npm install pdf-parse
 *   2. PDF URL 패턴 fetch: https://ak-static.cms.nba.com/referee/injury/Injury-Report_YYYY-MM-DD_HHPM.pdf
 *   3. Dallas Mavericks 섹션 텍스트 파싱
 *   4. 전일 대비 변동 있는 선수만 추출
 *   5. 한국어 글 생성 (300~500자) + 시각 박스 파이프라인
 *   6. publishAutoNews
 */
export async function GET(request: Request) {
  const authErr = checkCronAuth(request);
  if (authErr) return authErr;
  const dry = parseDryRun(request);

  return NextResponse.json({
    ok: false,
    skeleton: true,
    dry,
    message: 'injury-report cron is a skeleton. Install pdf-parse and enable.',
    next_steps: [
      'npm install pdf-parse',
      'Implement PDF fetch + parse + Mavericks filter',
      'Implement diff vs previous day',
      'Wire to runPerspectivePipeline + publishAutoNews',
    ],
  });
}
