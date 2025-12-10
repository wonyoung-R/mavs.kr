'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BookOpen, User, Calendar, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';

export function ColumnView() {
    const featuredColumn = {
        id: 1,
        title: "돈치치와 어빙, 공존의 미학: 시즌 중반 중간 점검",
        excerpt: "시즌 초반의 우려를 씻어내고 있는 댈러스의 백코트 듀오. 그들의 시너지가 폭발하는 지점과 아직 개선이 필요한 부분들을 심층 분석합니다.",
        author: "MavsInDepth",
        role: "Senior Columnist",
        date: "2024.05.20",
        readTime: "5 min read",
        image: "https://images.unsplash.com/photo-1546519638-68e109498ee2?q=80&w=2090&auto=format&fit=crop" // Placeholder
    };

    const columns = [
        {
            id: 2,
            title: "라이블리의 성장세가 무섭다",
            author: "RookieWatch",
            date: "2024.05.18",
            category: "Analysis"
        },
        {
            id: 3,
            title: "클러치 타임의 지배자들: 통계로 보는 댈러스",
            author: "StatGuru",
            date: "2024.05.15",
            category: "Deep Dive"
        },
        {
            id: 4,
            title: "제이키드의 로테이션 실험, 득인가 실인가?",
            author: "CoachK",
            date: "2024.05.12",
            category: "Opinion"
        }
    ];

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
            <Link href={`/news/column/${featuredColumn.id}`}>
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="relative rounded-2xl overflow-hidden aspect-[21/9] group cursor-pointer border border-white/10"
                >
                    <div className="absolute inset-0">
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent z-10" />
                        <img
                            src={featuredColumn.image}
                            alt="Featured Column"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-8 z-20">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-medium">Featured</span>
                            <span className="flex items-center text-slate-300 text-sm gap-1">
                                <Calendar className="w-3 h-3" /> {featuredColumn.date}
                            </span>
                        </div>
                        <h3 className="text-3xl md:text-4xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
                            {featuredColumn.title}
                        </h3>
                        <p className="text-slate-300 text-lg line-clamp-2 mb-6 max-w-3xl">
                            {featuredColumn.excerpt}
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-white/20">
                                    <User className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">{featuredColumn.author}</p>
                                    <p className="text-blue-400 text-xs">{featuredColumn.role}</p>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-white/20" />
                            <span className="text-slate-400 text-sm flex items-center gap-1">
                                <BookOpen className="w-4 h-4" /> {featuredColumn.readTime}
                            </span>
                        </div>
                    </div>
                </motion.div>
            </Link>

            {/* Recent Columns Grid */}
            <div className="grid md:grid-cols-3 gap-6">
                {columns.map((col) => (
                    <Link key={col.id} href={`/news/column/${col.id}`}>
                        <Card className="h-full bg-slate-900/50 border-white/10 hover:border-blue-500/50 transition-colors group">
                            <CardHeader>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                                        {col.category}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <CardTitle className="text-lg text-white group-hover:text-blue-300 transition-colors line-clamp-2">
                                    {col.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        {col.author}
                                    </span>
                                    <span>{col.date}</span>
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
                    <Link href="/forum/new?type=column">
                        <button className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors">
                            칼럼 기고하기
                        </button>
                    </Link>
                </CardContent>
            </Card>
        </motion.div>
    );
}
