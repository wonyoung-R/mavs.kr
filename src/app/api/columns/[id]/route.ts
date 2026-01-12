import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const post = await prisma.post.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                content: true,
                category: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        name: true,
                    }
                }
            }
        });

        if (!post) {
            return NextResponse.json(
                { error: '글을 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        return NextResponse.json(post);
    } catch (error) {
        console.error('Error fetching column:', error);
        return NextResponse.json(
            { error: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

