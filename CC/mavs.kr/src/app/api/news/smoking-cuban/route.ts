import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NewsArticle } from '@/types/news';
import { translateContentWithGemini } from '@/lib/api/gemini';

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
    const entries = $('.article-item, .post-item, article, .entry').toArray();

    for (let i = 0; i < entries.length && articles.length < limit; i++) {
        const elem = entries[i];
        const $elem = $(elem);

        const title = $elem.find('h2, h3, .entry-title, .post-title').first().text().trim();
        const link = $elem.find('a').first().attr('href');
        const excerpt = $elem.find('.excerpt, .entry-summary, .post-excerpt, p').first().text().trim();
        const image = $elem.find('img').first().attr('src');
        const date = $elem.find('.date, .entry-date, time, .post-date').first().text().trim();

        if (title && link && title.length > 10) {
            const fullUrl = link.startsWith('http') ? link : `https://thesmokingcuban.com${link}`;
            
            const article: NewsArticle = {
                id: link,
                title,
                description: excerpt.substring(0, 200),
                url: fullUrl,
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
            };

            // 상세 페이지 크롤링 및 번역 (상위 3개만 수행)
            if (i < 3) {
                try {
                    const detailResponse = await fetch(fullUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)' }
                    });
                    
                    if (detailResponse.ok) {
                        const detailHtml = await detailResponse.text();
                        const $detail = cheerio.load(detailHtml);
                        
                        // 본문 추출 (FanSided content selector)
                        // 보통 .post-content 또는 .entry-content 사용
                        // 광고나 불필요한 요소 제거 필요할 수 있음
                        $detail('.post-content script, .post-content style, .post-content .ad-container').remove();
                        const content = $detail('.post-content, .entry-content').text().trim();
                        
                        if (content) {
                            // 전체 본문은 너무 길 수 있으니 description에는 요약/앞부분
                            article.description = content.substring(0, 300) + '...';
                            
                            // 번역 수행
                            try {
                                const translatedContent = await translateContentWithGemini(content);
                                article.contentKr = translatedContent;
                            } catch (transErr) {
                                console.error(`Translation failed for ${fullUrl}:`, transErr);
                            }
                        }
                    }
                } catch (detailErr) {
                    console.error(`Failed to fetch detail for ${fullUrl}:`, detailErr);
                }
            }

            articles.push(article);
        }
    }

    return NextResponse.json({
      articles: articles,
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
