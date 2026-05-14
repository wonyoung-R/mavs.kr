import { config } from 'dotenv';
// override 없음 — 커맨드라인 ANTHROPIC_MODEL이 .env.local보다 우선
config({ path: '.env.local' });

const SAMPLE_ARTICLE = `날짜(ET): 2026-03-05. 원정에서 진행된 경기.
댈러스 매버릭스 98점, 피닉스 선스 110점.
결과: 매버릭스 패배 (12점 차).
매버릭스 주요 선수 기록:
- 카이리 어빙 (선발): 24점, 리바운드 3, 어시스트 6. 야투 9/19.
- 클레이 톰슨 (선발): 18점, 리바운드 4, 어시스트 2. 야투 7/15, 3점 4/9.
피닉스 선스 주요 선수:
- 데빈 부커: 31점, 리바운드 5, 어시스트 8.`;

// 가격 (USD per 1M tokens)
const PRICING: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  'claude-haiku-4-5': { in: 1.0, out: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-4-6': { in: 3.0, out: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
};

function cost(model: string, u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): number {
  const p = PRICING[model] ?? PRICING['claude-haiku-4-5'];
  return (
    (u.inputTokens / 1e6) * p.in +
    (u.outputTokens / 1e6) * p.out +
    (u.cacheReadTokens / 1e6) * p.cacheRead +
    (u.cacheWriteTokens / 1e6) * p.cacheWrite
  );
}

async function main() {
  const { generateColumn } = await import('@/lib/auto-content/column/generate-column');
  const { critiqueColumn } = await import('@/lib/auto-content/column/critique-column');
  const { getLastUsage, CLAUDE_MODEL } = await import('@/lib/auto-content/claude');

  console.log(`\n=== MODEL: ${CLAUDE_MODEL} ===\n`);

  // --- generateColumn ---
  const t1 = Date.now();
  const col = await generateColumn(SAMPLE_ARTICLE, 'mavericks', 'NBA.com');
  const genMs = Date.now() - t1;
  const genU = getLastUsage()!;

  console.log('[generateColumn]');
  console.log(`  시간: ${genMs}ms`);
  console.log(`  usage: in=${genU.inputTokens} out=${genU.outputTokens} cacheR=${genU.cacheReadTokens} cacheW=${genU.cacheWriteTokens}`);
  console.log(`  category: ${col.category}`);
  console.log(`  title: ${col.titleKr}`);
  console.log(`  lead: ${col.leadParagraph}`);
  console.log(`  body[0]: ${col.bodyParagraphs[0] ?? '(없음)'}`);
  console.log(`  closing: ${col.closingParagraph}`);

  // --- critiqueColumn ---
  const t2 = Date.now();
  const crit = await critiqueColumn(SAMPLE_ARTICLE, col, 'mavericks');
  const critMs = Date.now() - t2;
  const critU = getLastUsage()!;

  console.log('\n[critiqueColumn]');
  console.log(`  시간: ${critMs}ms`);
  console.log(`  usage: in=${critU.inputTokens} out=${critU.outputTokens} cacheR=${critU.cacheReadTokens} cacheW=${critU.cacheWriteTokens}`);
  console.log(`  result: ${crit.result}`);
  console.log(`  reason: ${crit.reason}`);
  if (crit.hallucinations?.length) console.log(`  hallucinations: ${JSON.stringify(crit.hallucinations)}`);

  // --- 비용 합산 (캐시 미적중 = 콜드 1회 기준) ---
  const totalCost = cost(CLAUDE_MODEL, genU) + cost(CLAUDE_MODEL, critU);
  console.log(`\n[비용] generate + critique 1세트`);
  console.log(`  $${totalCost.toFixed(5)} (₩${Math.round(totalCost * 1400)})`);
  console.log(`  총 시간: ${genMs + critMs}ms`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
