// src/app/api/news/nba/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NewsArticle } from '@/types/news';
import { translateContentWithGemini } from '@/lib/api/gemini';
import { prisma } from '@/lib/db/prisma';
import { isEnglishText } from '@/lib/translation/simple-translator';
import * as cheerio from 'cheerio';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    // Scrape NBA.com Mavericks news
    const response = await fetch('https://www.nba.com/mavericks/news', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)',
        },
        next: { revalidate: 0 }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch NBA.com news');
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const scrapedArticles: NewsArticle[] = [];

    // NBA.com structure
    $('article, [data-testid="article-card"]').each((i: number, elem: any) => {
        if (scrapedArticles.length >= limit) return false;

        const $elem = $(elem);
        const title = $elem.find('h3, h2').first().text().trim();
        const link = $elem.find('a').first().attr('href');
        const img = $elem.find('img').first().attr('src');
        const desc = $elem.find('p').first().text().trim();

        if (title && link) {
            const fullLink = link.startsWith('http') ? link : `https://www.nba.com${link}`;
            
            scrapedArticles.push({
                id: fullLink,
                title,
                description: desc,
                url: fullLink,
                image: img || '',
                published: new Date().toISOString(), // NBA.com doesn't easily expose date in list view
                source: 'NBA.com',
                author: 'Mavs.com',
                categories: ['News']
            });
        }
    });

    const savedArticles: NewsArticle[] = [];

    // Process: Check DB -> Save + Translate
    for (const article of scrapedArticles) {
        const existing = await prisma.news.findFirst({
            where: { sourceUrl: article.url }
        });

        if (existing) {
            savedArticles.push({
                ...existing,
                id: existing.id,
                published: existing.publishedAt.toISOString(),
                description: existing.content || article.description,
                contentKr: existing.contentKr || undefined, 
                titleKr: existing.titleKr || undefined,
                image: existing.imageUrl || article.image
            } as NewsArticle);
            continue;
        }

        // New Article
        let titleKr = article.title;
        let contentKr = article.description;

        try {
            if (isEnglishText(article.title)) {
                titleKr = await translateContentWithGemini(article.title, 'title');
            }
        } catch (e) { console.error('Title translation failed', e); }

        try {
            if (article.description && isEnglishText(article.description)) {
                contentKr = await translateContentWithGemini(article.description, 'summary');
            }
        } catch (e) { console.error('Desc translation failed', e); }

        try {
            const saved = await prisma.news.create({
                data: {
                    title: article.title,
                    titleKr: titleKr !== article.title ? titleKr : null,
                    content: article.description,
                    contentKr: contentKr !== article.description ? contentKr : null,
                    sourceUrl: article.url,
                    imageUrl: article.image,
                    publishedAt: new Date(article.published),
                    source: 'NBA.com',
                    author: article.author,
                }
            });
            savedArticles.push({
                ...article,
                titleKr: saved.titleKr || undefined,
                contentKr: saved.contentKr || undefined
            });
            console.log(`Saved new NBA article: ${article.title}`);
        } catch (dbError) {
            console.error('Failed to save NBA article:', dbError);
            savedArticles.push(article);
        }
    }

    return NextResponse.json({
        articles: savedArticles,
        total: savedArticles.length
    });

  } catch (error) {
    console.error('NBA News Error:', error);
    return NextResponse.json({ articles: [], error: 'Failed' }, { status: 500 });
  }
}
