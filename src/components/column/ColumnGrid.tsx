'use client';

import { motion } from 'framer-motion';
import ColumnCard from './ColumnCard';
import ColumnListItem from './ColumnListItem';

interface ColumnGridProps {
    posts: Array<{
        id: string;
        title: string;
        content: string;
        createdAt: Date;
        author: {
            username: string;
            name: string | null;
            image: string | null;
        };
        _count: {
            comments: number;
            votes: number;
        };
    }>;
}

export default function ColumnGrid({ posts }: ColumnGridProps) {
    if (posts.length === 0) {
        return (
            <div className="text-center py-20 text-slate-500">
                등록된 칼럼이 없습니다.
            </div>
        );
    }

    const firstPost = posts[0];
    const remainingPosts = posts.slice(1);

    return (
        <div className="max-w-5xl mx-auto">
            {/* Featured First Post - Card View */}
            {firstPost && (
                <div className="mb-8">
                    <ColumnCard post={firstPost} />
                </div>
            )}

            {/* Remaining Posts - List View */}
            {remainingPosts.length > 0 && (
                <div className="space-y-2">
                    {remainingPosts.map((post) => (
                        <ColumnListItem key={post.id} post={post} />
                    ))}
                </div>
            )}
        </div>
    );
}
