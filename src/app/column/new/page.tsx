'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Send, Upload, TrendingUp, FileCode, Eye, X, PenLine, Loader2 } from 'lucide-react';
import TiptapEditor from '@/components/editor/TiptapEditor';
import DynamicJSXRenderer from '@/components/analysis/DynamicJSXRenderer';
import { useAuth } from '@/contexts/AuthContext';
import { createColumn } from '@/app/actions/column';
import { createAnalysis } from '@/app/actions/analysis';

function NewColumnForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editPostId = searchParams.get('edit');
    const { user, isColumnist, session, loading } = useAuth();

    // Tab state
    const [activeTab, setActiveTab] = useState<'column' | 'analysis'>('column');

    // Column state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // Edit mode state
    const [isLoadingPost, setIsLoadingPost] = useState(!!editPostId);
    const [isEditMode, setIsEditMode] = useState(!!editPostId);
    const [postLoaded, setPostLoaded] = useState(false);

    // Analysis state
    const [jsxCode, setJsxCode] = useState('');
    const [fileName, setFileName] = useState('');
    const [isPreview, setIsPreview] = useState(false);

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

    // Edit 모드일 때 기존 글 로딩
    useEffect(() => {
        if (editPostId && !postLoaded) {
            setIsLoadingPost(true);
            setIsEditMode(true);

            fetch(`/api/columns/${editPostId}`)
                .then(res => {
                    if (!res.ok) throw new Error('글을 불러올 수 없습니다.');
                    return res.json();
                })
                .then(data => {
                    console.log('Loaded post data:', data);
                    setTitle(data.title || '');
                    setContent(data.content || '');
                    setPostLoaded(true);
                })
                .catch(err => {
                    console.error('Failed to load post:', err);
                    alert('글을 불러오는데 실패했습니다.');
                    router.push('/?tab=column');
                })
                .finally(() => {
                    setIsLoadingPost(false);
                });
        }
    }, [editPostId, postLoaded, router]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.jsx') && !file.name.endsWith('.js')) {
            alert('.jsx 또는 .js 파일만 업로드 가능합니다.');
            return;
        }

        try {
            const text = await file.text();
            setJsxCode(text);
            setFileName(file.name);

            if (!title) {
                const nameWithoutExt = file.name.replace(/\.(jsx?|js)$/, '');
                setTitle(nameWithoutExt);
            }
        } catch (error) {
            console.error('Error reading file:', error);
            alert('파일을 읽는 중 오류가 발생했습니다.');
        }
    };

    const clearFile = () => {
        setJsxCode('');
        setFileName('');
        setIsPreview(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (activeTab === 'column') {
            if (!title.trim() || !content.trim()) {
                alert('제목과 내용을 입력해주세요.');
                return;
            }

            setIsSubmitting(true);

            try {
                const formData = new FormData();
                formData.append('title', title);
                formData.append('content', content);
                if (editPostId) {
                    formData.append('id', editPostId);
                }

                await createColumn(formData, session?.access_token);
                router.push(editPostId ? `/column/${editPostId}` : '/?tab=column');
            } catch (error) {
                console.error(error);
                alert('작성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
            } finally {
                setIsSubmitting(false);
            }
        } else {
            if (!jsxCode) {
                alert('JSX 파일을 업로드해주세요.');
                return;
            }

            setIsSubmitting(true);

            try {
                const formData = new FormData();
                formData.append('title', title);
                formData.append('jsxCode', jsxCode);

                await createAnalysis(formData);
            } catch (error) {
                console.error('Error creating analysis:', error);
                alert('분석글 작성 중 오류가 발생했습니다.');
                setIsSubmitting(false);
            }
        }
    };

    if (loading || !user || !isColumnist || isLoadingPost) {
        // Show loading or nothing while redirecting
        return (
            <div className="min-h-screen bg-[#050510] pt-24 flex items-center justify-center text-white">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{isLoadingPost ? '글 불러오는 중...' : 'Loading...'}</span>
                </div>
            </div>
        );
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
                        {isEditMode ? '칼럼 수정' : '글쓰기'}
                    </h1>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('column')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                            activeTab === 'column'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-900/70 hover:text-white border border-white/10'
                        }`}
                    >
                        <PenLine className="w-4 h-4" />
                        칼럼 작성
                        <span className="text-xs opacity-70">(텍스트 + JSX)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                            activeTab === 'analysis'
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
                                : 'bg-slate-900/50 text-slate-400 hover:bg-slate-900/70 hover:text-white border border-white/10'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        분석글 작성
                        <span className="text-xs opacity-70">(JSX 파일)</span>
                    </button>
                </div>

                {/* Editor Card */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Title Input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">제목</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={activeTab === 'column' ? '칼럼 제목을 입력하세요' : '분석글 제목을 입력하세요'}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                />
                            </div>

                            {/* Content - Column Editor */}
                            {activeTab === 'column' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">내용</label>
                                    <TiptapEditor content={content} onChange={setContent} placeholder="칼럼 내용을 입력하세요..." />
                                </div>
                            )}

                            {/* Content - Analysis JSX Upload */}
                            {activeTab === 'analysis' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">
                                        JSX 파일 업로드
                                    </label>

                                    {!jsxCode ? (
                                        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-white/20 rounded-lg cursor-pointer bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="w-12 h-12 mb-4 text-slate-400" />
                                                <p className="mb-2 text-sm text-slate-400">
                                                    <span className="font-semibold">클릭하여 파일 선택</span> 또는 드래그 앤 드롭
                                                </p>
                                                <p className="text-xs text-slate-500">.jsx 또는 .js 파일</p>
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept=".jsx,.js"
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* File Info */}
                                            <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                                <div className="flex items-center gap-3">
                                                    <FileCode className="w-5 h-5 text-purple-400" />
                                                    <div>
                                                        <p className="text-white font-medium">{fileName}</p>
                                                        <p className="text-xs text-slate-500">{jsxCode.length} characters</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => setIsPreview(!isPreview)}
                                                        className="gap-2 text-slate-300 hover:text-white"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        {isPreview ? '코드 보기' : '미리보기'}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={clearFile}
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Preview or Code */}
                                            {isPreview ? (
                                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                                                    <DynamicJSXRenderer jsxCode={jsxCode} />
                                                </div>
                                            ) : (
                                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                                    <pre className="text-xs text-slate-400 overflow-auto max-h-96 font-mono">
                                                        {jsxCode}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Help Text */}
                                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mt-4">
                                        <h3 className="text-sm font-bold text-purple-400 mb-2">💡 JSX 파일 작성 가이드</h3>
                                        <ul className="text-xs text-slate-400 space-y-1">
                                            <li>• 컴포넌트 이름은 반드시 <code className="text-purple-400">const Component = () =&gt; ...</code> 형태로 작성</li>
                                            <li>• React 훅(useState, useEffect 등) 사용 가능</li>
                                            <li>• Recharts 차트 라이브러리 사용 가능 (LineChart, BarChart, PieChart 등)</li>
                                            <li>• 파일 확장자: .jsx 또는 .js</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

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
                                <Button
                                    type="submit"
                                    className={`px-8 text-white ${
                                        activeTab === 'column'
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'bg-purple-600 hover:bg-purple-700'
                                    }`}
                                    disabled={isSubmitting || (activeTab === 'analysis' && !jsxCode)}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    {isSubmitting ? '저장 중...' : isEditMode ? '수정 완료' : activeTab === 'column' ? '칼럼 등록' : '분석글 등록'}
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
