import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const members = users.map(user => ({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      role: user.role === 'ADMIN' ? '관리자' : user.role === 'COLUMNIST' ? '칼럼니스트' : '멤버',
      posts: user._count.posts,
      createdAt: user.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      members,
      total: members.length,
    });
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch members', members: [] },
      { status: 500 }
    );
  }
}

