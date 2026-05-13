const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mavs.kr';
const SITE_NAME = 'MAVS.KR';
const SITE_LOGO = `${SITE_URL}/logo.png`;

export interface NewsArticleInput {
  id: string;
  title: string;
  titleKr?: string | null;
  content: string;
  contentKr?: string | null;
  imageUrl?: string | null;
  publishedAt: Date | string;
  crawledAt?: Date | string | null;
  sourceUrl?: string | null;
  author?: string | null;
}

export function buildNewsArticleSchema(article: NewsArticleInput) {
  const url = `${SITE_URL}/news/${article.id}`;
  const headline = article.titleKr ?? article.title;
  const description = stripHtml(article.contentKr ?? article.content).slice(0, 240);
  const datePublished = toISO(article.publishedAt);
  const dateModified = toISO(article.crawledAt ?? article.publishedAt);

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline,
    description,
    image: article.imageUrl ? [article.imageUrl] : [SITE_LOGO],
    datePublished,
    dateModified,
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: SITE_LOGO },
    },
    inLanguage: 'ko',
    isAccessibleForFree: true,
  };
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toISO(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
