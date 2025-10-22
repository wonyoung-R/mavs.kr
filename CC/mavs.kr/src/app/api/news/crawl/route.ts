// src/app/api/news/crawl/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { masterNewsCrawler } from '@/lib/crawler/news-crawler';
import { prisma } from '@/lib/db/prisma';
import { News } from '@/types/news';

export async function POST(request: NextRequest) {
  try {
    // Check if request is authorized (you might want to add API key validation)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Crawl news from all sources
    const articles = await masterNewsCrawler.crawlAllSources();

    // Save to database
    const savedArticles = [];
    for (const article of articles) {
      try {
        // Check if article already exists
        const existingArticle = await prisma.news.findFirst({
          where: {
            sourceUrl: article.sourceUrl,
          },
        });

        if (!existingArticle) {
          const savedArticle = await prisma.news.create({
            data: {
              title: article.title!,
              titleKr: article.titleKr || article.title!,
              content: article.content!,
              contentKr: article.contentKr || article.content!,
              summary: article.summary,
              source: article.source!,
              sourceUrl: article.sourceUrl!,
              author: article.author,
              imageUrl: article.imageUrl,
              publishedAt: article.publishedAt!,
              crawledAt: article.crawledAt!,
            },
          });
          savedArticles.push(savedArticle);
        }
      } catch (error) {
        console.error('Failed to save article:', article.title, error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        crawled: articles.length,
        saved: savedArticles.length,
        articles: savedArticles,
      },
      message: 'News crawling completed successfully',
    });
  } catch (error) {
    console.error('Error crawling news:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to crawl news',
        message: 'Unable to crawl news from sources',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const source = searchParams.get('source');

    // Get news from database
    const whereClause = source ? { source: source as any } : {};

    const news = await prisma.news.findMany({
      where: whereClause,
      orderBy: {
        publishedAt: 'desc',
      },
      take: limit,
      include: {
        tags: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: news,
      message: 'News retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching news:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch news',
        message: 'Unable to retrieve news from database',
      },
      { status: 500 }
    );
  }
}

