import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { ForumCategory } from '@prisma/client';

// Community categories (excluding COLUMN which is for columns only)
const COMMUNITY_CATEGORIES: ForumCategory[] = [
    ForumCategory.NOTICE,
    ForumCategory.NEWS,
    ForumCategory.FREE,
    ForumCategory.MARKET,
    ForumCategory.MEETUP
];

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.toUpperCase();
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('[Community API] Request params:', { category, limit, offset });
    console.log('[Community API] Available categories:', COMMUNITY_CATEGORIES);

    try {
        const whereClause: Record<string, unknown> = {};

        // Filter by specific category if provided
        if (category && category !== 'ALL' && Object.values(ForumCategory).includes(category as ForumCategory)) {
            console.log('[Community API] Filtering by specific category:', category);
            whereClause.category = category as ForumCategory;
        } else {
            // For 'all' or no category, get all community posts (FREE, MARKET, MEETUP)
            console.log('[Community API] Showing all community categories:', COMMUNITY_CATEGORIES);
            whereClause.category = {
                in: COMMUNITY_CATEGORIES
            };
        }

        console.log('[Community API] Final where clause:', JSON.stringify(whereClause));

        const posts = await prisma.post.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            select: {
                id: true,
                title: true,
                content: true,
                category: true,
                price: true,
                meetupLocation: true,
                meetupDate: true,
                meetupPurpose: true,
                isPinned: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: {
                        id: true,
                        username: true,
                        image: true
                    }
                },
                _count: {
                    select: {
                        comments: true,
                        votes: true,
                        likes: true
                    }
                }
            }
        });

        console.log('[Community API] Found', posts.length, 'posts');

        if (posts.length > 0) {
            console.log('[Community API] Post categories:', posts.map(p => p.category));
            console.log('[Community API] First post:', {
                id: posts[0].id,
                title: posts[0].title,
                category: posts[0].category
            });
        } else {
            console.log('[Community API] No posts found!');
            // Check total posts in database
            const totalAllPosts = await prisma.post.count();
            console.log('[Community API] Total posts in DB:', totalAllPosts);
        }

        const total = await prisma.post.count({ where: whereClause });
        console.log('[Community API] Total matching posts:', total);

        return NextResponse.json({
            posts,
            total,
            hasMore: offset + posts.length < total
        });
    } catch (error) {
        console.error('[Community API] Error:', error);
        return NextResponse.json({ posts: [], total: 0, hasMore: false, error: String(error) });
    }
}
