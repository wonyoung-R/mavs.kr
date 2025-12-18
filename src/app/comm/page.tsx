import { prisma } from '@/lib/db/prisma';
import CommunityClient, { Post } from './CommunityClient';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

function mapEnumToCategory(category: string): string {
    switch (category) {
        case 'FREE': return 'free';
        case 'MARKET': return 'market';
        case 'MEETUP': return 'meetup';
        case 'NEWS': return 'news';
        default: return 'free';
    }
}

export default async function CommunityPage() {
    // 최소 2초 로딩 시간 보장 (UX)
    const [dbPosts] = await Promise.all([
        prisma.post.findMany({
            where: {
                category: {
                    in: ['FREE', 'MARKET', 'MEETUP', 'NEWS']
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: {
                    select: {
                        name: true,
                        username: true
                    }
                },
                _count: {
                    select: {
                        comments: true,
                        likes: true
                    }
                }
            },
            take: 50
        }),
        new Promise(resolve => setTimeout(resolve, 2000))
    ]);

    const posts: Post[] = dbPosts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content,
        author: post.author.name || post.author.username || 'Anonymous',
        createdAt: formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko }),
        likes: post._count.likes,
        comments: post._count.comments,
        category: mapEnumToCategory(post.category),
        price: post.price || undefined,
        location: post.meetupLocation || undefined,
    }));

    return <CommunityClient initialPosts={posts} />;
}
