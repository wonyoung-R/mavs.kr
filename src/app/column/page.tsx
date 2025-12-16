import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import WriteButton from '@/components/column/WriteButton';
import ColumnGrid from '@/components/column/ColumnGrid';
import { ArrowLeft } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function ColumnPage() {
    // 컬럼은 누구나 읽을 수 있음 (로그인 체크 제거)
    const posts = await prisma.post.findMany({
        where: { category: 'COLUMN' },
        orderBy: { createdAt: 'desc' },
        include: {
            author: {
                select: {
                    username: true,
                    image: true
                }
            },
            _count: {
                select: {
                    comments: true,
                    votes: true
                }
            }
        }
    });

    return (
        <div className="min-h-screen w-full bg-[#050510] relative flex flex-col">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 pt-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="md" className="hover:bg-white/10 text-white p-2 w-10">
                                <ArrowLeft className="w-6 h-6" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                                MAVS Column
                            </h1>
                            <p className="text-slate-400">
                                전문가들의 심도 있는 분석과 칼럼
                            </p>
                        </div>
                    </div>

                    <WriteButton />
                </div>

                {/* Masonry Grid */}
                <ColumnGrid posts={posts} />
            </div>
        </div>
    );
}
