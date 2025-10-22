// src/app/api/cron/crawl-news/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { masterNewsCrawler } from '@/lib/crawler/news-crawler';
import { prisma } from '@/lib/db/prisma';
import { summarizeWithGemini } from '@/lib/api/gemini';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting scheduled news crawl...');

    // Crawl news from all sources
    const articles = await masterNewsCrawler.crawlAllSources();

    // Save new articles to database
    let savedCount = 0;
    let skippedCount = 0;

    for (const article of articles) {
      try {
        // Check if article already exists
        const existingArticle = await prisma.news.findFirst({
          where: {
            sourceUrl: article.sourceUrl,
          },
        });

        if (!existingArticle && article.title && article.content) {
          // Generate AI summary if Gemini API is available
          let summary = null;
          let summaryKr = null;

          if (process.env.GEMINI_API_KEY) {
            try {
              summaryKr = await summarizeWithGemini(article.title!, article.content!);
              summary = summaryKr; // AI 요약은 이미 한국어로 생성됨
            } catch (summaryError) {
              console.error('Summary generation failed for article:', article.title, summaryError);
            }
          }

          await prisma.news.create({
            data: {
              title: article.title,
              titleKr: article.titleKr || article.title,
              content: article.content,
              contentKr: article.contentKr || article.content,
              summary: summary,
              summaryKr: summaryKr,
              source: article.source!,
              sourceUrl: article.sourceUrl!,
              author: article.author,
              imageUrl: article.imageUrl,
              publishedAt: article.publishedAt!,
              crawledAt: article.crawledAt!,
            },
          });
          savedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error('Failed to save article:', article.title, error);
      }
    }

    console.log(`News crawl completed: ${savedCount} saved, ${skippedCount} skipped`);

    return NextResponse.json({
      success: true,
      data: {
        crawled: articles.length,
        saved: savedCount,
        skipped: skippedCount,
      },
      message: 'Scheduled news crawl completed successfully',
    });
  } catch (error) {
    console.error('Error in scheduled news crawl:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to crawl news',
        message: 'Scheduled news crawl failed',
      },
      { status: 500 }
    );
  }
}

