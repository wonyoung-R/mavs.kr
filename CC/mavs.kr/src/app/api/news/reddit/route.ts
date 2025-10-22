import { NextRequest, NextResponse } from 'next/server';
import { NewsArticle } from '@/types/news';

const SUBREDDIT = 'Mavericks';
const REDDIT_URL = `https://www.reddit.com/r/${SUBREDDIT}/hot.json`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const response = await fetch(`${REDDIT_URL}?limit=${limit}`, {
      headers: {
        'User-Agent': 'MAVS.KR News Bot 1.0'
      },
      next: { revalidate: 1800 } // 30분 캐시
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();

    const articles: NewsArticle[] = data.data?.children
      ?.filter((post: any) =>
        !post.data.stickied &&
        !post.data.is_video &&
        !post.data.over_18 &&
        post.data.title
      )
      .map((post: any) => ({
        id: post.data.id,
        title: post.data.title,
        description: post.data.selftext?.substring(0, 200) || '',
        url: post.data.url,
        redditUrl: `https://reddit.com${post.data.permalink}`,
        image: post.data.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&'),
        published: post.data.created_utc ? new Date(post.data.created_utc * 1000).toISOString() : new Date().toISOString(),
        source: 'Reddit',
        author: post.data.author,
        score: post.data.score,
        comments: post.data.num_comments,
        flair: post.data.link_flair_text,
        categories: post.data.link_flair_text ? [post.data.link_flair_text] : []
      })) || [];

    return NextResponse.json({
      articles,
      total: articles.length,
      source: 'Reddit',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Reddit API Error:', error);
    return NextResponse.json({
      articles: [],
      error: 'Failed to fetch Reddit posts',
      source: 'Reddit'
    }, { status: 500 });
  }
}
