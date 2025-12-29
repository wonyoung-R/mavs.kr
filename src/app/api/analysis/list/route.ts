import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      where: { category: 'ANALYSIS' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        createdAt: true,
        viewCount: true,
        author: {
          select: {
            username: true,
            name: true,
            image: true,
            role: true,
            email: true,
          }
        },
        _count: {
          select: {
            comments: true,
            votes: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error('Failed to fetch analysis posts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

