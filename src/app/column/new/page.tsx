'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Send } from 'lucide-react';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { useAuth } from '@/contexts/AuthContext';
import { createColumn } from '@/app/actions/column';

function NewColumnForm() {
    const router = useRouter();
    const { user, isColumnist, session, loading } = useAuth();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (!isColumnist) {
                alert('칼럼 작성 권한이 없습니다.');
                router.push('/?tab=column');
            }
        }
    }, [user, isColumnist, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);

            // Assuming createColumn handles the 'COLUMN' category internally or we need to check the action.
            // Looking at the original code, createColumn was used. 
            // Previous code: await createColumn(formData, session?.access_token);
            await createColumn(formData, session?.access_token);
            router.push('/?tab=column');
        } catch (error) {
            console.error(error);
            alert('작성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !user || !isColumnist) {
        // Show loading or nothing while redirecting
        return <div className="min-h-screen bg-[#050510] pt-24 text-center text-white">Loading...</div>;
    }

    return (
        <div className="min-h-screen relative bg-[#050510]">
            {/* Background */}
            <div className="absolute inset-0 z-0 fixed">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] animate-pulse"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto pt-24 px-4 pb-12">
                {/* Header */}
                <div className="flex items-center gap-4 text-white mb-6">
                    <Button
                        variant="ghost"
                        size="md"
                        className="hover:bg-white/10 text-white p-2 w-10"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">
                        칼럼 작성
                    </h1>
                </div>

                {/* Editor Card */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div>
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
                                <TiptapEditor content={content} onChange={setContent} placeholder="칼럼 내용을 입력하세요..." />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    onClick={() => router.back()}
                                >
                                    취소
                                </Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8" disabled={isSubmitting}>
                                    <Send className="w-4 h-4 mr-2" />
                                    칼럼 등록
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function NewColumnPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050510] pt-24 text-center text-white">Loading...</div>}>
            <NewColumnForm />
        </Suspense>
    );
}
