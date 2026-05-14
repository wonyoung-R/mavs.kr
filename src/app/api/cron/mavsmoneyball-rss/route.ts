import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkCronAuth, parseDryRun } from '@/lib/auto-content/cron-auth';
import { runColumnPipeline } from '@/lib/auto-content/column/pipeline';
import { renderColumnHtml } from '@/lib/auto-content/column/generate-column';
import { publishAutoNews } from '@/lib/auto-content/publisher';
import {
  fetchRssItems,
  fetchArticleBody,
  detectTeam,
} from '@/lib/auto-content/sources/mavsmoneyball';

// cron이 하루 3회(KST 8/14/18시) 실행 → 각 실행당 1건 = 하루 최대 3건
// 중복 방지: sourceId(mmb_<guid>) 기준으로 이미 발행된 글은 skip
const MAX_PER_RUN = 1;

export async function GET(request: Request) {
  const authErr = checkCronAuth(request);
  if (authErr) return authErr;
  const dry = parseDryRun(request);

  try {
    const items = (await fetchRssItems()).slice(0, MAX_PER_RUN * 4);
    const processed: any[] = [];
    let publishedCount = 0;

    for (const item of items) {
      if (publishedCount >= MAX_PER_RUN) break;

      // 글 간 600ms sleep — Gemini RPM 한도 회피
      if (processed.length > 0) await new Promise(r => setTimeout(r, 600));

      const sourceId = `mmb_${item.guid}`;
      const team = detectTeam(item.link);
      if (!dry) {
        const existing = await prisma.news.findFirst({ where: { sourceId }, select: { id: true } });
        if (existing) continue;
      }

      const { text: articleText, imageUrl } = await fetchArticleBody(item.link).catch(() => ({ text: '', imageUrl: undefined as string | undefined }));
      if (!articleText || articleText.length < 200) {
        processed.push({ sourceId, skip: 'body too short' });
        continue;
      }

      let pipe;
      try {
        pipe = await runColumnPipeline({
          article: articleText,
          sourceUrl: item.link,
          sourceLabel: 'Mavs Moneyball',
          team,
          dryRun: dry,
        });
      } catch (e: any) {
        processed.push({ sourceId, skip: `pipeline: ${e?.message ?? e}` });
        continue;
      }

      // 환각 탐지로 reject 받았으면 다음 글 시도
      if (pipe.shouldSkipPublish) {
        processed.push({ sourceId, team, skip: `rejected by critique`, reason: pipe.critique2 ?? pipe.critique1 });
        continue;
      }

      const col = pipe.column;
      const bodyHtml = renderColumnHtml(col);

      if (dry) {
        processed.push({
          sourceId,
          team,
          title_kr: col.titleKr,
          meta: col.metaDescription,
          body_preview: [col.leadParagraph, ...col.bodyParagraphs.slice(0, 1)].join('\n\n').slice(0, 300),
          perspective_status: pipe.status,
          risk_level: col.riskLevel,
          category: col.category,
        });
        publishedCount++;
        continue;
      }

      const result = await publishAutoNews({
        title: col.titleKr,
        body: bodyHtml,
        summary: col.metaDescription,
        perspectiveStatus: pipe.status,
        riskLevel: col.riskLevel,
        source: 'mavsmoneyball',
        sourceId,
        sourceUrl: item.link,
        publishedAt: new Date(item.pubDate || Date.now()),
        team,
        imageUrl,
      });
      processed.push({ sourceId, team, newsId: result.newsId, perspective_status: pipe.status });
      publishedCount++;
    }

    return NextResponse.json({ ok: true, dry, processed_count: processed.length, processed });
  } catch (e) {
    console.error('[cron/mavsmoneyball-rss]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
