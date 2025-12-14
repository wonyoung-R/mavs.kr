import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NewsArticle } from '@/types/news';
import { translateContentWithGemini } from '@/lib/api/gemini';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        const response = await fetch('https://www.mavsmoneyball.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)'
            },
            next: { revalidate: 1800 } // 30분 캐시
        });

        if (!response.ok) {
            throw new Error(`Mavs Moneyball error: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const articles: NewsArticle[] = [];

        // SB Nation 계열 사이트 구조 크롤링
        const entries = $('.c-entry-box--compact, .c-compact-river__entry').toArray();
        
        for (let i = 0; i < entries.length && articles.length < limit; i++) {
            const elem = entries[i];
            const $elem = $(elem);

            const title = $elem.find('h2.c-entry-box--compact__title, h2.c-compact-river__entry-title').text().trim();
            const link = $elem.find('a').first().attr('href');
            const author = $elem.find('.c-byline__author-name').first().text().trim();
            const date = $elem.find('time').first().attr('datetime') || $elem.find('time').first().text().trim();

            let image = $elem.find('noscript img').attr('src') || $elem.find('img').attr('src');

            if (!image) {
                image = $elem.find('img.c-entry-box--compact__image').attr('data-src') ||
                    $elem.find('div.c-entry-box--compact__image-wrapper').attr('data-original');
            }

            if (title && link) {
                const article: NewsArticle = {
                    id: link,
                    title,
                    description: '', 
                    url: link,
                    image: image || undefined,
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
                    source: 'Mavs Moneyball',
                    author: author || 'Staff',
                    categories: ['News']
                };

                // 상세 페이지 크롤링 및 번역 (상위 3개만 수행하여 타임아웃 방지)
                if (i < 3) {
                    try {
                        const detailResponse = await fetch(link, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)' }
                        });
                        
                        if (detailResponse.ok) {
                            const detailHtml = await detailResponse.text();
                            const $detail = cheerio.load(detailHtml);
                            
                            // 본문 추출
                            const content = $detail('.c-entry-content').text().trim();
                            
                            if (content) {
                                article.description = content.substring(0, 300) + '...';
                                // 전체 본문을 저장할 필드가 필요하다면 news-service나 type 정의에 따라야 함
                                // 현재 NewsArticle에는 content 필드가 없거나 description을 content로 사용 중
                                // user query: "들어간 데이터를 contenT + contentkr 을 이용해서 보여주면됨"
                                // 여기서는 description에 요약/전체 내용을 넣고, contentKr은 번역 결과를 넣음
                                
                                // 번역 수행
                                try {
                                    const translatedContent = await translateContentWithGemini(content);
                                    article.contentKr = translatedContent;
                                } catch (transErr) {
                                    console.error(`Translation failed for ${link}:`, transErr);
                                }
                            }
                        }
                    } catch (detailErr) {
                        console.error(`Failed to fetch detail for ${link}:`, detailErr);
                    }
                }

                articles.push(article);
            }
        }

        return NextResponse.json({
            articles: articles,
            total: articles.length,
            source: 'Mavs Moneyball',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Mavs Moneyball Scraping Error:', error);
        return NextResponse.json({
            articles: [],
            error: 'Failed to scrape Mavs Moneyball',
            source: 'Mavs Moneyball'
        }, { status: 500 });
    }
}
