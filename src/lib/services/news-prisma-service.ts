// src/lib/services/news-prisma-service.ts
// Prisma 기반 통합 뉴스 서비스 (크롤링, 저장, 번역)

import { prisma } from '@/lib/db/prisma';
import { NewsSource, Prisma } from '@prisma/client';
import { translateWithGemini, translateContentWithGemini } from '@/lib/api/gemini';

// 타입 정의
export interface NewsArticleInput {
  title: string;
  content?: string;
  summary?: string;
  source: NewsSource;
  sourceUrl: string;
  author?: string;
  imageUrl?: string;
  publishedAt: Date;
}

export interface NewsQueryOptions {
  limit?: number;
  offset?: number;
  source?: NewsSource;
  onlyTranslated?: boolean;
  orderBy?: 'publishedAt' | 'crawledAt';
}

// 뉴스 저장 (중복 체크 포함, sourceUrl 기준 upsert)
export async function saveNews(article: NewsArticleInput) {
  const existing = await prisma.news.findFirst({
    where: { sourceUrl: article.sourceUrl },
  });

  if (existing) {
    return await prisma.news.update({
      where: { id: existing.id },
      data: {
        title: article.title,
        content: article.content || existing.content,
        imageUrl: article.imageUrl || existing.imageUrl,
      },
    });
  }

  return await prisma.news.create({
    data: {
      title: article.title,
      content: article.content || '',
      summary: article.summary,
      source: article.source,
      sourceUrl: article.sourceUrl,
      author: article.author,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      titleKr: null,
      contentKr: null,
      summaryKr: null,
    },
  });
}

// 여러 뉴스 일괄 저장
export async function saveNewsMany(articles: NewsArticleInput[]) {
  const results = { saved: 0, updated: 0, errors: 0 };

  for (const article of articles) {
    try {
      const existing = await prisma.news.findFirst({
        where: { sourceUrl: article.sourceUrl },
      });

      if (existing) {
        await prisma.news.update({
          where: { id: existing.id },
          data: { 
            title: article.title, 
            content: article.content || existing.content,
            imageUrl: article.imageUrl || existing.imageUrl,
          },
        });
        results.updated++;
      } else {
        await prisma.news.create({
          data: {
            title: article.title,
            content: article.content || '',
            source: article.source,
            sourceUrl: article.sourceUrl,
            author: article.author,
            imageUrl: article.imageUrl,
            publishedAt: article.publishedAt,
            titleKr: null,
            contentKr: null,
            summaryKr: null,
          },
        });
        results.saved++;
      }
    } catch (error) {
      console.error('[NewsService] Error:', article.sourceUrl, error);
      results.errors++;
    }
  }
  return results;
}

// 뉴스 목록 조회
export async function getNews(options: NewsQueryOptions = {}) {
  const { limit = 20, offset = 0, source, onlyTranslated = false, orderBy = 'publishedAt' } = options;

  const where: Prisma.NewsWhereInput = {};
  if (source) where.source = source;
  if (onlyTranslated) where.titleKr = { not: null };

  return await prisma.news.findMany({
    where,
    orderBy: { [orderBy]: 'desc' },
    skip: offset,
    take: limit,
    include: { tags: true },
  });
}

// 뉴스 단건 조회
export async function getNewsById(id: string) {
  return await prisma.news.findUnique({
    where: { id },
    include: { tags: true },
  });
}

// 뉴스 개수 조회
export async function getNewsCount(options: { source?: NewsSource; onlyTranslated?: boolean } = {}) {
  const where: Prisma.NewsWhereInput = {};
  if (options.source) where.source = options.source;
  if (options.onlyTranslated) where.titleKr = { not: null };
  return await prisma.news.count({ where });
}

// 번역되지 않은 뉴스 조회
export async function getUntranslatedNews(limit: number = 10) {
  return await prisma.news.findMany({
    where: { titleKr: null },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

// 단일 뉴스 번역 실행
export async function translateNewsById(id: string): Promise<{ success: boolean; error?: string; titleKr?: string }> {
  try {
    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) return { success: false, error: 'News not found' };

    console.log(`🌐 Translating: "${news.title.substring(0, 50)}..."`);
    const titleKr = await translateWithGemini(news.title);
    if (!titleKr) return { success: false, error: 'Title translation failed' };

    let contentKr: string | undefined;
    if (news.content && news.content.length > 50) {
      try {
        contentKr = await translateContentWithGemini(news.content);
      } catch (err) {
        console.error('Content translation failed:', err);
      }
    }

    await prisma.news.update({
      where: { id },
      data: { titleKr, contentKr: contentKr || null },
    });

    console.log(`✅ Translation saved: ${id}`);
    return { success: true, titleKr };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// 미번역 뉴스 일괄 번역
export async function translateUntranslatedNews(limit: number = 5): Promise<{ translated: number; errors: number }> {
  const results = { translated: 0, errors: 0 };
  const untranslated = await getUntranslatedNews(limit);
  console.log(`📝 Found ${untranslated.length} untranslated articles`);

  for (const news of untranslated) {
    try {
      const titleKr = await translateWithGemini(news.title);
      if (!titleKr) { results.errors++; continue; }

      let contentKr: string | undefined;
      if (news.content && news.content.length > 50) {
        try { contentKr = await translateContentWithGemini(news.content); } catch {}
      }

      await prisma.news.update({
        where: { id: news.id },
        data: { titleKr, contentKr: contentKr || null },
      });

      results.translated++;
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Rate limit 대응
    } catch (error) {
      console.error(`❌ Error translating ${news.id}:`, error);
      results.errors++;
    }
  }
  return results;
}

// 조회수 증가
export async function incrementViewCount(id: string) {
  return await prisma.news.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });
}

