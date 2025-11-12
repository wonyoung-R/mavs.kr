import { NewsArticle } from '@/types/news';

/**
 * Get color classes for a news source
 */
export function getSourceColor(source: string): string {
  const normalized = source.toLowerCase();

  switch (normalized) {
    case 'espn':
      return 'text-red-300 bg-red-600/20 border-red-500/30';
    case 'reddit':
      return 'text-orange-300 bg-orange-600/20 border-orange-500/30';
    case 'the smoking cuban':
    case 'smoking cuban':
      return 'text-blue-300 bg-blue-600/20 border-blue-500/30';
    case '네이버 스포츠':
    case 'naver':
      return 'text-green-300 bg-green-600/20 border-green-500/30';
    default:
      return 'text-slate-300 bg-slate-600/20 border-slate-500/30';
  }
}

/**
 * Get icon for a news source
 */
export function getSourceIcon(source: string): string {
  const normalized = source.toLowerCase();

  switch (normalized) {
    case 'espn':
      return '📺';
    case 'reddit':
      return '🔗';
    case 'the smoking cuban':
    case 'smoking cuban':
      return '📰';
    case '네이버 스포츠':
    case 'naver':
      return '🇰🇷';
    default:
      return '📄';
  }
}

/**
 * Filter news articles by source
 */
export function filterNewsBySource(articles: NewsArticle[], source: string): NewsArticle[] {
  if (source === 'all') return articles;

  const normalized = source.toLowerCase();
  return articles.filter(article => {
    const articleSource = article.source.toLowerCase();

    switch (normalized) {
      case 'espn':
        return articleSource === 'espn';
      case 'reddit':
        return articleSource === 'reddit';
      case 'tsc':
        return articleSource.includes('smoking cuban');
      case 'naver':
        return articleSource.includes('네이버');
      default:
        return true;
    }
  });
}

/**
 * Format time ago from date string
 */
export function formatTimeAgo(published: string): string {
  try {
    const date = new Date(published);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return '방금 전';
    if (diffInHours < 24) return `${diffInHours}시간 전`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}일 전`;
  } catch {
    return '시간 정보 없음';
  }
}

/**
 * Check if an article is mobile-friendly (simplified for mobile)
 */
export function isLongArticle(article: NewsArticle): boolean {
  return article.description && article.description.length > 100;
}

/**
 * News filter configuration
 */
export const NEWS_FILTERS = [
  { id: 'all', label: '전체', color: 'blue' },
  { id: 'espn', label: 'ESPN', color: 'red' },
  { id: 'reddit', label: 'Reddit', color: 'orange' },
  { id: 'tsc', label: 'TSC', color: 'blue' },
  { id: 'naver', label: '네이버', color: 'green' },
] as const;


