import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { NewsSource } from '@prisma/client';
import { saveNewsMany, getNews } from '@/lib/services/news-prisma-service';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const skipFetch = searchParams.get('skipFetch') === 'true';

        let fetchResult = { saved: 0, updated: 0, errors: 0 };

        if (!skipFetch) {
            console.log('[Mavs Moneyball] Fetching from RSS feed...');
            
            // RSS 피드 사용 (더 안정적)
            const response = await fetch('https://www.mavsmoneyball.com/rss/index.xml', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)'
                },
                next: { revalidate: 0 }
            });

            if (!response.ok) {
                throw new Error(`Mavs Moneyball RSS error: ${response.status}`);
            }

            const xml = await response.text();
            const $ = cheerio.load(xml, { xmlMode: true });

            const articlesToSave: Array<{
                title: string;
                content: string;
                source: NewsSource;
                sourceUrl: string;
                author?: string;
                imageUrl?: string;
                publishedAt: Date;
            }> = [];

            // Atom 피드 파싱
            const entries = $('entry').toArray();
            
            for (let i = 0; i < entries.length && articlesToSave.length < limit; i++) {
                const entry = entries[i];
                const $entry = $(entry);

                const title = $entry.find('title').text().trim();
                const link = $entry.find('link[rel="alternate"]').attr('href') || $entry.find('link').attr('href');
                const author = $entry.find('author name').text().trim();
                const published = $entry.find('published').text().trim();
                const summary = $entry.find('summary').text().trim();
                const contentHtml = $entry.find('content').text().trim();
                
                // HTML에서 텍스트 추출
                const $content = cheerio.load(contentHtml);
                const contentText = $content('p').text().trim() || summary;
                
                // 이미지 추출
                const imageMatch = contentHtml.match(/src="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
                const imageUrl = imageMatch ? imageMatch[1].split('?')[0] : undefined;

                if (title && link) {
                    articlesToSave.push({
                        title,
                        content: contentText.substring(0, 5000), // 최대 5000자
                        source: 'MAVS_MONEYBALL' as NewsSource,
                        sourceUrl: link,
                        author: author || 'Mavs Moneyball Staff',
                        imageUrl,
                        publishedAt: (() => {
                            try {
                                if (published) {
                                    const parsedDate = new Date(published);
                                    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
                                }
                                return new Date();
                            } catch {
                                return new Date();
                            }
                        })(),
                    });
                }
            }

            console.log(`[Mavs Moneyball] Found ${articlesToSave.length} articles from RSS`);
            fetchResult = await saveNewsMany(articlesToSave);
            console.log(`[Mavs Moneyball] Saved: ${fetchResult.saved} new, ${fetchResult.updated} updated`);
        }

        // DB에서 데이터 조회
        const news = await getNews({ source: 'MAVS_MONEYBALL' as NewsSource, limit, orderBy: 'publishedAt' });

        const articles = news.map((item) => ({
            id: item.id,
            title: item.title,
            titleKr: item.titleKr || null,
            description: item.content?.substring(0, 300) + '...',
            contentKr: item.contentKr || null,
            url: item.sourceUrl,
            image: item.imageUrl,
            published: item.publishedAt.toISOString(),
            source: item.source,
            author: item.author,
            isTranslated: !!item.titleKr,
        }));

        return NextResponse.json({
            success: true,
            articles,
            total: articles.length,
            fetched: fetchResult,
            source: 'Mavs Moneyball',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Mavs Moneyball] Error:', error);
        return NextResponse.json({
            success: false,
            articles: [],
            error: 'Failed to fetch Mavs Moneyball',
            source: 'Mavs Moneyball'
        }, { status: 500 });
    }
}
