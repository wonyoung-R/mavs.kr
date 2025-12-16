'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { supabase } from '@/lib/db/supabase';
import { ArrowLeft, Shield, User, Edit2, Check, X, Newspaper, Loader2, RefreshCw } from 'lucide-react';

interface UserProfile {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    role: UserRole;
    created_at: string;
}

export default function AdminPage() {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole>('user');
    const [crawlingNews, setCrawlingNews] = useState(false);
    const [crawlResult, setCrawlResult] = useState<any>(null);
    const [updatingScores, setUpdatingScores] = useState(false);
    const [scoreUpdateResult, setScoreUpdateResult] = useState<any>(null);

    // 로컬 개발 환경 체크
    const isDevelopment = process.env.NODE_ENV === 'development';

    useEffect(() => {
        // 개발 환경에서는 인증 체크 건너뛰기
        if (!isDevelopment) {
            if (!loading && !user) {
                router.push('/login');
            } else if (!loading && !isAdmin) {
                router.push('/');
            }
        }
    }, [user, loading, isAdmin, router, isDevelopment]);

    useEffect(() => {
        if (isAdmin || isDevelopment) {
            fetchUsers();
        }
    }, [isAdmin, isDevelopment]);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.log('프로필 테이블이 없거나 데이터가 없습니다. (로컬 개발 모드)');
                // If table doesn't exist, show empty
                setUsers([]);
            } else {
                setUsers(data || []);
            }
        } catch (err) {
            console.log('사용자 목록을 불러올 수 없습니다. (로컬 개발 모드)');
            setUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    const updateUserRole = async (userId: string, newRole: UserRole) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) {
                console.error('Error updating role:', error);
                alert('권한 변경에 실패했습니다.');
                return;
            }

            // Update local state
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setEditingUser(null);
        } catch (err) {
            console.error('Failed to update role:', err);
        }
    };

    const crawlNews = async () => {
        setCrawlingNews(true);
        setCrawlResult(null);

        try {
            const response = await fetch('/api/admin/crawl-news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
                headers: {
                    'Content-Type': 'application/json',
                },
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

    const getRoleBadge = (role: UserRole) => {
        switch (role) {
            case 'admin':
                return <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">관리자</span>;
            case 'columnist':
                return <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">컬럼작성자</span>;
            default:
                return <span className="px-2 py-1 text-xs rounded bg-slate-500/20 text-slate-400">일반유저</span>;
        }
    };

    if (!isDevelopment && (loading || !isAdmin)) {
        return (
            <div className="min-h-screen bg-[#050510] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050510]">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/"
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-6 h-6 text-red-400" />
                            관리자 패널
                        </h1>
                        <p className="text-slate-400">사용자 권한을 관리합니다</p>
                    </div>
                </div>

                {/* User Management */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <User className="w-5 h-5" />
                            사용자 목록
                        </h2>
                    </div>

                    {loadingUsers ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p>등록된 사용자가 없습니다.</p>
                            <p className="text-sm mt-2">사용자가 로그인하면 여기에 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {users.map((u) => (
                                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {u.avatar_url ? (
                                            <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                                                <User className="w-5 h-5 text-slate-400" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-white font-medium">{u.name || '이름 없음'}</p>
                                            <p className="text-sm text-slate-400">{u.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {editingUser === u.id ? (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={selectedRole}
                                                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                                                    className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="user">일반유저</option>
                                                    <option value="columnist">컬럼작성자</option>
                                                    <option value="admin">관리자</option>
                                                </select>
                                                <button
                                                    onClick={() => updateUserRole(u.id, selectedRole)}
                                                    className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingUser(null)}
                                                    className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {getRoleBadge(u.role)}
                                                <button
                                                    onClick={() => {
                                                        setEditingUser(u.id);
                                                        setSelectedRole(u.role);
                                                    }}
                                                    className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Role Descriptions */}
                <div className="mt-6 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
                    <h3 className="text-white font-semibold mb-3">권한 설명</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">관리자</span>
                            <span className="text-slate-400">모든 권한 (사용자 관리, 컨텐츠 삭제 등)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">컬럼작성자</span>
                            <span className="text-slate-400">컬럼 및 뉴스 작성 권한</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 text-xs rounded bg-slate-500/20 text-slate-400">일반유저</span>
                            <span className="text-slate-400">커뮤니티 게시글 및 댓글 작성</span>
                        </div>
                    </div>
                </div>

                {/* Box Score Updates */}
                <div className="mt-6 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <RefreshCw className="w-5 h-5" />
                            박스스코어 업데이트
                        </h2>
                        <p className="text-slate-400 text-sm">수동으로 NBA 박스스코어를 업데이트합니다</p>
                    </div>

                    <div className="p-4">
                        <div className="flex items-center gap-4 mb-4">
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
                        </div>

                        {scoreUpdateResult && (
                            <div className={`p-3 rounded-lg text-sm ${scoreUpdateResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                <div className="font-medium mb-1">
                                    {scoreUpdateResult.success ? '✅ 업데이트 성공' : '❌ 업데이트 실패'}
                                </div>
                                {scoreUpdateResult.executedAt && (
                                    <div className="text-xs opacity-60">
                                        실행 시간: {new Date(scoreUpdateResult.executedAt).toLocaleString('ko-KR')}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-xs text-slate-500 mt-3">
                            💡 박스스코어는 매일 오전 6시에 자동으로 업데이트됩니다.
                        </div>
                    </div>
                </div>

                {/* News Crawling */}
                <div className="mt-6 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Newspaper className="w-5 h-5" />
                            뉴스 크롤링 관리
                        </h2>
                        <p className="text-slate-400 text-sm">수동으로 뉴스를 크롤링합니다</p>
                    </div>

                    <div className="p-4">
                        <div className="flex items-center gap-4 mb-4">
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
                        </div>

                        {crawlResult && (
                            <div className={`p-3 rounded-lg text-sm ${crawlResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                <div className="font-medium mb-1">
                                    {crawlResult.success ? '✅ 크롤링 성공' : '❌ 크롤링 실패'}
                                </div>
                                {crawlResult.message && (
                                    <div className="text-xs opacity-80">{crawlResult.message}</div>
                                )}
                                {crawlResult.error && (
                                    <div className="text-xs opacity-80">{crawlResult.error}</div>
                                )}
                                {crawlResult.timestamp && (
                                    <div className="text-xs opacity-60 mt-1">
                                        실행 시간: {new Date(crawlResult.timestamp).toLocaleString('ko-KR')}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-xs text-slate-500 mt-3">
                            💡 뉴스 크롤링은 ESPN, Mavs Moneyball, The Smoking Cuban에서 최신 뉴스를 가져옵니다.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
