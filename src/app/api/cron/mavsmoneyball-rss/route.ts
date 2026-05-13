import { NextResponse } from 'next/server';
import { load as cheerioLoad } from 'cheerio';
import { prisma } from '@/lib/db/prisma';
import { checkCronAuth, parseDryRun } from '@/lib/auto-content/cron-auth';
import { runPerspectivePipeline } from '@/lib/auto-content/perspective';
import { publishAutoNews } from '@/lib/auto-content/publisher';
import { callGemini } from '@/lib/auto-content/gemini';
import { buildSystemPrompt } from '@/lib/auto-content/prompt/system';

const FEED_URL = 'https://www.mavsmoneyball.com/rss/current.xml';
const MAX_PER_RUN = 3;

interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description?: string;
}

export async function GET(request: Request) {
  const authErr = checkCronAuth(request);
  if (authErr) return authErr;
  const dry = parseDryRun(request);

  try {
    const xml = await (await fetch(FEED_URL, { headers: { 'User-Agent': 'mavs.kr/1.0' } })).text();
    const items = parseRss(xml).slice(0, MAX_PER_RUN * 4);

    const processed: any[] = [];
    let publishedCount = 0;

    for (const item of items) {
      if (publishedCount >= MAX_PER_RUN) break;

      const sourceId = `mmb_${item.guid}`;
      const existing = await prisma.news.findFirst({ where: { sourceId }, select: { id: true } });
      if (existing) continue;

      const articleText = await fetchArticleBody(item.link).catch(() => '');
      if (!articleText || articleText.length < 200) {
        processed.push({ sourceId, skip: 'body fetch failed or too short' });
        continue;
      }

      const recreated = await recreateInKorean(item.title, articleText).catch(e => {
        processed.push({ sourceId, skip: `gemini: ${e?.message ?? e}` });
        return null;
      });
      if (!recreated) continue;

      const persp = await runPerspectivePipeline({
        article: articleText,
        sourceUrl: item.link,
        dryRun: dry,
      });

      if (dry) {
        processed.push({
          sourceId,
          title_kr: recreated.titleKr,
          body_kr_preview: recreated.bodyKr.slice(0, 200),
          perspective_status: persp.status,
          perspective_preview: persp.text,
        });
        publishedCount++;
        continue;
      }

      const result = await publishAutoNews({
        title: recreated.titleKr,
        body: recreated.bodyKr,
        perspectiveText: persp.text,
        perspectiveStatus: persp.status,
        riskLevel: persp.riskLevel,
        source: 'mavsmoneyball',
        sourceId,
        sourceUrl: item.link,
        publishedAt: new Date(item.pubDate),
      });
      processed.push({ sourceId, newsId: result.newsId, perspective_status: persp.status });
      publishedCount++;
    }

    return NextResponse.json({ ok: true, dry, processed_count: processed.length, processed });
  } catch (e) {
    console.error('[cron/mavsmoneyball-rss]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const guid = extractTag(block, 'guid') || link;
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    if (title && link) items.push({ title, link, guid, pubDate, description });
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

async function fetchArticleBody(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'mavs.kr/1.0' } });
  if (!res.ok) return '';
  const html = await res.text();
  const $ = cheerioLoad(html);
  const paragraphs: string[] = [];
  $('article p, .c-entry-content p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 20) paragraphs.push(t);
  });
  return paragraphs.join('\n\n');
}

async function recreateInKorean(originalTitle: string, articleEn: string): Promise<{ titleKr: string; bodyKr: string }> {
  const prompt = `다음 영문 매버릭스 관련 기사를 한국 매버릭스 팬덤이 읽을 한국어 기사로 재창조한다.

규칙:
- 번역이 아닌 재창조. 핵심 사실은 유지하되 한국어 자연스러움 우선.
- 사실 영역 3~4단락, 500~800자.
- 의견/예측/평가 금지. 사실 진술과 인용 위주.
- 인용은 한국어로 옮기되 발언자 명시.
- 마크다운/HTML 태그 없이 순수 텍스트.

JSON으로 응답:
{"titleKr": "<한국어 제목>", "bodyKr": "<한국어 본문>"}

원문 제목: ${originalTitle}
원문 본문:
---
${articleEn.slice(0, 6000)}
---`;

  const raw = await callGemini(prompt, {
    systemInstruction: buildSystemPrompt(),
    temperature: 0.5,
    maxOutputTokens: 1800,
    responseMimeType: 'application/json',
  });
  const parsed = JSON.parse(raw) as { titleKr: string; bodyKr: string };
  return parsed;
}
