import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db/prisma';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mavs.kr';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${SITE_URL}/?tab=news`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/?tab=community`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/?tab=schedule`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/?tab=column`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/?tab=stats`, changeFrequency: 'daily', priority: 0.6 },
  ];

  let newsEntries: MetadataRoute.Sitemap = [];
  let postEntries: MetadataRoute.Sitemap = [];

  try {
    const news = await prisma.news.findMany({
      select: { id: true, crawledAt: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    });
    newsEntries = news.map(n => ({
      url: `${SITE_URL}/news/${n.id}`,
      lastModified: n.crawledAt ?? n.publishedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (e) {
    console.warn('[sitemap] news fetch failed:', e);
  }

  try {
    const posts = await prisma.post.findMany({
      select: { id: true, updatedAt: true, category: true },
      orderBy: { updatedAt: 'desc' },
      take: 1000,
    });
    postEntries = posts.map(p => ({
      url: `${SITE_URL}/community/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (e) {
    console.warn('[sitemap] post fetch failed:', e);
  }

  return [...staticEntries, ...newsEntries, ...postEntries];
}
