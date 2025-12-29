'use client';

import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MessageCircle, Heart } from 'lucide-react';
import Link from 'next/link';

interface ColumnListItemProps {
    post: {
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
    };
}

export default function ColumnListItem({ post }: ColumnListItemProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
        >
            <Link href={`/column/${post.id}`}>
                <div className="bg-slate-900/30 backdrop-blur-sm border border-white/5 hover:border-blue-500/30 hover:bg-slate-900/50 transition-all group rounded-lg p-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left: Title and Meta */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                                    {post.title}
                                </h3>
                                <div className="px-2 py-0.5 rounded text-[10px] border shrink-0 bg-blue-500/10 border-blue-500/20 text-blue-400">
                                    📝 칼럼
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                    <div className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                                        {(post.author.name || post.author.username)?.[0]?.toUpperCase()}
                                    </div>
                                    {post.author.name || post.author.username}
                                </span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                            </div>
                        </div>

                        {/* Right: Stats */}
                        <div className="flex items-center gap-4 text-slate-500 text-xs shrink-0">
                            <span className="flex items-center gap-1 hover:text-red-400 transition-colors">
                                <Heart className="w-3.5 h-3.5" />
                                <span className="font-medium">{post._count.votes}</span>
                            </span>
                            <span className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span className="font-medium">{post._count.comments}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

