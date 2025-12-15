import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const posts = await prisma.post.findMany({
            where: { category: 'COLUMN' },
            orderBy: { createdAt: 'desc' },
            take: 4, // Featured + 3 recent
            include: {
                author: {
                    select: {
                        username: true,
                        image: true
                    }
                },
                _count: {
                    select: {
                        comments: true,
                        votes: true
                    }
                }
            }
        });

        return NextResponse.json({ posts });
    } catch (error) {
        console.error('Failed to fetch columns:', error);
        return NextResponse.json({ posts: [] });
    }
}
