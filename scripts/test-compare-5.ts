import { config } from 'dotenv';
config({ path: '.env.local' });
import { writeFileSync } from 'fs';
import { join } from 'path';

const MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6'] as const;
const SAMPLE_COUNT = 5;

const PRICING: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  'claude-haiku-4-5': { in: 1.0, out: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-4-6': { in: 3.0, out: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
};

function cost(model: string, u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): number {
  const p = PRICING[model];
  return (
    (u.inputTokens / 1e6) * p.in +
    (u.outputTokens / 1e6) * p.out +
    (u.cacheReadTokens / 1e6) * p.cacheRead +
    (u.cacheWriteTokens / 1e6) * p.cacheWrite
  );
}

interface Row {
  model: string;
  status: string;
  category: string;
  titleKr: string;
  body: string;
  closing: string;
  critique1?: string;
  critique2?: string;
  hallucinations?: string[];
  usedFallback: boolean;
  calls: number;
  costUsd: number;
  ms: number;
}

async function main() {
  const { fetchRssItems, fetchArticleBody, detectTeam } = await import('@/lib/auto-content/sources/mavsmoneyball');
  const { runColumnPipeline } = await import('@/lib/auto-content/column/pipeline');
  const { resetUsage, getAccumulatedUsage } = await import('@/lib/auto-content/claude');

  console.log('MMB RSS fetch...');
  const items = await fetchRssItems();
  const samples: { title: string; link: string; team: 'mavericks' | 'wings'; article: string }[] = [];

  for (const item of items) {
    if (samples.length >= SAMPLE_COUNT) break;
    const { text } = await fetchArticleBody(item.link).catch(() => ({ text: '' }));
    if (!text || text.length < 200) continue;
    samples.push({ title: item.title, link: item.link, team: detectTeam(item.link), article: text });
  }
  console.log(`샘플 ${samples.length}건 확보\n`);

  const results: { sample: typeof samples[0]; rows: Row[] }[] = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    console.log(`[${i + 1}/${samples.length}] ${s.title} (${s.team})`);
    const rows: Row[] = [];

    for (const model of MODELS) {
      resetUsage();
      const t0 = Date.now();
      let pipe;
      try {
        pipe = await runColumnPipeline({
          article: s.article,
          sourceUrl: s.link,
          sourceLabel: 'Mavs Moneyball',
          team: s.team,
          dryRun: true,
          model,
        });
      } catch (e) {
        console.log(`   ${model}: ERROR ${e instanceof Error ? e.message : e}`);
        continue;
      }
      const ms = Date.now() - t0;
      const u = getAccumulatedUsage();
      const c = cost(model, u);
      rows.push({
        model,
        status: pipe.status,
        category: pipe.column.category,
        titleKr: pipe.column.titleKr,
        body: [pipe.column.leadParagraph, ...pipe.column.bodyParagraphs].join('\n\n'),
        closing: pipe.column.closingParagraph,
        critique1: pipe.critique1,
        critique2: pipe.critique2,
        hallucinations: pipe.hallucinations,
        usedFallback: pipe.usedFallback,
        calls: u.calls,
        costUsd: c,
        ms,
      });
      console.log(`   ${model}: ${pipe.status} (calls=${u.calls}, ₩${Math.round(c * 1400)}, ${ms}ms)`);
    }
    results.push({ sample: s, rows });
  }

  // ---- md 생성 ----
  const lines: string[] = [];
  lines.push('# Haiku vs Sonnet 정밀 비교 — MMB 외신 5건');
  lines.push('');
  lines.push(`생성: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} | 샘플: ${samples.length}건 | 각 모델 runColumnPipeline (dry-run)`);
  lines.push('');

  // 집계
  lines.push('## 집계');
  lines.push('');
  lines.push('| 모델 | passed | fallback | rejected | 재생성 발생 | 총 비용 | 총 시간 | 평균/글 |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const model of MODELS) {
    const rs = results.map(r => r.rows.find(x => x.model === model)).filter(Boolean) as Row[];
    const passed = rs.filter(r => r.status === 'passed').length;
    const fallback = rs.filter(r => r.status === 'fallback').length;
    const rejected = rs.filter(r => r.status === 'rejected').length;
    const regen = rs.filter(r => r.critique2 !== undefined).length;
    const totalCost = rs.reduce((a, r) => a + r.costUsd, 0);
    const totalMs = rs.reduce((a, r) => a + r.ms, 0);
    lines.push(
      `| ${model} | ${passed} | ${fallback} | ${rejected} | ${regen} | ₩${Math.round(totalCost * 1400)} ($${totalCost.toFixed(4)}) | ${(totalMs / 1000).toFixed(1)}s | ₩${Math.round((totalCost * 1400) / rs.length)} |`,
    );
  }
  lines.push('');
  lines.push('> status: passed=정상발행 / fallback=closing만 폴백교체 후 발행 / rejected=환각탐지로 발행skip');
  lines.push('> 재생성 발생: critique이 첫 draft를 REVISE해서 두 번째 generate 호출이 일어난 횟수');
  lines.push('');

  // 기사별 상세
  for (let i = 0; i < results.length; i++) {
    const { sample, rows } = results[i];
    lines.push(`---`);
    lines.push('');
    lines.push(`## 기사 ${i + 1}: ${sample.title}`);
    lines.push('');
    lines.push(`- 출처: ${sample.link}`);
    lines.push(`- team: ${sample.team}`);
    lines.push('');

    for (const row of rows) {
      lines.push(`### ${row.model}`);
      lines.push('');
      lines.push(`- **status**: ${row.status}${row.usedFallback ? ' (fallback 적용)' : ''} | category: ${row.category} | calls: ${row.calls} | 비용: ₩${Math.round(row.costUsd * 1400)} | ${row.ms}ms`);
      lines.push(`- **제목**: ${row.titleKr}`);
      lines.push('');
      lines.push('```');
      lines.push(row.body);
      lines.push('');
      lines.push(`[마무리] ${row.closing}`);
      lines.push('```');
      lines.push('');
      if (row.critique1) lines.push(`- critique1: ${row.critique1}`);
      if (row.critique2) lines.push(`- critique2: ${row.critique2}`);
      if (row.hallucinations?.length) lines.push(`- 환각 탐지: ${JSON.stringify(row.hallucinations, null, 0)}`);
      lines.push('');
    }
  }

  const outPath = join(process.cwd(), 'outputs', 'model-comparison-0514.md');
  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`\n✅ ${outPath} 작성 완료`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
