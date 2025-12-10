'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';

export default function NewPostPage() {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('free');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement API logic
        alert('작성 기능은 준비 중입니다 (백엔드 연동 필요)');
    };

    return (
        <div className="min-h-screen relative bg-[#050510]">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] animate-pulse"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto pt-24 px-4 pb-12">
                {/* Header */}
                <div className="flex items-center gap-4 text-white mb-6">
                    <Link href="/forum">
                        <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">새 게시글 작성</h1>
                </div>

                {/* Editor Card */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Category & Title */}
                            <div className="grid md:grid-cols-4 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-400 mb-2">카테고리</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="free">자유게시판</option>
                                        <option value="news">뉴스제보</option>
                                        <option value="market">중고장터</option>
                                        <option value="meetup">오프모임</option>
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-400 mb-2">제목</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="제목을 입력하세요"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">내용</label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="달라스 매버릭스 팬들과 나누고 싶은 이야기를 적어주세요."
                                    className="w-full h-96 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-4 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500 resize-none leading-relaxed"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <Link href="/forum">
                                    <Button type="button" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                                        취소
                                    </Button>
                                </Link>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                                    <Send className="w-4 h-4 mr-2" />
                                    등록하기
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
