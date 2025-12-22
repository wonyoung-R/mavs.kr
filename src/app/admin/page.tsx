'use client';

import { useState } from 'react';
import { supabase } from '@/lib/db/supabase';
import { Newspaper, Loader2, RefreshCw, Megaphone, LayoutDashboard } from 'lucide-react';
import TiptapEditor from '@/components/editor/TiptapEditor';

export default function AdminDashboardPage() {
    const [crawlingNews, setCrawlingNews] = useState(false);
    const [crawlResult, setCrawlResult] = useState<any>(null);
    const [updatingScores, setUpdatingScores] = useState(false);
    const [scoreUpdateResult, setScoreUpdateResult] = useState<any>(null);

    // Notice states
    const [showNoticeForm, setShowNoticeForm] = useState(false);
    const [noticeTitle, setNoticeTitle] = useState('');
    const [noticeContent, setNoticeContent] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [submittingNotice, setSubmittingNotice] = useState(false);

    const crawlNews = async () => {
        setCrawlingNews(true);
        setCrawlResult(null);

        try {
            const response = await fetch('/api/admin/crawl-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const result = await response.json();
            setCrawlResult(result);

            if (response.ok) {
                alert('뉴스가 성공적으로 크롤링되었습니다!');
            } else {
                alert(`크롤링 실패: ${result.error || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('Crawl news error:', error);
            setCrawlResult({ success: false, error: String(error) });
            alert('크롤링 중 오류가 발생했습니다.');
        } finally {
            setCrawlingNews(false);
        }
    };

    const updateBoxScores = async () => {
        setUpdatingScores(true);
        setScoreUpdateResult(null);

        try {
            const response = await fetch('/api/cron/update-box-scores', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            const result = await response.json();
            setScoreUpdateResult(result);

            if (response.ok) {
                alert('박스스코어가 성공적으로 업데이트되었습니다!');
            } else {
                alert(`업데이트 실패: ${result.error || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('Update box scores error:', error);
            setScoreUpdateResult({ success: false, error: String(error) });
            alert('업데이트 중 오류가 발생했습니다.');
        } finally {
            setUpdatingScores(false);
        }
    };

    const handleNoticeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noticeTitle.trim() || !noticeContent.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        setSubmittingNotice(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            if (!accessToken) {
                throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
            }

            const formData = new FormData();
            formData.append('title', noticeTitle);
            formData.append('content', noticeContent);
            formData.append('isPinned', isPinned.toString());

            const { createNotice } = await import('@/app/actions/notice');
            await createNotice(formData, accessToken);

            alert('공지사항이 등록되었습니다!');
            setNoticeTitle('');
            setNoticeContent('');
            setIsPinned(false);
            setShowNoticeForm(false);
        } catch (error) {
            console.error('Notice creation error:', error);
            alert('공지사항 등록 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setSubmittingNotice(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Title */}
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5" />
                    대시보드
                </h2>
                <p className="text-slate-400 text-sm mt-1">사이트 관리 도구</p>
            </div>

            {/* Box Score Updates */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <RefreshCw className="w-5 h-5" />
                        박스스코어 업데이트
                    </h3>
                    <p className="text-slate-400 text-sm">수동으로 NBA 박스스코어를 업데이트합니다</p>
                </div>

                <div className="p-4">
                    <button
                        onClick={updateBoxScores}
                        disabled={updatingScores}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-green-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {updatingScores ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        {updatingScores ? '업데이트 중...' : '박스스코어 업데이트'}
                    </button>

                    {scoreUpdateResult && (
                        <div className={`mt-4 p-3 rounded-lg text-sm ${scoreUpdateResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                            <div className="font-medium">
                                {scoreUpdateResult.success ? '✅ 업데이트 성공' : '❌ 업데이트 실패'}
                            </div>
                            {scoreUpdateResult.executedAt && (
                                <div className="text-xs opacity-60 mt-1">
                                    실행 시간: {new Date(scoreUpdateResult.executedAt).toLocaleString('ko-KR')}
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-slate-500 mt-3">
                        💡 박스스코어는 매일 오전 6시에 자동으로 업데이트됩니다.
                    </p>
                </div>
            </div>

            {/* News Crawling */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Newspaper className="w-5 h-5" />
                        뉴스 크롤링 관리
                    </h3>
                    <p className="text-slate-400 text-sm">수동으로 뉴스를 크롤링합니다</p>
                </div>

                <div className="p-4">
                    <button
                        onClick={crawlNews}
                        disabled={crawlingNews}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {crawlingNews ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Newspaper className="w-4 h-4" />
                        )}
                        {crawlingNews ? '크롤링 중...' : '뉴스 크롤링 실행'}
                    </button>

                    {crawlResult && (
                        <div className={`mt-4 p-3 rounded-lg text-sm ${crawlResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                            <div className="font-medium">
                                {crawlResult.success ? '✅ 크롤링 성공' : '❌ 크롤링 실패'}
                            </div>
                            {crawlResult.message && (
                                <div className="text-xs opacity-80 mt-1">{crawlResult.message}</div>
                            )}
                            {crawlResult.error && (
                                <div className="text-xs opacity-80 mt-1">{crawlResult.error}</div>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-slate-500 mt-3">
                        💡 뉴스 크롤링은 ESPN, Mavs Moneyball, The Smoking Cuban에서 최신 뉴스를 가져옵니다.
                    </p>
                </div>
            </div>

            {/* Notice Management */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-red-400" />
                        공지사항 작성
                    </h3>
                    <p className="text-slate-400 text-sm">슈퍼관리자만 공지사항을 작성할 수 있습니다</p>
                </div>

                <div className="p-4">
                    {!showNoticeForm ? (
                        <button
                            onClick={() => setShowNoticeForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                        >
                            <Megaphone className="w-4 h-4" />
                            새 공지사항 작성
                        </button>
                    ) : (
                        <form onSubmit={handleNoticeSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    제목
                                </label>
                                <input
                                    type="text"
                                    value={noticeTitle}
                                    onChange={(e) => setNoticeTitle(e.target.value)}
                                    placeholder="공지사항 제목을 입력하세요"
                                    className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    내용
                                </label>
                                <TiptapEditor
                                    content={noticeContent}
                                    onChange={setNoticeContent}
                                    placeholder="공지사항 내용을 입력하세요..."
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isPinned"
                                    checked={isPinned}
                                    onChange={(e) => setIsPinned(e.target.checked)}
                                    className="w-4 h-4 rounded bg-slate-800 border-2 border-slate-700 text-red-500 cursor-pointer"
                                />
                                <label htmlFor="isPinned" className="text-sm text-slate-300 cursor-pointer">
                                    상단 고정
                                </label>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowNoticeForm(false);
                                        setNoticeTitle('');
                                        setNoticeContent('');
                                        setIsPinned(false);
                                    }}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingNotice}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {submittingNotice ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Megaphone className="w-4 h-4" />
                                    )}
                                    {submittingNotice ? '등록 중...' : '공지사항 등록'}
                                </button>
                            </div>
                        </form>
                    )}

                    <p className="text-xs text-slate-500 mt-3">
                        📢 공지사항은 커뮤니티 게시판 상단에 표시됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
