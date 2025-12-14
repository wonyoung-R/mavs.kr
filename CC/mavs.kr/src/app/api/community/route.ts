import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { ForumCategory } from '@prisma/client';

// Community categories (excluding COLUMN which is for columns only)
const COMMUNITY_CATEGORIES: ForumCategory[] = [
    ForumCategory.FREE,
    ForumCategory.MARKET,
    ForumCategory.MEETUP
];

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.toUpperCase();
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
        let whereClause: any = {};

        // Filter by specific category if provided
        if (category && category !== 'ALL' && Object.values(ForumCategory).includes(category as ForumCategory)) {
            whereClause.category = category as ForumCategory;
        } else {
            // For 'all' or no category, get all community posts (FREE, MARKET, MEETUP)
            whereClause.category = {
                in: COMMUNITY_CATEGORIES
            };
        }

        console.log('[Community API] Querying with:', JSON.stringify(whereClause));

        const posts = await prisma.post.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
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

        console.log('[Community API] Found', posts.length, 'posts. Categories:', posts.map(p => p.category));

        const total = await prisma.post.count({ where: whereClause });

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
