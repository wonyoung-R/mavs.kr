'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Send, Save } from 'lucide-react';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { useAuth } from '@/contexts/AuthContext';
import { createColumn } from '@/app/actions/column';
import { createPost } from '@/app/actions/post';

function NewPostForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const type = searchParams.get('type');
    const isColumnMode = type === 'column';

    const { user, isColumnist, session } = useAuth();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState(isColumnMode ? 'COLUMN' : 'free');
    const [titleCharCount, setTitleCharCount] = useState(0);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Extra fields
    const [price, setPrice] = useState('');
    const [location, setLocation] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 자동 저장 키 생성
    const autosaveKey = isColumnMode
        ? `column-draft-${user?.id || 'guest'}`
        : `post-draft-${category}-${user?.id || 'guest'}`;
    const titleAutosaveKey = `${autosaveKey}-title`;

    useEffect(() => {
        if (isColumnMode) {
            if (!user) {
                // router.push('/login'); // AuthContext usually handles redirect or we show unauthorized
            } else if (!isColumnist) {
                alert('칼럼 작성 권한이 없습니다.');
                router.push('/?tab=community');
            }
            setCategory('COLUMN');
        }
    }, [isColumnMode, user, isColumnist, router]);

    // 자동 저장된 제목 복원
    useEffect(() => {
        const savedTitle = localStorage.getItem(titleAutosaveKey);
        if (savedTitle && !title) {
            setTitle(savedTitle);
            setTitleCharCount(savedTitle.length);
        }
    }, [titleAutosaveKey, title]);

    // 제목 자동 저장
    useEffect(() => {
        if (titleSaveTimeoutRef.current) {
            clearTimeout(titleSaveTimeoutRef.current);
        }
        setTitleCharCount(title.length);

        if (title.trim()) {
            titleSaveTimeoutRef.current = setTimeout(() => {
                localStorage.setItem(titleAutosaveKey, title);
                setLastSaved(new Date());
            }, 1000);
        }

        return () => {
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
        };
    }, [title, titleAutosaveKey]);

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

            if (isColumnMode) {
                await createColumn(formData, session?.access_token);
                // 성공 시 자동 저장 삭제
                localStorage.removeItem(autosaveKey);
                localStorage.removeItem(titleAutosaveKey);
                router.push('/?tab=column');
            } else {
                formData.append('category', category);
                if (category === 'market' && price) formData.append('price', price);
                if (category === 'meetup' && location) formData.append('location', location);

                await createPost(formData, session?.access_token);
                // 성공 시 자동 저장 삭제
                localStorage.removeItem(autosaveKey);
                localStorage.removeItem(titleAutosaveKey);
                router.push('/comm');
            }
        } catch (error) {
            console.error(error);
            alert('작성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const clearAutosave = () => {
        localStorage.removeItem(autosaveKey);
        localStorage.removeItem(titleAutosaveKey);
        setLastSaved(null);
    };

    if (isColumnMode && !isColumnist) return null;

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
                        {isColumnMode ? '칼럼 작성' : '새 게시글 작성'}
                    </h1>
                </div>

                {/* Editor Card */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Category & Title */}
                            <div className="grid md:grid-cols-4 gap-4">
                                {!isColumnMode && (
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
                                )}

                                {category === 'market' && (
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-medium text-slate-400 mb-2">가격 (원)</label>
                                        <input
                                            type="number"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            placeholder="가격 입력"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                        />
                                    </div>
                                )}

                                {category === 'meetup' && (
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-medium text-slate-400 mb-2">장소</label>
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="모임 장소"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                        />
                                    </div>
                                )}

                                <div className={isColumnMode ? "md:col-span-4" : "md:col-span-3"}>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-slate-400">제목</label>
                                        <div className="flex items-center space-x-2">
                                            {lastSaved && (
                                                <span className="text-xs text-gray-500 flex items-center space-x-1">
                                                    <Save className="w-3 h-3" />
                                                    <span>임시저장됨</span>
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-500">{titleCharCount}자</span>
                                        </div>
                                    </div>
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
                                <TiptapEditor
                                    content={content}
                                    onChange={setContent}
                                    placeholder={isColumnMode ? "칼럼 내용을 입력하세요..." : "댈러스 매버릭스 팬들과 나누고 싶은 이야기를 적어주세요."}
                                    autosaveKey={autosaveKey}
                                    showCharCount={true}
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center pt-4 border-t border-white/10">
                                {lastSaved && (
                                    <button
                                        type="button"
                                        onClick={clearAutosave}
                                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        임시저장 삭제
                                    </button>
                                )}
                                <div className="flex gap-3 ml-auto">
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
                                        {isColumnMode ? '칼럼 등록' : '등록하기'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function NewPostPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050510] pt-24 text-center text-white">Loading...</div>}>
            <NewPostForm />
        </Suspense>
    );
}
