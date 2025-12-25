'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Clock, MessageCircle, Heart } from 'lucide-react';
import Link from 'next/link';

interface ColumnCardProps {
    post: {
        id: string;
        title: string;
        content: string;
        createdAt: Date;
        category?: 'COLUMN' | 'ANALYSIS';
        author: {
            username: string;
            image: string | null;
        };
        _count: {
            comments: number;
            votes: number;
        };
    };
}

function extractImage(html: string): string | null {
    const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : null;
}

export default function ColumnCard({ post }: ColumnCardProps) {
    const thumbnail = extractImage(post.content);

    return (
        <Link href={`/column/${post.id}`} className="block group">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 hover:border-blue-500/30 transition-all overflow-hidden h-full">
                <CardContent className="p-0">
                    {thumbnail && (
                        <div className="w-full h-48 overflow-hidden">
                            <img
                                src={thumbnail}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                    )}
                    <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                            {post.category && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    post.category === 'ANALYSIS'
                                        ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                                        : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                    {post.category === 'ANALYSIS' ? '분석' : '칼럼'}
                                </span>
                            )}
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                                {post.author.username[0]?.toUpperCase()}
                            </div>
                            <span className="text-blue-400 text-sm font-medium">{post.author.username}</span>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-4 group-hover:text-blue-300 transition-colors line-clamp-2">
                            {post.title}
                        </h3>

                        <div className="flex items-center justify-between text-slate-500 text-xs">
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <Heart className="w-3 h-3" />
                                    {post._count.votes}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageCircle className="w-3 h-3" />
                                    {post._count.comments}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
