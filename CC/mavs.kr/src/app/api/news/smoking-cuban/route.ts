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
            console.log('[The Smoking Cuban] Fetching from RSS feed...');
            
            // RSS 피드 사용 (더 안정적)
            const response = await fetch('https://thesmokingcuban.com/feed/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)'
                },
                next: { revalidate: 0 }
            });

            if (!response.ok) {
                throw new Error(`The Smoking Cuban RSS error: ${response.status}`);
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

            // RSS 피드 파싱 (WordPress 형식)
            const items = $('item').toArray();
            
            for (let i = 0; i < items.length && articlesToSave.length < limit; i++) {
                const item = items[i];
                const $item = $(item);

                const title = $item.find('title').text().trim();
                const link = $item.find('link').text().trim();
                const author = $item.find('dc\\:creator, creator').text().trim();
                const pubDate = $item.find('pubDate').text().trim();
                const description = $item.find('description').text().trim();
                const contentEncoded = $item.find('content\\:encoded, encoded').text().trim();
                
                // HTML에서 텍스트 추출
                const $content = cheerio.load(contentEncoded || description);
                const contentText = $content('p').map((_, el) => $(el).text()).get().join(' ').trim() || description;
                
                // 이미지 추출 - media:thumbnail 우선
                // cheerio에서 네임스페이스 요소는 직접 찾아야 함
                const itemHtml = $.html(item);
                const mediaMatch = itemHtml.match(/media:thumbnail[^>]*url="([^"]+)"/i);
                let imageUrl = mediaMatch ? mediaMatch[1] : undefined;
                
                // 없으면 content에서 추출
                if (!imageUrl) {
                    const imageMatch = (contentEncoded || description).match(/src="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
                    imageUrl = imageMatch ? imageMatch[1].split('?')[0] : undefined;
                }

                if (title && link) {
                    articlesToSave.push({
                        title,
                        content: contentText.substring(0, 5000), // 최대 5000자
                        source: 'SMOKING_CUBAN' as NewsSource,
                        sourceUrl: link,
                        author: author || 'The Smoking Cuban Staff',
                        imageUrl,
                        publishedAt: (() => {
                            try {
                                if (pubDate) {
                                    const parsedDate = new Date(pubDate);
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

            console.log(`[The Smoking Cuban] Found ${articlesToSave.length} articles from RSS`);
            fetchResult = await saveNewsMany(articlesToSave);
            console.log(`[The Smoking Cuban] Saved: ${fetchResult.saved} new, ${fetchResult.updated} updated`);
        }

        // DB에서 데이터 조회
        const news = await getNews({ source: 'SMOKING_CUBAN' as NewsSource, limit, orderBy: 'publishedAt' });

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
            source: 'The Smoking Cuban',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[The Smoking Cuban] Error:', error);
        return NextResponse.json({
            success: false,
            articles: [],
            error: 'Failed to fetch The Smoking Cuban',
            source: 'The Smoking Cuban'
        }, { status: 500 });
    }
}
