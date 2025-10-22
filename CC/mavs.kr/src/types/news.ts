export interface News {
  id: string;
  title: string;
  titleKr?: string;
  content: string;
  contentKr?: string;
  summary?: string;
  source: NewsSource;
  sourceUrl: string;
  author?: string;
  imageUrl?: string;
  publishedAt: Date;
  crawledAt: Date;
  viewCount: number;
  tags: Tag[];
}

export interface Tag {
  id: string;
  name: string;
}

export enum NewsSource {
  ESPN = 'ESPN',
  MAVS_MONEYBALL = 'MAVS_MONEYBALL',
  SMOKING_CUBAN = 'SMOKING_CUBAN',
  REDDIT = 'REDDIT',
  NEWS_API = 'NEWS_API',
  THE_ATHLETIC = 'THE_ATHLETIC',
}

export interface NewsArticle {
  id: string;
  title: string;
  titleKr?: string; // 번역된 한국어 제목
  description?: string;
  url: string;
  image?: string;
  published: string;
  source: string;
  author?: string;
  categories?: string[];
  score?: number;
  comments?: number;
  redditUrl?: string;
  flair?: string;
}

export interface NewsFilter {
  source?: NewsSource;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  search?: string;
}
