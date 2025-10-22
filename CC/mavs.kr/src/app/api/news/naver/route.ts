import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NewsArticle } from '@/types/news';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const response = await fetch('https://sports.news.naver.com/basketball/news/index?isphoto=N&type=team&team=dal', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)'
      },
      next: { revalidate: 600 } // 10분 캐시
    });

    if (!response.ok) {
      throw new Error(`Naver Sports error: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const articles: NewsArticle[] = [];

    // 네이버 스포츠 기사 구조에 맞게 파싱
    $('.news_list li, .news_item').each((i, elem) => {
      if (articles.length >= limit) return false;

      const $elem = $(elem);

      const title = $elem.find('.title, .news_title, a').first().text().trim();
      const link = $elem.find('a').first().attr('href');
      const excerpt = $elem.find('.summary, .news_summary, .desc').first().text().trim();
      const image = $elem.find('img').first().attr('src');
      const date = $elem.find('.date, .news_date, .time').first().text().trim();

      if (title && link && title.length > 10) {
        articles.push({
          id: link,
          title,
          description: excerpt.substring(0, 200),
          url: link.startsWith('http') ? link : `https://sports.news.naver.com${link}`,
          image: image?.startsWith('http') ? image : `https://sports.news.naver.com${image}`,
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
          source: '네이버 스포츠',
          author: '네이버 스포츠',
          categories: ['뉴스', '한국어']
        });
      }
    });

    return NextResponse.json({
      articles: articles.slice(0, limit),
      total: articles.length,
      source: '네이버 스포츠',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Naver Sports Scraping Error:', error);
    return NextResponse.json({
      articles: [],
      error: 'Failed to scrape Naver Sports',
      source: '네이버 스포츠'
    }, { status: 500 });
  }
}
