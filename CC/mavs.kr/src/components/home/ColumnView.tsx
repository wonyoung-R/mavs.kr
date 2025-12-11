'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BookOpen, User, Calendar, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ColumnPost {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    author: {
        username: string;
        image: string | null;
    };
    _count: {
        comments: number;
        votes: number;
    };
}

export function ColumnView() {
    const [posts, setPosts] = useState<ColumnPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/columns')
            .then(res => res.json())
            .then(data => {
                setPosts(data.posts || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load columns:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] text-white">
                <p>로딩 중...</p>
            </div>
        );
    }

    const featuredPost = posts[0];
    const recentPosts = posts.slice(1, 4);

    // Extract first image from content or use placeholder
    const getImageFromContent = (content: string) => {
        const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
        return imgMatch ? imgMatch[1] : 'https://images.unsplash.com/photo-1546519638-68e109498ee2?q=80&w=2090&auto=format&fit=crop';
    };

    // Extract text summary from HTML content
    const getTextSummary = (content: string, maxLength = 150) => {
        const text = content.replace(/<[^>]*>/g, '');
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-5xl mx-auto space-y-8"
        >
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">MAVS Column & Insight</h2>
                <p className="text-slate-400">전문가들의 시선으로 보는 댈러스 매버릭스</p>
            </div>

            {/* Featured Column Hero */}
            {featuredPost && (
                <Link href={`/column/${featuredPost.id}`}>
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="relative rounded-2xl overflow-hidden aspect-[21/9] group cursor-pointer border border-white/10"
                    >
                        <div className="absolute inset-0">
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent z-10" />
                            <img
                                src={getImageFromContent(featuredPost.content)}
                                alt="Featured Column"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-8 z-20">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-medium">Featured</span>
                                <span className="flex items-center text-slate-300 text-sm gap-1">
                                    <Calendar className="w-3 h-3" /> {formatDistanceToNow(new Date(featuredPost.createdAt), { addSuffix: true, locale: ko })}
                                </span>
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
                                {featuredPost.title}
                            </h3>
                            <p className="text-slate-300 text-lg line-clamp-2 mb-6 max-w-3xl">
                                {getTextSummary(featuredPost.content)}
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-white/20">
                                        {featuredPost.author.image ? (
                                            <img src={featuredPost.author.image} alt={featuredPost.author.username} className="w-full h-full rounded-full" />
                                        ) : (
                                            <User className="w-5 h-5 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium text-sm">{featuredPost.author.username}</p>
                                        <p className="text-blue-400 text-xs">Columnist</p>
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-white/20" />
                                <span className="text-slate-400 text-sm flex items-center gap-1">
                                    <BookOpen className="w-4 h-4" /> {featuredPost._count.comments} 댓글
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </Link>
            )}

            {/* Recent Columns Grid */}
            <div className="grid md:grid-cols-3 gap-6">
                {recentPosts.map((post) => (
                    <Link key={post.id} href={`/column/${post.id}`}>
                        <Card className="h-full bg-slate-900/50 border-white/10 hover:border-blue-500/50 transition-colors group">
                            <CardHeader>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                                        Column
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <CardTitle className="text-lg text-white group-hover:text-blue-300 transition-colors line-clamp-2">
                                    {post.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        {post.author.username}
                                    </span>
                                    <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Call to Action for Writers */}
            <Card className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-white/10">
                <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h4 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500" />
                            Mavs Columnist가 되어보세요
                        </h4>
                        <p className="text-slate-300">
                            나만의 시선으로 댈러스의 이야기를 들려주세요. 우수 칼럼니스트에게는 소정의 혜택이 주어집니다.
                        </p>
                    </div>
                    <Link href="/column/new">
                        <button className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors whitespace-nowrap">
                            칼럼 기고하기
                        </button>
                    </Link>
                </CardContent>
            </Card>
        </motion.div>
    );
}
