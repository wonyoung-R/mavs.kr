import { load as cheerioLoad } from 'cheerio';
import { prisma } from '@/lib/db/prisma';
import { runColumnPipeline } from '../column/pipeline';
import { renderColumnHtml } from '../column/generate-column';
import { publishAutoNews, type TeamTag } from '../publisher';

const FEED_URL = 'https://www.mavsmoneyball.com/rss/current.xml';

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description?: string;
}

export async function fetchRssItems(): Promise<RssItem[]> {
  const xml = await (await fetch(FEED_URL, { headers: { 'User-Agent': 'mavs.kr/1.0' } })).text();
  return parseRss(xml);
}

export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // RSS 2.0
  const rssBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const block of rssBlocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const guid = extractTag(block, 'guid') || link;
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    if (title && link) items.push({ title, link, guid, pubDate, description });
  }
  if (items.length > 0) return items;

  // Atom
  const atomBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const block of atomBlocks) {
    const title = extractTag(block, 'title');
    const linkMatch = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/);
    const link = linkMatch ? linkMatch[1] : '';
    const id = extractTag(block, 'id');
    const guid = id || link;
    const published = extractTag(block, 'published') || extractTag(block, 'updated');
    const summary = extractTag(block, 'summary');
    if (title && link) items.push({ title, link, guid, pubDate: published, description: summary });
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

export async function fetchArticleBody(url: string): Promise<{ text: string; imageUrl?: string }> {
  const res = await fetch(url, { headers: { 'User-Agent': 'mavs.kr/1.0' } });
  if (!res.ok) return { text: '' };
  const html = await res.text();
  const $ = cheerioLoad(html);

  const paragraphs: string[] = [];
  $('article p, .c-entry-content p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 20) paragraphs.push(t);
  });

  let imageUrl: string | undefined;
  const lead = $('article img, .c-entry-hero img, .c-picture img').first().attr('src');
  if (lead && lead.startsWith('http')) imageUrl = lead;

  return { text: paragraphs.join('\n\n'), imageUrl };
}

export function detectTeam(url: string): TeamTag {
  return /\/dallas-wings\//i.test(url) ? 'wings' : 'mavericks';
}

export interface ProcessOneOptions {
  dryRun: boolean;
  skipDuplicateCheck?: boolean;
}

export interface ProcessOneResult {
  ok: boolean;
  reason?: string;
  sourceId?: string;
  team?: TeamTag;
  newsId?: string;
  title_kr?: string;
  body_kr_preview?: string;
  perspective_status?: string;
  risk_level?: string;
  category?: string;
  source_url?: string;
  debug?: unknown;
}

export async function processFirstNewMmbItem(opts: ProcessOneOptions): Promise<ProcessOneResult> {
  const items = await fetchRssItems();
  if (items.length === 0) return { ok: false, reason: 'rss empty' };

  for (const item of items) {
    const sourceId = `mmb_${item.guid}`;
    const team = detectTeam(item.link);

    if (!opts.skipDuplicateCheck && !opts.dryRun) {
      const existing = await prisma.news.findFirst({ where: { sourceId }, select: { id: true } }).catch(() => null);
      if (existing) continue;
    }

    const { text: articleText, imageUrl } = await fetchArticleBody(item.link).catch(() => ({ text: '', imageUrl: undefined as string | undefined }));
    if (!articleText || articleText.length < 200) continue;

    let pipe;
    try {
      pipe = await runColumnPipeline({
        article: articleText,
        sourceUrl: item.link,
        sourceLabel: 'Mavs Moneyball',
        team,
        dryRun: opts.dryRun,
      });
    } catch (e) {
      return { ok: false, reason: `pipeline failed: ${e instanceof Error ? e.message : String(e)}` };
    }

    // 환각 탐지로 reject 받았으면 다음 글 시도
    if (pipe.shouldSkipPublish) {
      continue;
    }

    const col = pipe.column;
    const bodyHtml = renderColumnHtml(col);

    if (opts.dryRun) {
      return {
        ok: true,
        sourceId,
        team,
        title_kr: col.titleKr,
        body_kr_preview: [col.leadParagraph, ...col.bodyParagraphs.slice(0, 1)].join('\n\n').slice(0, 400),
        perspective_status: pipe.status,
        risk_level: col.riskLevel,
        category: col.category,
        source_url: item.link,
        debug: {
          metaDescription: col.metaDescription,
          critique1: pipe.critique1,
          critique2: pipe.critique2,
          hallucinations: pipe.hallucinations,
          bannedPatternHit: pipe.bannedPatternHit,
          closingParagraph: col.closingParagraph,
        },
      };
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

    return {
      ok: true,
      sourceId,
      team,
      newsId: result.newsId,
      title_kr: col.titleKr,
      perspective_status: pipe.status,
      risk_level: col.riskLevel,
      category: col.category,
      source_url: item.link,
    };
  }

  return { ok: false, reason: 'all items already published' };
}
