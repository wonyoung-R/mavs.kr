// src/lib/crawler/news-crawler.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { News, NewsSource } from '@/types/news';
import { delay, retry } from '@/lib/utils/common';
import { translateContent } from '@/lib/utils/translation';

interface CrawlerConfig {
  baseUrl: string;
  selectors: {
    article: string;
    title: string;
    content: string;
    author?: string;
    publishedAt?: string;
    imageUrl?: string;
    link?: string;
  };
  headers?: Record<string, string>;
  delayMs?: number;
}

class NewsCrawler {
  private config: CrawlerConfig;

  constructor(config: CrawlerConfig) {
    this.config = {
      delayMs: 1000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0; +https://mavs.kr)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
      ...config,
    };
  }

  /**
   * Crawl articles from the configured source
   */
  async crawlArticles(maxArticles: number = 10): Promise<Partial<News>[]> {
    try {
      const articles: Partial<News>[] = [];

      // Get the main page
      const response = await retry(
        () => axios.get(this.config.baseUrl, {
          headers: this.config.headers,
          timeout: 10000,
        }),
        3,
        2000
      );

      const $ = cheerio.load(response.data);

      // Extract article links
      const articleLinks: string[] = [];
      $(this.config.selectors.article).each((index, element) => {
        if (index >= maxArticles) return false;

        const linkElement = $(element).find(this.config.selectors.link || 'a').first();
        const href = linkElement.attr('href');

        if (href) {
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`;
          articleLinks.push(fullUrl);
        }
      });

      // Crawl each article
      for (const [index, link] of articleLinks.entries()) {
        try {
          const article = await this.crawlArticle(link);
          if (article) {
            articles.push(article);
          }

          // Delay between requests
          if (index < articleLinks.length - 1) {
            await delay(this.config.delayMs || 1000);
          }
        } catch (error) {
          console.error(`Failed to crawl article: ${link}`, error);
        }
      }

      return articles;
    } catch (error) {
      console.error('Failed to crawl articles:', error);
      throw error;
    }
  }

  /**
   * Crawl a single article
   */
  private async crawlArticle(url: string): Promise<Partial<News> | null> {
    try {
      const response = await retry(
        () => axios.get(url, {
          headers: this.config.headers,
          timeout: 15000,
        }),
        3,
        2000
      );

      const $ = cheerio.load(response.data);

      const title = $(this.config.selectors.title).first().text().trim();
      const content = $(this.config.selectors.content).first().text().trim();
      const author = this.config.selectors.author
        ? $(this.config.selectors.author).first().text().trim()
        : undefined;

      let publishedAt = new Date();
      if (this.config.selectors.publishedAt) {
        const publishedAtText = $(this.config.selectors.publishedAt).first().text().trim();
        const parsedDate = new Date(publishedAtText);
        if (!isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate;
        }
      }

      const imageUrl = this.config.selectors.imageUrl
        ? $(this.config.selectors.imageUrl).first().attr('src') ||
          $(this.config.selectors.imageUrl).first().attr('data-src')
        : undefined;

      if (!title || !content) {
        return null;
      }

      return {
        title,
        content,
        author,
        sourceUrl: url,
        imageUrl,
        publishedAt,
        crawledAt: new Date(),
      };
    } catch (error) {
      console.error(`Failed to crawl article: ${url}`, error);
      return null;
    }
  }
}

/**
 * ESPN Crawler Configuration
 */
export class ESPNCrawler extends NewsCrawler {
  constructor() {
    super({
      baseUrl: 'https://www.espn.com/nba/team/_/name/dal/dallas-mavericks',
      selectors: {
        article: '.contentItem__content',
        title: '.contentItem__title',
        content: '.article-body',
        author: '.author',
        publishedAt: '.timestamp',
        imageUrl: 'img',
        link: 'a',
      },
      delayMs: 2000,
    });
  }

  async crawlMavsNews(): Promise<Partial<News>[]> {
    const articles = await this.crawlArticles(5);

    // Translate articles
    const translatedArticles = await Promise.all(
      articles.map(async (article) => {
        try {
          const translatedTitle = await translateContent(article.title || '');
          const translatedContent = await translateContent(article.content || '');

          return {
            ...article,
            titleKr: translatedTitle,
            contentKr: translatedContent,
            source: NewsSource.ESPN,
          };
        } catch (error) {
          console.error('Translation failed for article:', article.title, error);
          return {
            ...article,
            source: NewsSource.ESPN,
          };
        }
      })
    );

    return translatedArticles;
  }
}

/**
 * Mavs Moneyball Crawler Configuration
 */
export class MavsMoneyballCrawler extends NewsCrawler {
  constructor() {
    super({
      baseUrl: 'https://www.mavsmoneyball.com',
      selectors: {
        article: '.c-entry-box--compact',
        title: '.c-entry-box--compact__title',
        content: '.c-entry-content',
        author: '.c-byline__author-name',
        publishedAt: '.c-byline__item time',
        imageUrl: '.c-entry-box--compact__image img',
        link: 'a',
      },
      delayMs: 1500,
    });
  }

  async crawlMavsNews(): Promise<Partial<News>[]> {
    const articles = await this.crawlArticles(5);

    // Translate articles
    const translatedArticles = await Promise.all(
      articles.map(async (article) => {
        try {
          const translatedTitle = await translateContent(article.title || '');
          const translatedContent = await translateContent(article.content || '');

          return {
            ...article,
            titleKr: translatedTitle,
            contentKr: translatedContent,
            source: NewsSource.MAVS_MONEYBALL,
          };
        } catch (error) {
          console.error('Translation failed for article:', article.title, error);
          return {
            ...article,
            source: NewsSource.MAVS_MONEYBALL,
          };
        }
      })
    );

    return translatedArticles;
  }
}

/**
 * The Smoking Cuban Crawler Configuration
 */
export class SmokingCubanCrawler extends NewsCrawler {
  constructor() {
    super({
      baseUrl: 'https://www.smokingcuban.com',
      selectors: {
        article: '.post',
        title: '.post-title',
        content: '.post-content',
        author: '.post-author',
        publishedAt: '.post-date',
        imageUrl: '.post-image img',
        link: 'a',
      },
      delayMs: 1500,
    });
  }

  async crawlMavsNews(): Promise<Partial<News>[]> {
    const articles = await this.crawlArticles(5);

    // Translate articles
    const translatedArticles = await Promise.all(
      articles.map(async (article) => {
        try {
          const translatedTitle = await translateContent(article.title || '');
          const translatedContent = await translateContent(article.content || '');

          return {
            ...article,
            titleKr: translatedTitle,
            contentKr: translatedContent,
            source: NewsSource.SMOKING_CUBAN,
          };
        } catch (error) {
          console.error('Translation failed for article:', article.title, error);
          return {
            ...article,
            source: NewsSource.SMOKING_CUBAN,
          };
        }
      })
    );

    return translatedArticles;
  }
}

// Export crawler instances
export const espnCrawler = new ESPNCrawler();
export const mavsMoneyballCrawler = new MavsMoneyballCrawler();
export const smokingCubanCrawler = new SmokingCubanCrawler();

/**
 * Master crawler that coordinates all news sources
 */
export class MasterNewsCrawler {
  private crawlers = [
    espnCrawler,
    mavsMoneyballCrawler,
    smokingCubanCrawler,
  ];

  async crawlAllSources(): Promise<Partial<News>[]> {
    const allArticles: Partial<News>[] = [];

    for (const crawler of this.crawlers) {
      try {
        const articles = await crawler.crawlMavsNews();
        allArticles.push(...articles);

        // Delay between different sources
        await delay(3000);
      } catch (error) {
        console.error(`Failed to crawl ${crawler.constructor.name}:`, error);
      }
    }

    // Sort by published date (newest first)
    return allArticles.sort((a, b) =>
      new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    );
  }
}

export const masterNewsCrawler = new MasterNewsCrawler();

