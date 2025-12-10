import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NewsArticle } from '@/types/news';

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
        $('.c-entry-box--compact, .c-compact-river__entry').each((i, elem) => {
            if (articles.length >= limit) return false;

            const $elem = $(elem);

            const title = $elem.find('h2.c-entry-box--compact__title, h2.c-compact-river__entry-title').text().trim();
            const link = $elem.find('a').first().attr('href');
            const author = $elem.find('.c-byline__author-name').first().text().trim();
            const date = $elem.find('time').first().attr('datetime') || $elem.find('time').first().text().trim();

            // 이미지는 background-image나 noscript 내부 img에서 추출해야 할 수 있음
            let image = $elem.find('noscript img').attr('src') || $elem.find('img').attr('src');

            if (!image) {
                // lazy loading 이미지 처리 시도 (data-src 등)
                image = $elem.find('img.c-entry-box--compact__image').attr('data-src') ||
                    $elem.find('div.c-entry-box--compact__image-wrapper').attr('data-original');
            }

            if (title && link) {
                articles.push({
                    id: link,
                    title,
                    description: '', // 요약은 목록에 없는 경우가 많음
                    url: link, // 보통 절대 경로로 제공됨
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
                });
            }
        });

        return NextResponse.json({
            articles: articles.slice(0, limit),
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
