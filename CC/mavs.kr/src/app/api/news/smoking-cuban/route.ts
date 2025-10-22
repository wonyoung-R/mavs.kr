import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NewsArticle } from '@/types/news';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const response = await fetch('https://thesmokingcuban.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)'
      },
      next: { revalidate: 1800 } // 30분 캐시
    });

    if (!response.ok) {
      throw new Error(`The Smoking Cuban error: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const articles: NewsArticle[] = [];

    // 다양한 셀렉터로 기사 찾기
    $('.article-item, .post-item, article, .entry').each((i, elem) => {
      if (articles.length >= limit) return false;

      const $elem = $(elem);

      const title = $elem.find('h2, h3, .entry-title, .post-title').first().text().trim();
      const link = $elem.find('a').first().attr('href');
      const excerpt = $elem.find('.excerpt, .entry-summary, .post-excerpt, p').first().text().trim();
      const image = $elem.find('img').first().attr('src');
      const date = $elem.find('.date, .entry-date, time, .post-date').first().text().trim();

      if (title && link && title.length > 10) {
        articles.push({
          id: link,
          title,
          description: excerpt.substring(0, 200),
          url: link.startsWith('http') ? link : `https://thesmokingcuban.com${link}`,
          image: image?.startsWith('http') ? image : `https://thesmokingcuban.com${image}`,
          published: (() => {
            try {
              if (date) {
                const parsedDate = new Date(date);
                return isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
              }
              return new Date().toISOString();
            } catch {
              return new Date().toISOString();
            }
          })(),
          source: 'The Smoking Cuban',
          author: 'TSC Staff',
          categories: ['Analysis', 'News']
        });
      }
    });

    return NextResponse.json({
      articles: articles.slice(0, limit),
      total: articles.length,
      source: 'The Smoking Cuban',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('The Smoking Cuban Scraping Error:', error);
    return NextResponse.json({
      articles: [],
      error: 'Failed to scrape The Smoking Cuban',
      source: 'The Smoking Cuban'
    }, { status: 500 });
  }
}
