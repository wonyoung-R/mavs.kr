import { config } from 'dotenv';
config({ path: '.env.local', override: true });

// 동적 import — dotenv가 claude.ts의 new Anthropic() 보다 먼저 실행되도록
const SAMPLE_ARTICLE = `날짜(ET): 2026-03-02. 홈에서 진행된 경기.
댈러스 매버릭스 112점, 멤피스 그리즐리스 105점.
결과: 매버릭스 승리 (7점 차).
쿼터별 점수 — 매버릭스: 28-30-26-28, 그리즐리스: 25-27-29-24.`;

async function main() {
  const { generateColumn } = await import('@/lib/auto-content/column/generate-column');
  const { getLastUsage, CLAUDE_MODEL } = await import('@/lib/auto-content/claude');

  console.log(`Model: ${CLAUDE_MODEL}\n`);

  console.log('1st generateColumn 호출...');
  const col1 = await generateColumn(SAMPLE_ARTICLE, 'mavericks', 'NBA.com');
  const u1 = getLastUsage();
  console.log('  usage:', JSON.stringify(u1));
  console.log('  title:', col1.titleKr);

  console.log('\n2nd generateColumn 호출 (동일 system 프롬프트)...');
  const col2 = await generateColumn(SAMPLE_ARTICLE, 'mavericks', 'NBA.com');
  const u2 = getLastUsage();
  console.log('  usage:', JSON.stringify(u2));

  console.log('');
  if (u2 && u2.cacheReadTokens > 0) {
    const saved = Math.round((u2.cacheReadTokens / (u2.inputTokens + u2.cacheReadTokens)) * 100);
    console.log(`✅ PROMPT CACHING 작동`);
    console.log(`   2회차: cache_read ${u2.cacheReadTokens} tokens, 일반 input ${u2.inputTokens} tokens`);
    console.log(`   → input의 약 ${saved}%가 캐시에서 읽힘 (그 부분 비용 90% 절감)`);
  } else if (u1 && u1.cacheWriteTokens > 0) {
    console.log(`⚠️ 1회차 cache_write ${u1.cacheWriteTokens} 됐으나 2회차 read 미적중`);
    console.log(`   2회차 usage: ${JSON.stringify(u2)}`);
  } else {
    console.log(`❌ 캐시 미작동`);
    console.log(`   1회차: ${JSON.stringify(u1)}`);
    console.log(`   system 프롬프트가 ${CLAUDE_MODEL} 최소 캐시 기준 미달일 가능성`);
  }
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
