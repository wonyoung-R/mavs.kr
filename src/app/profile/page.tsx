'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/db/supabase';
import { updateProfile, getProfile } from '@/app/actions/profile';
import { ArrowLeft, User, Save, Check } from 'lucide-react';

export default function ProfilePage() {
    const { user, loading, userRole } = useAuth();
    const router = useRouter();
    const [nickname, setNickname] = useState('');
    const [originalNickname, setOriginalNickname] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        if (!user) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            const profile = await getProfile(accessToken);

            if (profile?.name) {
                setNickname(profile.name);
                setOriginalNickname(profile.name);
            } else {
                // Use Google name or email as default
                const defaultName = user.user_metadata?.name || user.email?.split('@')[0] || '';
                setNickname(defaultName);
                setOriginalNickname(defaultName);
            }
        } catch (err) {
            console.error('Failed to fetch profile:', err);
            // Use Google name or email as default on error
            const defaultName = user.user_metadata?.name || user.email?.split('@')[0] || '';
            setNickname(defaultName);
            setOriginalNickname(defaultName);
        }
    };

    const saveNickname = async () => {
        if (!user || !nickname.trim()) return;

        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            if (!accessToken) {
                throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
            }

            const formData = new FormData();
            formData.append('nickname', nickname.trim());

            const result = await updateProfile(formData, accessToken);

            if (result.success) {
                setOriginalNickname(nickname.trim());
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (err) {
            console.error('Failed to save nickname:', err);
            alert(err instanceof Error ? err.message : '닉네임 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = nickname.trim() !== originalNickname;

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-[#050510] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const getRoleBadge = () => {
        switch (userRole) {
            case 'admin':
                return <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">관리자</span>;
            case 'columnist':
                return <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">컬럼작성자</span>;
            default:
                return <span className="px-2 py-1 text-xs rounded bg-slate-500/20 text-slate-400">일반유저</span>;
        }
    };

    return (
        <div className="min-h-screen bg-[#050510]">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
            </div>

            <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
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
                            <User className="w-6 h-6" />
                            프로필
                        </h1>
                    </div>
                </div>

                {/* Profile Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                    {/* Avatar & Email */}
                    <div className="flex items-center gap-4 mb-6">
                        {user.user_metadata?.avatar_url ? (
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Profile"
                                className="w-16 h-16 rounded-full border-2 border-white/10"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center border-2 border-white/10">
                                <User className="w-8 h-8 text-slate-400" />
                            </div>
                        )}
                        <div>
                            <p className="text-white font-medium">{user.email}</p>
                            <div className="mt-1">{getRoleBadge()}</div>
                        </div>
                    </div>

                    {/* Nickname Input */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                닉네임
                            </label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="닉네임을 입력하세요"
                                maxLength={20}
                                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                최대 20자까지 입력 가능합니다
                            </p>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={saveNickname}
                            disabled={!hasChanges || saving}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${hasChanges && !saving
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            {saving ? (
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                            ) : saved ? (
                                <>
                                    <Check className="w-5 h-5" />
                                    저장됨!
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    저장하기
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
