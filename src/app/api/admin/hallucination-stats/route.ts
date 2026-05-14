import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createServerActionClient } from '@/lib/supabase-helpers';

const ADMIN_EMAIL = 'mavsdotkr@gmail.com';

/**
 * REJECT/REVISE된 perspective_logs를 분석해 자주 발생하는 환각 패턴을 보고.
 * 운영 중 프롬프트 튜닝에 사용.
 */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    const supabase = await createServerActionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const logs = await prisma.perspectiveLog.findMany({
    where: { createdAt: { gte: since }, usedFallback: true },
    select: { critique1: true, critique2: true, bannedPatternHit: true, riskLevel: true, createdAt: true },
    take: 200,
  });

  const bannedHits: Record<string, number> = {};
  const critiqueReasons: { reason: string; count: number }[] = [];
  const reasonMap: Record<string, number> = {};
  const riskBreakdown: Record<string, number> = {};

  for (const log of logs) {
    if (log.bannedPatternHit) bannedHits[log.bannedPatternHit] = (bannedHits[log.bannedPatternHit] || 0) + 1;
    if (log.riskLevel) riskBreakdown[log.riskLevel] = (riskBreakdown[log.riskLevel] || 0) + 1;

    // critique 응답에서 첫 50자만 key로 묶어 빈도 분석
    const summary = (log.critique2 ?? log.critique1 ?? '').slice(0, 80);
    if (summary) reasonMap[summary] = (reasonMap[summary] || 0) + 1;
  }

  for (const [reason, count] of Object.entries(reasonMap).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    critiqueReasons.push({ reason, count });
  }

  return NextResponse.json({
    ok: true,
    window: '30d',
    total_fallback: logs.length,
    banned_pattern_hits: bannedHits,
    risk_breakdown: riskBreakdown,
    top_critique_reasons: critiqueReasons,
  });
}
