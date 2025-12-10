'use client';

import { motion } from 'framer-motion';
import { CommunityTrending } from '@/components/forum/CommunityTrending';
import { MessageSquare, PenSquare, Users } from 'lucide-react';
import Link from 'next/link';

export function CommunityView() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link
                    href="/forum"
                    className="flex items-center gap-3 p-4 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-white/10 hover:bg-slate-800/50 transition-all group"
                >
                    <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                        <MessageSquare className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-white">게시글 보기</h3>
                        <p className="text-sm text-slate-400">모든 게시글</p>
                    </div>
                </Link>

                <Link
                    href="/forum/new"
                    className="flex items-center gap-3 p-4 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-white/10 hover:bg-slate-800/50 transition-all group"
                >
                    <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                        <PenSquare className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-white">글쓰기</h3>
                        <p className="text-sm text-slate-400">새 게시글 작성</p>
                    </div>
                </Link>

                <Link
                    href="/forum/members"
                    className="flex items-center gap-3 p-4 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-white/10 hover:bg-slate-800/50 transition-all group"
                >
                    <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                        <Users className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-white">멤버</h3>
                        <p className="text-sm text-slate-400">커뮤니티 멤버</p>
                    </div>
                </Link>
            </div>

            {/* Trending Posts */}
            <CommunityTrending />
        </motion.div>
    );
}
